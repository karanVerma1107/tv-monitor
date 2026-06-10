import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4

from app.models.instance import InstanceCreate
from app.runtime import instances, active_instances
from app.playwright_manager import create_tabs
from app.ws_manager import connect, disconnect, broadcast

#uvicorn app.main:app --reload --port 8000
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


def compute_trend(data):
    """
    Calculate trend from EMAs ONLY.
    No HOLD logic - just BUY if fast > slow, SELL if fast <= slow
    """
    fast = data.get("Fast EMA (9)")
    slow = data.get("Slow EMA (21)")

    try:
        if fast and slow:
            fast_val = float(fast)
            slow_val = float(slow)
            return "BUY" if fast_val > slow_val else "SELL"
    except:
        pass
    
    return "UNKNOWN"


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
        # Calculate initial trend from EMAs for all timeframes
        for timeframe in instance["timeframes"]:
            instance["trend_state"][timeframe] = None  # Will compute on first data

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
            
            # Recalculate trend EVERY time from EMAs
            trend = compute_trend(data)
            
            # Update trend_state
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
    # Send data via WebSocket (includes trend)
    await broadcast(instance["id"], snapshot)


# ----------------------------
# FASTAPI LIFESPAN
# ----------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Scraper engine starting...")
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