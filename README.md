# Premia

> A systematic options screener for credit spread and cash-secured put traders— daily ingestion pipeline, PostgreSQL snapshot store, and a Next.js frontend.

---

## What it does

Premia pulls options chain data every evening after market close and surfaces the best credit spread and cash-secured put setups based on delta, risk/reward, DTE, and liquidity. The goal: spend 5 minutes reviewing pre-filtered, ranked positions instead of hunting manually through option chains.

Two trade types are supported:

- **Credit spreads** — bull put and bear call verticals, filtered by delta band (0.15–0.22), DTE window (14–21 days), risk/reward (collateral/premium ≤ 5), and minimum open interest on both legs.
- **Cash-secured puts** — single-leg puts on quality underlyings, sorted by annualized premium yield and probability OTM.

---

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   yfinance API      │     │      yfinance       │
│  options chains,    │     │  prices, sector,    │
│  greeks, bid/ask    │     │  universe filter    │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           └──────────┬────────────────┘
                      ▼
        ┌─────────────────────────────┐
        │   GitHub Actions — cron     │
        │   nightly at 16:15 ET       │
        │   compute spreads + CSPs    │
        │   write daily snapshots     │
        └──────────────┬──────────────┘
                       ▼
        ┌──────────────────────────────────┐
        │       Supabase Postgres          │
        │  spreads_daily · csps_daily      │
        │  underlyings · snapshots         │
        └──────────────┬───────────────────┘
                       ▼
        ┌──────────────────────────────────┐
        │   Next.js API routes — Vercel    │
        │   filter params → SQL → JSON     │
        └──────────┬──────────────┬────────┘
                   ▼              ▼
          ┌──────────────┐  ┌──────────────────┐
          │   Screener   │  │  AI chat  [v2]   │
          │  TanStack    │  │  text-to-filter  │
          │  Table       │  │  via LLM         │
          └──────────────┘  └──────────────────┘
