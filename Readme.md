# 📊 TV-MONITOR - TradingView Real-Time Scraper

Real-time TradingView data scraper with WebSocket streaming, trend analysis (BULLISH/BEARISH), and automatic CSV saving. Supports any symbol (FOREX, Crypto, Stocks) with customizable fields for trend validation.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd tv-monitor/backend
venv\Scripts\activate
pip install fastapi uvicorn playwright python-multipart
playwright install
```

### 2. Run Backend

```bash
uvicorn app.main:app --reload --port 8000
```

Backend starts at http://localhost:8000

---

## 📡 API Endpoints

### 1. Create Instance

**POST** `/api/instances`

Creates a new trading instance with any symbol and timeframes.

**Request Body:**
```json
{
  "instanceName": "AUDUSD",
  "description": "blahblah",
  "symbol": "OANDA:AUDUSD",
  "timeframes": ["5m", "15m"],
  "fieldsToScrape": [
    "Fast EMA (9)",
    "Slow EMA (21)",
    "Buy Signal",
    "Sell Signal"
  ]
}
```

**Expected Response:**
```json
{
  "id": "inst_015a2c5e",
  "status": "WAITING_CONFIRMATION",
  "instanceName": "AUDUSD",
  "description": "blahblah",
  "symbol": "OANDA:AUDUSD",
  "timeframes": ["5m", "15m"]
}
```

**What it does:**
- Generates unique instance ID (inst_xxxxxxxx)
- Stores instance in memory (instances dict)
- Opens Chrome tabs via Playwright for each timeframe
- Returns instance with WAITING_CONFIRMATION status

---

### 2. Get All Instances

**GET** `/api/instances`

Returns list of all created instances.

**Expected Response:**
```json
[
  {
    "id": "inst_015a2c5e",
    "instanceName": "AUDUSD",
    "status": "WAITING_CONFIRMATION",
    "symbol": "OANDA:AUDUSD",
    "timeframes": ["5m", "15m"]
  }
]
```

**What it does:**
- Returns all instances from instances dict
- Shows current status (WAITING_CONFIRMATION or RUNNING)

---

### 3. Confirm Instance

**POST** `/api/instances/{instance_id}/confirm`

Activates instance and starts scraping.

**Expected Response:**
```json
{
  "instanceId": "inst_015a2c5e",
  "status": "RUNNING"
}
```

**What it does:**
- Validates instance exists and is WAITING_CONFIRMATION
- Moves instance from instances → active_instances
- Sets status to RUNNING
- Scraper loop begins polling pages every 250ms
- Trend calculated from EMAs on first run

---

### 4. WebSocket Stream

**WS** `/ws/{instance_id}`

Real-time data streaming for active instances.

**Connection:**
```javascript
const ws = new WebSocket("ws://localhost:8000/ws/inst_015a2c5e");
```

**WebSocket Message Format:**
```json
{
  "timestamp": "10:59:15 UTC",
  "instanceId": "inst_015a2c5e",
  "symbol": "OANDA:AUDUSD",
  "status": "RUNNING",
  "serverTime": 1781175555511,
  "data": {
    "5m": {
      "C": "0.69954",
      "Fast EMA (9)": "0.69956",
      "Slow EMA (21)": "0.69960",
      "Buy Signal": "0.00000",
      "Sell Signal": "0.00000",
      "trend": "BEARISH"
    },
    "15m": {
      "C": "0.69954",
      "Fast EMA (9)": "0.69959",
      "Slow EMA (21)": "0.69983",
      "Buy Signal": "0.00000",
      "Sell Signal": "0.00000",
      "trend": "BEARISH"
    }
  }
}
```

**What it does:**
- Scrapes TradingView for each timeframe every 250ms
- Extracts: Close price (C), EMAs, Buy/Sell signals
- Calculates trend (BULLISH/BEARISH) per timeframe
- Broadcasts data to connected frontend via WebSocket
- Saves to CSV only when values change

---

### 5. Health Check

**GET** `/health`

**Expected Response:**
```json
{
  "status": "healthy"
}
```

---

### 6. Download CSV

**GET** `/api/download-csv`

Downloads scraped data as CSV file.

**Response:** File download (scraper_data.csv)

**CSV Columns:**
symbol, tv_timestamp, C, 5m_EMA9, 5m_EMA21, 5m_Trend, 5m_Buy, 5m_Sell, 15m_EMA9, 15m_EMA21, 15m_Trend, 15m_Buy, 15m_Sell

text

**Example Row:**
```csv
OANDA:AUDUSD, 10:59:15 UTC, 0.69954, 0.69956, 0.69960, BEARISH, 0.00000, 0.00000, 0.69959, 0.69983, BEARISH, 0.00000, 0.00000
```

---

## 📈 Trend Logic

### Initial Trend (When Instance Starts)
EMA9 > EMA21 → BULLISH
EMA9 <= EMA21 → BEARISH

text

Trend is calculated from EMAs once at instance start.

### After Initial (Trend Changes Only on Signals)
Buy Signal = 1 → BULLISH
Sell Signal = 1 → BEARISH
Buy = 0 AND Sell = 0 → HOLD (keep previous trend)

text

Key Rule: Once trend is set, it only changes when Buy/Sell signal becomes 1. If both signals are 0, trend remains unchanged (HOLD).

---

## 🖥️ Chrome Behavior

When you create an instance, Chrome opens automatically:

1. Chart loads for the symbol (e.g., OANDA:AUDUSD)
2. **Wait for the SLOT overlay to appear in the top-left corner**
3. The SLOT shows the timeframe (e.g., "SLOT: 5m", "SLOT: 15m")
4. This confirms the timeframe is loaded and ready for scraping
5. Scraper starts polling after SLOT appears

The SLOT overlay is a visual indicator (black box with white text) that confirms the timeframe chart is fully loaded.

---

## 🎯 Fields to Scrape (Any Symbol)

You can use any symbol (OANDA:AUDUSD, BINANCE:BTCUSD, NYSE:AAPL, etc.).

The fieldsToScrape array should contain exact titles from your TradingView PineScript indicator. These values are used only for trend validation:

**Required fields for trend calculation:**
- "Fast EMA (9)" - EMA 9 value
- "Slow EMA (21)" - EMA 21 value
- "Buy Signal" - Buy signal (0 or 1)
- "Sell Signal" - Sell signal (0 or 1)

**Auto-extracted (no need to add):**
- "C" - Close price (automatically scraped)

**Example for different indicators:**
```json
// EMA Crossover Strategy
"fieldsToScrape": ["Fast EMA (9)", "Slow EMA (21)", "Buy Signal", "Sell Signal"]

