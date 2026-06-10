# app/playwright_manager.py (SYNC - your original)
from playwright.sync_api import sync_playwright


playwright_instance = None
context = None


def start_browser():
    global playwright_instance, context
    if context is not None:
        return context
    playwright_instance = sync_playwright().start()
    context = playwright_instance.chromium.launch_persistent_context(
        user_data_dir="./chrome_profile",
        headless=False,
        viewport={"width": 1600, "height": 900}
    )
    print("Chrome started with persistent profile")
    return context


def inject_slot_overlay(page, label: str):
    page.evaluate(
        """
        (label) => {
            const old = document.getElementById('__slot_overlay__');
            if (old) old.remove();
            const tag = document.createElement('div');
            tag.id = '__slot_overlay__';
            tag.innerText = label;
            tag.style.position = 'fixed';
            tag.style.top = '10px';
            tag.style.left = '10px';
            tag.style.zIndex = '999999';
            tag.style.background = 'rgba(0,0,0,0.75)';
            tag.style.color = 'white';
            tag.style.padding = '6px 10px';
            tag.style.fontSize = '13px';
            tag.style.borderRadius = '6px';
            tag.style.fontFamily = 'Arial';
            tag.style.pointerEvents = 'none';
            document.body.appendChild(tag);
        }
        """,
        label
    )


def create_tabs(symbol: str, timeframes: list[str]) -> dict:
    context = start_browser()
    tabs = {}
    for timeframe in timeframes:
        page = context.new_page()
        page.goto(f"https://www.tradingview.com/chart/?symbol={symbol}", timeout=60000)
        page.wait_for_timeout(5000)
        inject_slot_overlay(page, f"SLOT: {timeframe}")
        tabs[timeframe] = page
        print(f"Opened tab for {timeframe}")
    return tabs


def close_browser():
    global context, playwright_instance
    if context:
        context.close()
    if playwright_instance:
        playwright_instance.stop()
    print("Browser closed")