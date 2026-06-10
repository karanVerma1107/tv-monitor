import asyncio
import time
from app.ws_manager import broadcast
from app.runtime import active_instances


# ----------------------------
# SNAPSHOT FROM ONE PAGE
# ----------------------------
def scrape_page(page, fields_to_scrape):

    raw = page.evaluate("""
    () => {

        const result = {};

        document.querySelectorAll(
            "[data-test-id-value-title]"
        ).forEach(node => {

            const key = node.getAttribute(
                "data-test-id-value-title"
            );

            if (key) {
                result[key] = node.innerText;
            }
        });

        return result;
    }
    """)

    def clean(v):
        if not v:
            return None
        return v.split("\\n")[-1].strip()

    data = {}

    data["C"] = clean(raw.get("C"))

    for field in fields_to_scrape:
        data[field] = clean(raw.get(field))

    return data


# ----------------------------
# TREND ENGINE (STATEFUL)
# ----------------------------
def compute_trend(prev_trend, data):

    buy = data.get("Buy Signal")
    sell = data.get("Sell Signal")
    fast = data.get("Fast EMA (9)")
    slow = data.get("Slow EMA (21)")

    # INITIAL STATE
    if prev_trend is None:

        if fast and slow:

            try:
                fast = float(fast)
                slow = float(slow)

                return "BUY" if fast > slow else "SELL"

            except:
                return "UNKNOWN"

        return "UNKNOWN"

    # UPDATE STATE
    if buy == "1" or buy == "1.00000":
        return "BUY"

    if sell == "1" or sell == "1.00000":
        return "SELL"

    # keep previous trend on 0/0
    return prev_trend


# ----------------------------
# INSTANCE SCRAPER
# ----------------------------
async def scrape_instance(instance):

    if "trend_state" not in instance:
        instance["trend_state"] = {}

    snapshot = {
        "timestamp": int(time.time() * 1000)
    }

    for timeframe, page in instance["page_mapping"].items():

        try:

            data = scrape_page(
                page,
                instance["fieldsToScrape"]
            )

            prev = instance["trend_state"].get(timeframe)

            trend = compute_trend(prev, data)

            instance["trend_state"][timeframe] = trend

            snapshot[timeframe] = {
                **data,
                "trend": trend
            }


    
            

            print(
                f"{instance['instanceName']} | "
                f"{timeframe} | "
                f"C={data.get('C')} | "
                f"trend={trend}"
            )

        except Exception as e:

            snapshot[timeframe] = {
                "error": str(e)
            }

            print(
                f"{instance['instanceName']} | "
                f"{timeframe} | ERROR={e}"
            )

    instance["latest_data"] = snapshot
    
    await broadcast(
                   instance["id"],
                   snapshot
            )

    return snapshot


# ----------------------------
# GLOBAL LOOP (250ms ENGINE)
# ----------------------------
async def scraper_loop():

    while True:

        instances = list(active_instances.values())

        # run all instances in parallel per cycle
        await asyncio.gather(
            *[
                scrape_instance(instance)
                for instance in instances
            ]
        )

        await asyncio.sleep(0.25)