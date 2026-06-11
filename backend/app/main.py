import asyncio
import time
from contextlib import asynccontextmanager
import csv
import os
from datetime import datetime
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4

from app.models.instance import InstanceCreate
from app.runtime import instances, active_instances
from app.playwright_manager import create_tabs
from app.ws_manager import connect, disconnect, broadcast

# to run file: uvicorn app.main:app --reload --port 8000
# ----------------------------
# CSV SETUP (Simplified for 1 instance, 2 timeframes)
# ----------------------------


CSV_FILE = "scraper_data.csv"


def init_csv():
    """Initialize CSV with headers if file doesn't exist"""
    if not os.path.exists(CSV_FILE):
        headers = [
            "symbol",
            "tv_timestamp",
            "C",
            "5m_EMA9",
            "5m_EMA21",
            "5m_Trend",
            "5m_Buy",
            "5m_Sell",
            "15m_EMA9",
            "15m_EMA21",
            "15m_Trend",
            "15m_Buy",
            "15m_Sell"
        ]
        with open(CSV_FILE, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)

def save_to_csv(snapshot: dict, instance: dict):
    """Save scraping data to CSV ONLY when trading values change (ignore timestamp)"""
    init_csv()
    
    data = snapshot.get("data", {})
    
    # Get values for 5m
    tf_5m = data.get("5m", {})
    ema9_5m = tf_5m.get("Fast EMA (9)") or ""
    ema21_5m = tf_5m.get("Slow EMA (21)") or ""
    trend_5m = tf_5m.get("trend") or ""
    buy_5m = tf_5m.get("Buy Signal") or ""
    sell_5m = tf_5m.get("Sell Signal") or ""
    
    # Get values for 15m
    tf_15m = data.get("15m", {})
    ema9_15m = tf_15m.get("Fast EMA (9)") or ""
    ema21_15m = tf_15m.get("Slow EMA (21)") or ""
    trend_15m = tf_15m.get("trend") or ""
    buy_15m = tf_15m.get("Buy Signal") or ""
    sell_15m = tf_15m.get("Sell Signal") or ""
    
    # Get C (price)
    c_value = tf_5m.get("C") or tf_15m.get("C") or ""
    
    # Build current row (WITHOUT timestamp for comparison)
    current_values = [
        snapshot.get("symbol") or instance.get("symbol"),  # col 0: symbol
        c_value,  # col 2: C
        ema9_5m,  # col 3: 5m_EMA9
        ema21_5m,  # col 4: 5m_EMA21
        trend_5m,  # col 5: 5m_Trend
        buy_5m,  # col 6: 5m_Buy
        sell_5m,  # col 7: 5m_Sell
        ema9_15m,  # col 8: 15m_EMA9
        ema21_15m,  # col 9: 15m_EMA21
        trend_15m,  # col 10: 15m_Trend
        buy_15m,  # col 11: 15m_Buy
        sell_15m,  # col 12: 15m_Sell
    ]
    
    # Full row for CSV (WITH timestamp)
    full_row = [
        snapshot.get("symbol") or instance.get("symbol"),
        snapshot.get("timestamp"),  # timestamp (ignored in comparison)
        c_value,
        ema9_5m,
        ema21_5m,
        trend_5m,
        buy_5m,
        sell_5m,
        ema9_15m,
        ema21_15m,
        trend_15m,
        buy_15m,
        sell_15m,
    ]
    
    if "last_saved_values" not in instance:
        # First run - always save
        instance["last_saved_values"] = current_values
        with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(full_row)
    else:
        # Compare WITHOUT timestamp
        last_values = instance["last_saved_values"]
        
        changed = False
        for i in range(len(current_values)):
            if current_values[i] != last_values[i]:
                changed = True
                break
        
        if changed:
            instance["last_saved_values"] = current_values
            with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(full_row)
# ----------------------------
# SCRAPER CORE
# ----------------------------


async def scrape_page(page, fields_to_scrape):
    last_error = None
    raw = None

    for attempt in range(2):
        try:
            raw = await asyncio.to_thread(
                page.evaluate, """
                () => {
                    const result = {};
                    
                    // Get Close (C) directly
                    const cElement = document.querySelector('[data-test-id-value-title="C"]');
                    if (cElement) {
                        result['C'] = cElement.innerText;
                    }
                    
                    // Get other fields
                    document.querySelectorAll('[data-test-id-value-title]').forEach(node => {
                        const key = node.getAttribute('data-test-id-value-title');
                        if (key && key !== 'C') {
                            result[key] = node.innerText;
                        }
                    });
                    
                    return result;
                }
                """
            )
            break
        except Exception as exc:
            last_error = exc
            if "Cannot switch to a different thread" not in str(exc):
                raise
            await asyncio.sleep(0.2)

    if last_error is not None and raw is None:
        raise RuntimeError(str(last_error)) from last_error

    raw = raw or {}

    def clean(v):
        if not v:
            return None
        return v.split("\n")[-1].strip()

    data = {}
    data["C"] = clean(raw.get("C"))
    
    for field in fields_to_scrape:
        data[field] = clean(raw.get(field))

    return data