// RSI Strategy
"fieldsToScrape": ["RSI (14)", "RSI Buy", "RSI Sell"]

// MACD Strategy
"fieldsToScrape": ["MACD Line", "MACD Signal", "MACD Buy", "MACD Sell"]
```

Just ensure your PineScript exposes values with matching titles.

---

## 🧪 PineScript Example

TradingView indicator must expose values with exact titles:

```javascript
//@version=5
strategy("EMA 9/21 Crossover Strategy",
     overlay=true,
     initial_capital=10000,
     default_qty_type=strategy.percent_of_equity,
     default_qty_value=100,
     calc_on_every_tick=true,
     process_orders_on_close=false)

// --- Inputs ---
src = input.source(close, title="Source")
fast_length = input.int(9, title="Fast EMA Length")
slow_length = input.int(21, title="Slow EMA Length")

// --- Calculations ---
fast_ema = ta.ema(src, fast_length)
slow_length_ema = ta.ema(src, slow_length)

// --- Plotting EMAs ---
plot(fast_ema,
     color=color.blue,
     title="Fast EMA (9)",
     linewidth=2)

plot(slow_length_ema,
     color=color.orange,
     title="Slow EMA (21)",
     linewidth=2)

// --- Crossover Conditions ---
longCondition = ta.crossover(fast_ema, slow_length_ema)
shortCondition = ta.crossunder(fast_ema, slow_length_ema)

