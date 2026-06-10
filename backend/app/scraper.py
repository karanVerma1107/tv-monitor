import asyncio
import time

from app.runtime import active_instances
from app.scrapper import scrape_page
from app.ws_manager import broadcast


async def scraper_loop():

    while True:

        start_time = time.time()

        # snapshot all instances at SAME tick
        for instance_id, instance in list(active_instances.items()):

            snapshot = {
                "timestamp": time.strftime("%H:%M:%S UTC", time.gmtime())
            }

            for timeframe, page in instance["page_mapping"].items():

                try:
                    data = scrape_page(
                        page,
                        instance["fieldsToScrape"]
                    )

                    snapshot[timeframe] = data

                except Exception as e:

                    snapshot[timeframe] = {"error": str(e)}

            # store latest
            instance["latest_data"] = snapshot

            # 🚨 THIS IS WHAT YOU ARE MISSING
            await broadcast(instance_id, snapshot)

        # maintain 250ms cycle
        elapsed = time.time() - start_time
        await asyncio.sleep(max(0, 0.25 - elapsed))