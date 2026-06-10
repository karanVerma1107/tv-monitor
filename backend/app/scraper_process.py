# app/scraper_process.py
import time
import multiprocessing
from app.playwright_manager import create_tabs, start_browser, close_browser

# ---------- Sync scraping (same as before) ----------
def scrape_page(page, fields_to_scrape):
    last_error = None
    for attempt in range(2):
        try:
            raw = page.evaluate("""
            () => {
                const result = {};
                document.querySelectorAll("[data-test-id-value-title]").forEach(node => {
                    const key = node.getAttribute("data-test-id-value-title");
                    if (key) result[key] = node.innerText;
                });
                return result;
            }
            """)
            break
        except Exception as exc:
            last_error = exc
            if "Cannot switch to a different thread" not in str(exc):
                raise
            time.sleep(0.2)
    if last_error is not None and 'raw' not in locals():
        raise RuntimeError(str(last_error)) from last_error

    raw = raw or {}
    def clean(v):
        if not v:
            return None
        return v.split("\\n")[-1].strip()

    data = {"C": clean(raw.get("C"))}
    for field in fields_to_scrape:
        data[field] = clean(raw.get(field))
    return data

def compute_trend(prev_trend, data):
    buy = data.get("Buy Signal")
    sell = data.get("Sell Signal")
    fast = data.get("Fast EMA (9)")
    slow = data.get("Slow EMA (21)")
    if prev_trend is None:
        try:
            if fast and slow:
                fast = float(fast)
                slow = float(slow)
                return "BUY" if fast > slow else "SELL"
        except:
            return "UNKNOWN"
        return "UNKNOWN"
    if buy in ("1", "1.00000"):
        return "BUY"
    if sell in ("1", "1.00000"):
        return "SELL"
    return prev_trend

# ---------- Main scraper process ----------
def scraper_process(data_queue, stop_event):
    """Runs in a separate process – no asyncio, pure sync Playwright."""
    start_browser()
    active_instances = {}   # instance_id -> dict with pages, fields, etc.
    trend_states = {}       # instance_id -> {timeframe: last trend}

    print("[SCRAPER] Process started, waiting for instances...")

    while not stop_event.is_set():
        # Process commands from main process (add/remove instances)
        while True:
            try:
                msg = data_queue.get_nowait()
            except multiprocessing.queues.Empty:
                break
            if msg["type"] == "add_instance":
                inst_id = msg["instance_id"]
                symbol = msg["symbol"]
                timeframes = msg["timeframes"]
                fields = msg["fields"]
                try:
                    tabs = create_tabs(symbol=symbol, timeframes=timeframes)
                    active_instances[inst_id] = {
                        "id": inst_id,
                        "symbol": symbol,
                        "fieldsToScrape": fields,
                        "page_mapping": tabs,
                    }
                    trend_states[inst_id] = {}
                    print(f"[SCRAPER] Added instance {inst_id}")
                    # Optionally send a confirmation back to main process
                    data_queue.put({
                        "type": "instance_added",
                        "instance_id": inst_id,
                        "status": "ready"
                    })
                except Exception as e:
                    print(f"[SCRAPER] Failed to add instance {inst_id}: {e}")
            elif msg["type"] == "remove_instance":
                inst_id = msg["instance_id"]
                if inst_id in active_instances:
                    # Close pages
                    for page in active_instances[inst_id]["page_mapping"].values():
                        try:
                            page.close()
                        except:
                            pass
                    del active_instances[inst_id]
                    del trend_states[inst_id]
                    print(f"[SCRAPER] Removed instance {inst_id}")

        # Scrape all active instances
        for inst_id, inst in list(active_instances.items()):
            snapshot = {
                "timestamp": time.strftime("%H:%M:%S UTC", time.gmtime()),
                "instanceId": inst_id,
                "symbol": inst["symbol"],
                "status": "RUNNING",
                "serverTime": int(time.time() * 1000),
                "data": {}
            }
            all_ok = True
            for timeframe, page in inst["page_mapping"].items():
                try:
                    data = scrape_page(page, inst["fieldsToScrape"])
                    prev = trend_states[inst_id].get(timeframe)
                    trend = compute_trend(prev, data)
                    trend_states[inst_id][timeframe] = trend
                    snapshot["data"][timeframe] = {**data, "trend": trend}
                except Exception as e:
                    snapshot["data"][timeframe] = {"error": str(e), "trend": "UNKNOWN"}
                    all_ok = False
                    print(f"[SCRAPER] Error scraping {inst_id}/{timeframe}: {e}")

            # Send data to main process
            data_queue.put({
                "type": "data",
                "instance_id": inst_id,
                "snapshot": snapshot
            })
            # Print log of what data was sent
            if all_ok:
                print(f"[SCRAPER] Sent data for {inst_id} - timeframes: {list(snapshot['data'].keys())}")

        # Sleep to control loop frequency
        time.sleep(0.25)

    # Cleanup
    close_browser()
    print("[SCRAPER] Process stopped.")