def compute_trend(data, prev_trend=None):
    """
    Calculate trend:
    1. On first run (prev_trend=None): use EMAs to determine initial trend
    2. After that: trend changes ONLY on BUY/SELL signal
    3. If both signals = 0: keep previous trend (HOLD)
    
    Returns: "BULLISH" or "BEARISH"
    """
    fast = data.get("Fast EMA (9)")
    slow = data.get("Slow EMA (21)")
    buy = data.get("Buy Signal")
    sell = data.get("Sell Signal")

    # INIT: Calculate from EMAs when prev_trend is None
    if prev_trend is None:
        try:
            if fast and slow:
                fast_val = float(fast)
                slow_val = float(slow)
                return "BULLISH" if fast_val > slow_val else "BEARISH"
        except:
            pass
        return "UNKNOWN"

    # Signal values (check for "1" or 1)
    buy_active = buy in ("1", "1.00000", 1, 1.0, "1.0")
    sell_active = sell in ("1", "1.00000", 1, 1.0, "1.0")

    # BUY signal active → BULLISH
    if buy_active:
        return "BULLISH"

    # SELL signal active → BEARISH
    if sell_active:
        return "BEARISH"

    # Both signals = 0 → HOLD (keep previous trend)
    return prev_trend


# ----------------------------
# SINGLE SCRAPER ENGINE
# ----------------------------


async def scraper_loop():
    while True:
        start = time.time()
        instances_snapshot = list(active_instances.values())

        for instance in instances_snapshot:
            await process_instance(instance)

        elapsed = time.time() - start
        await asyncio.sleep(max(0, 0.25 - elapsed))


async def process_instance(instance):
    # Initialize trend_state on first run (when instance starts)
    if "trend_state" not in instance:
        instance["trend_state"] = {}
        for timeframe in instance["timeframes"]:
            instance["trend_state"][timeframe] = None

    snapshot = {
        "timestamp": time.strftime("%H:%M:%S UTC", time.gmtime()),
        "instanceId": instance["id"],
        "symbol": instance.get("symbol"),
        "status": instance.get("status"),
        "serverTime": int(time.time() * 1000),
        "data": {}
    }

    for timeframe, page in instance["page_mapping"].items():
        try:
            data = await scrape_page(page, instance["fieldsToScrape"])
            
            prev = instance["trend_state"].get(timeframe)
            trend = compute_trend(data, prev)
            
            instance["trend_state"][timeframe] = trend

            snapshot["data"][timeframe] = {
                **data,
                "trend": trend
            }

        except Exception as e:
            snapshot["data"][timeframe] = {
                "error": str(e),
                "trend": "UNKNOWN"
            }

    instance["latest_data"] = snapshot
    
    # Save to CSV
    save_to_csv(snapshot, instance)
    
    # Send data via WebSocket
    await broadcast(instance["id"], snapshot)


# ----------------------------
# FASTAPI LIFESPAN
# ----------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Scraper engine starting...")
    init_csv()
    print(f"📁 CSV file initialized: {CSV_FILE}")
    
    task = asyncio.create_task(scraper_loop())
    yield
    print("🛑 Shutting down scraper...")
    task.cancel()


app = FastAPI(lifespan=lifespan)


# ----------------------------
# CORS
# ----------------------------


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------
# WEBSOCKET
# ----------------------------


@app.websocket("/ws/{instance_id}")
async def ws_endpoint(websocket: WebSocket, instance_id: str):
    await connect(instance_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except:
        await disconnect(instance_id, websocket)


# ----------------------------
# HEALTH
# ----------------------------


@app.get("/health")
def health():
    return {"status": "healthy"}


# ----------------------------
# CREATE INSTANCE
# ----------------------------


@app.post("/api/instances")
async def create_instance(data: InstanceCreate):
    instance_id = f"inst_{uuid4().hex[:8]}"

    instance = {
        "id": instance_id,
        "status": "WAITING_CONFIRMATION",
        "instanceName": data.instanceName,
        "description": data.description,
        "symbol": data.symbol,
        "timeframes": [tf.strip() for tf in data.timeframes],
        "fieldsToScrape": data.fieldsToScrape,
        "tabs": {},
        "latest_data": {}
    }

    instances[instance_id] = instance

    tabs = await asyncio.to_thread(
        create_tabs,
        symbol=data.symbol,
        timeframes=data.timeframes
    )

    instance["tabs"] = tabs
    print(instance)

    return {
        "id": instance_id,
        "status": "WAITING_CONFIRMATION",
        "instanceName": instance["instanceName"],
        "description": instance["description"],
        "symbol": instance["symbol"],
        "timeframes": instance["timeframes"]
    }


# ----------------------------
# GET INSTANCES
# ----------------------------


@app.get("/api/instances")
def get_instances():
    return [
        {
            "id": inst["id"],
            "instanceName": inst["instanceName"],
            "status": inst["status"],
            "symbol": inst["symbol"],
            "timeframes": inst["timeframes"]
        }
        for inst in instances.values()
    ]


# ----------------------------
# CONFIRM INSTANCE
# ----------------------------


@app.post("/api/instances/{instance_id}/confirm")
def confirm_instance(instance_id: str):
    instance = instances.get(instance_id)

    if not instance:
        raise HTTPException(404, "Instance not found")

    if instance["status"] != "WAITING_CONFIRMATION":
        raise HTTPException(400, "Not confirmable")

    instance["page_mapping"] = instance["tabs"]
    active_instances[instance_id] = instance
    instance["status"] = "RUNNING"

    print("CONFIRMED:", instance_id)

    return {
        "instanceId": instance_id,
        "status": "RUNNING"
    }


# ----------------------------
# DOWNLOAD CSV
# ----------------------------


@app.get("/api/download-csv")
def download_csv():
    """Download CSV file"""
    from fastapi.responses import FileResponse
    
    if not os.path.exists(CSV_FILE):
        raise HTTPException(404, "No data available")
    
    return FileResponse(
        path=CSV_FILE,
        filename="scraper_data.csv",
        media_type="text/csv"
    )