```

The pipeline has three independent concerns:

**Ingestion** — a Python script runs via GitHub Actions on a nightly cron. It pulls options chains for the screened universe, computes every adjacent-strike vertical spread and all CSP candidates, applies liquidity filters, and writes a timestamped snapshot to Postgres. The pipeline is idempotent: re-running on the same date upserts cleanly.

**Storage** — Supabase Postgres holds all daily snapshots. Keeping history is intentional: it enables backtesting the screener's picks over rolling windows without any extra infrastructure.

**Frontend** — Vercel serves a Next.js app with two tabs (credit spreads and CSPs) backed by server-side API routes that translate URL filter params into parameterised SQL queries. No raw data is ever computed client-side.

---

## Tech stack


| Layer             | Technology                                            |
| ----------------- | ----------------------------------------------------- |
| Data ingestion    | Python 3.11, pandas, requests                         |
| Options data      | Tradier API (chains, greeks, bid/ask)                 |
| Price/sector data | yfinance                                              |
| Storage           | PostgreSQL on Supabase (free tier)                    |
| Job scheduling    | GitHub Actions (cron)                                 |
| API               | Next.js 14 App Router (route handlers)                |
| Frontend          | React 18, TypeScript, Tailwind CSS, TanStack Table v8 |
| Charts            | Recharts                                              |
| Deployment        | Vercel                                                |
| V2 — AI layer     | Claude API / GPT-4o-mini (text-to-filter)             |


---

## Database schema

### `underlyings`


| column                | type    | notes                       |
| --------------------- | ------- | --------------------------- |
| ticker                | text    |                             |
| as_of_date            | date    |                             |
| price                 | numeric | closing price               |
| iv_rank               | numeric | 52-week IV percentile       |
| avg_dollar_volume_20d | bigint  | used for universe filtering |
| sector                | text    | GICS sector                 |
| market_cap            | bigint  | USD                         |


Primary key: `(ticker, as_of_date)`

---

### `spreads_daily`


| column             | type    | notes                                            |
| ------------------ | ------- | ------------------------------------------------ |
| id                 | uuid    |                                                  |
| ticker             | text    |                                                  |
| as_of_date         | date    | snapshot date                                    |
| expiration         | date    |                                                  |
| dte                | int     | days to expiration                               |
| spread_type        | text    | `bull_put` or `bear_call`                        |
| short_strike       | numeric |                                                  |
| long_strike        | numeric |                                                  |
| width              | numeric | strike spread width                              |
| credit             | numeric | per contract, realistic fill (sell bid, buy ask) |
| max_profit         | numeric | credit × 100                                     |
| max_loss           | numeric | (width − credit) × 100                           |
| risk_multiple      | numeric | max_loss / max_profit                            |
| short_delta        | numeric | absolute value                                   |
| prob_otm           | numeric | 1 − abs(short delta), approx                     |
| short_iv           | numeric |                                                  |
| bid_ask_spread_pct | numeric | (ask − bid) / mid, liquidity filter              |
| short_oi           | int     |                                                  |
| long_oi            | int     |                                                  |


Index: `(as_of_date, ticker, dte, risk_multiple)`

---

### `csps_daily`


| column               | type    | notes                              |
| -------------------- | ------- | ---------------------------------- |
| id                   | uuid    |                                    |
| ticker               | text    |                                    |
| as_of_date           | date    |                                    |
| expiration           | date    |                                    |
| dte                  | int     |                                    |
| strike               | numeric |                                    |
| bid                  | numeric | credit received                    |
| delta                | numeric | absolute value                     |
| prob_otm             | numeric | 1 − abs(delta)                     |
| iv                   | numeric |                                    |
| capital_required     | numeric | strike × 100                       |
| annualized_yield_pct | numeric | (bid / strike) × (365 / dte) × 100 |
| breakeven            | numeric | strike − bid                       |
| bid_ask_spread_pct   | numeric |                                    |
| open_interest        | int     |                                    |


Index: `(as_of_date, ticker, dte, annualized_yield_pct DESC)`

---

### `snapshots`

Stores the raw options chain JSON per ticker per date for audit and backtesting. Each row is a single ticker's chain on a given date.


| column      | type        | notes                     |
| ----------- | ----------- | ------------------------- |
| ticker      | text        |                           |
| as_of_date  | date        |                           |
| chain_json  | jsonb       | raw chain from Tradier    |
| ingested_at | timestamptz | wall-clock time of ingest |


---

## Screened universe

Tickers are selected by the following rule at runtime, not a static hardcoded list:

```python
avg_dollar_volume_20d > 50_000_000   # liquid enough
AND has_weekly_options == True
AND 5 <= price <= 500
AND NOT leveraged_etf
AND sector IN ('Technology', 'Communication Services', 'Consumer Discretionary', 'Financials')
```

Seeded with a manually curated watchlist (~30 names: HOOD, PLTR, ACHR, MARA, CLSK, TSLA, NVDA, AMD, etc.) and expanded by the rule above. Universe is refreshed weekly.

---

## Roadmap

### V1 — Screener (MVP) · *in progress*

- yfinance API integration and options chain pull
- Spread computation logic (bull put + bear call, adjacent strikes)
- CSP computation logic
- Liquidity filters (bid-ask spread %, min OI)
- Supabase Postgres schema + migrations
- GitHub Actions nightly cron with idempotent upsert
- Next.js API routes: `/api/spreads`, `/api/csps` with filter params
- Screener UI: TanStack Table with column sorting
- Filter sidebar: delta band, DTE range, risk multiple cap, min prob profit
- Saved filter presets (localStorage, no auth required in V1)
- README, architecture diagram, deployed to Vercel

### V2 — AI layer

- Text-to-filter: natural language input → structured filter params via LLM
- Research scout: "find me a cool robotics stock for CSPs" → LLM with web search → candidate tickers list
- Filter results rendered in the same screener table

### V3 — Backtesting

- Rolling backtest: for each day in history, take top-N screener picks and simulate the trade outcome
- P&L calculation with realistic fill assumptions (mid minus half spread) and assignment logic at expiration
- Results dashboard: equity curve, win rate, average win/loss, max drawdown by strategy

---

## Running locally

> Setup instructions will be added once the pipeline is stable.

**Prerequisites:**

- Python 3.11+
- Node.js 18+
- Supabase account (free tier sufficient)
- Tradier sandbox account (free)

```bash
# Clone
git clone https://github.com/yourusername/premia.git
cd premia

# Python ingestion
cd pipeline
pip install -r requirements.txt
cp .env.example .env  # add Tradier API key + Supabase URL
python ingest.py --date today

# Next.js frontend
cd ../web
npm install
cp .env.example .env.local  # add Supabase connection string
npm run dev
```

---

## Project structure

```
premia/
├── pipeline/
│   ├── ingest.py          # main ingestion script
│   ├── tradier.py         # Tradier API client
│   ├── universe.py        # ticker universe builder
│   ├── spreads.py         # spread computation
│   ├── csps.py            # CSP computation
│   ├── db.py              # Supabase write helpers
│   └── requirements.txt
├── web/
│   ├── app/
│   │   ├── api/
│   │   │   ├── spreads/route.ts
│   │   │   └── csps/route.ts
│   │   ├── screener/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── SpreadTable.tsx
│   │   ├── CspTable.tsx
│   │   └── FilterSidebar.tsx
│   └── package.json
├── .github/
│   └── workflows/
│       └── ingest.yml     # nightly cron at 16:15 ET
├── supabase/
│   └── migrations/        # schema migrations
└── README.md
```

---

## Disclaimer

This tool is for personal research only. Nothing here constitutes financial advice. No warranty is provided. Do not trade solely based on screener output.

---

## License

MIT

## Virtual Env

```
# inside premia
python3.11 -m venv premia_env
source /Users/darshildesai/Documents/projects2/premia/premia_env/bin/activate
python pipeline/ingest.py
```