// --------------------------------------------------
// EXACT EVENT TIMESTAMPS
// --------------------------------------------------

buy_timestamp = longCondition ? timenow : na
sell_timestamp = shortCondition ? timenow : na
crossing_timestamp = (longCondition or shortCondition) ? timenow : na

plot(buy_timestamp,
     title="Buy Timestamp",
     display=display.none)

plot(sell_timestamp,
     title="Sell Timestamp",
     display=display.none)

plot(crossing_timestamp,
     title="Crossing Timestamp",
     display=display.none)

// --- Execution Logic ---
if (longCondition)
    strategy.entry("Buy", strategy.long)

if (shortCondition)
    strategy.entry("Sell", strategy.short)

// --- Visual Signals ---
plotshape(series=longCondition,
     title="Buy Signal",
     style=shape.triangleup,
     location=location.belowbar,
     color=color.green,
     size=size.small,
     text="BUY",
     textcolor=color.green)

plotshape(series=shortCondition,
     title="Sell Signal",
     style=shape.triangledown,
     location=location.abovebar,
     color=color.red,
     size=size.small,
     text="SELL",
     textcolor=color.red)

// --- Background Coloring ---
bg_color =
     strategy.position_size > 0
     ? color.new(color.green, 95)
     : strategy.position_size < 0
     ? color.new(color.red, 95)
     : na

bgcolor(bg_color)
```

Important: Titles in plot() must match exactly with fieldsToScrape array.

---

## 🗂️ Project Structure
tv-monitor/
├── backend/
│ ├── app/
│ │ ├── main.py # API endpoints + scraper logic + trend calculation
│ │ ├── playwright_manager.py # Chrome tab creation (shared browser)
│ │ ├── ws_manager.py # WebSocket connection handling
│ │ ├── runtime.py # Instance storage (instances, active_instances)
│ │ └── models/
│ │ └── instance.py # InstanceCreate Pydantic schema
│ ├── scraper_data.csv # Auto-saved scraped data
│ ├── chrome_profile/ # Persistent Chrome profile
│ ├── venv/
│ └── requirements.txt
├── frontend/
│ └── src/
│ └── InstanceList.tsx # React frontend with WebSocket

text

---

## 🔧 Environment

- Python: 3.13
- Backend: FastAPI + Uvicorn (ASGI)
- Browser: Playwright (Chromium with persistent profile)
- Ports: 8000 (backend), 3000 (frontend)
- CORS: Enabled for http://localhost:3000

---

## 📝 Important Notes

✔ CSV only saves when values change (C, EMAs, Trend, Buy/Sell signals)
✔ Timestamp changes alone won't create new row
✔ Supports any symbol: FOREX (OANDA:*), Crypto (BINANCE:*), Stocks (NYSE:*, NASDAQ:*)
✔ Multiple instances: Each gets own Chrome tabs (shared browser context)
✔ WebSocket auto-reconnects on frontend
✔ Trend persists: BULLISH/BEARISH stays until signal changes
✔ Trend validation: Uses same fieldsToScrape values for all symbols
✔ Close price (C): Auto-extracted, no need to add to fieldsToScrape
✔ Chrome SLOT overlay: Confirms timeframe is loaded before scraping

---

## 🚦 Troubleshooting

**Chrome not opening?**
```bash
playwright install
```

**WebSocket not connecting?**
- Ensure backend is running on port 8000
- Check CORS settings in main.py

**Data not scraping?**
- Confirm PineScript titles match fieldsToScrape exactly
- Check TradingView page loads (timeout 60s)
- Verify SLOT overlay appears in top-left corner

**CSV not updating?**
- Values must change (C, EMA, Trend, Signal) to save new row
- File location: tv-monitor/backend/scraper_data.csv

---

## 📄 License

Private project - TV-MONITOR TradingView Scraper
