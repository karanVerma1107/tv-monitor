# app/playwright_manager.py (SYNC)
from playwright.sync_api import sync_playwright


# Global browser (shared across all instances)
_browser = None
_context = None


def start_browser():
    """Start browser once, share context across all instances"""
    global _browser, _context  # ← ADD THIS LINE
    
    if _context is not None:
        return _context
    
    _browser = sync_playwright().start()
    _context = _browser.chromium.launch_persistent_context(
        user_data_dir="./chrome_profile",
        headless=False,
        viewport={"width": 1600, "height": 900}
    )
    print("Chrome started with persistent profile")
    return _context


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
    """Create NEW pages for each instance"""
    context = start_browser()
    tabs = {}
    
    for timeframe in timeframes:
        # Create a NEW page for this instance
        page = context.new_page()
        
        # Navigate to TradingView chart
        page.goto(f"https://www.tradingview.com/chart/?symbol={symbol}", timeout=60000)
        page.wait_for_timeout(5000)  # let chart load
        
        # Add overlay label
        inject_slot_overlay(page, f"SLOT: {timeframe}")
        
        tabs[timeframe] = page
        print(f"Opened tab for {timeframe} (instance: {symbol})")
    
    return tabs


def close_browser():
    """Close browser when shutting down"""
    global _context, _browser  # ← ADD THIS TOO
    
    if _context:
        _context.close()
    if _browser:
        _browser.stop()
    print("Browser closed")