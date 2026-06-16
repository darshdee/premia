"""
>>> premia/pipeline/ingest.py

Bull put spread screener — ingestion layer.

Flow:
  1. For each ticker, resolve expirations within DTE_MIN..DTE_MAX.
  2. Fetch full put chain for each qualifying expiration.
  3. Store every put strike as a raw put row (puts table).
  4. Pair adjacent strikes to build bull put spreads (spreads table).
  5. Upsert puts first, then spreads using resolved FK ids.
"""

import logging
import time
from datetime import date, datetime
from math import erf, log as math_log, sqrt

import numpy as np
import pandas as pd
import yfinance as yf
from dotenv import load_dotenv
from db import upsert_puts, upsert_spreads

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Watchlist
# ---------------------------------------------------------------------------
TICKERS: list[str] = [
    "HOOD", 
    "PLTR", "COIN",
    "AAPL", "NFLX", "CRM", "SNOW", "RBLX", "UBER",
    # "ACHR", "MARA", "CLSK",
    # "IONQ", "RGTI", "LUNR", "JOBY", "RIVN",
    # "NVDA", "AMD", "TSLA", "META", "GOOGL", "AMZN", "MSFT",
]

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DTE_MIN: int = 14
DTE_MAX: int = 21
MAX_SPREAD_WIDTH: float = 3.0
RISK_FREE_RATE: float = 0.05
MAX_RETRIES: int = 5
BASE_WAIT: float = 1.25


# ---------------------------------------------------------------------------
# Math helpers
# ---------------------------------------------------------------------------
def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + erf(x / sqrt(2.0)))


def _bs_put_delta(S: float, K: float, T: float, r: float, iv: float) -> float | None:
    if T <= 0 or iv <= 0 or S <= 0 or K <= 0:
        return None
    try:
        d1 = (math_log(S / K) + (r + 0.5 * iv ** 2) * T) / (iv * sqrt(T))
        return _norm_cdf(d1) - 1.0
    except (ValueError, ZeroDivisionError):
        return None


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------
def _dte(exp_str: str, today: date) -> int:
    return (datetime.strptime(exp_str, "%Y-%m-%d").date() - today).days


def _target_expirations(ticker_obj: yf.Ticker, today: date) -> list[str]:
    return [
        exp for exp in ticker_obj.options
        if DTE_MIN <= _dte(exp, today) <= DTE_MAX
    ]


def _fetch_puts_with_backoff(
    ticker_obj: yf.Ticker,
    exp: str,
    max_retries: int = MAX_RETRIES,
    base_wait: float = BASE_WAIT,
) -> pd.DataFrame:
    symbol = ticker_obj.ticker
    for attempt in range(max_retries):
        try:
            chain = ticker_obj.option_chain(exp)
            return chain.puts.sort_values("strike", ascending=False).reset_index(drop=True)
        except Exception as exc:
            wait = base_wait * (2 ** attempt)
            log.warning(
                "%s %s — fetch failed (attempt %d/%d): %s. Retrying in %.1fs.",
                symbol, exp, attempt + 1, max_retries, exc, wait,
            )
            time.sleep(wait)
    raise RuntimeError(f"Gave up fetching {symbol} {exp} after {max_retries} attempts.")


# ---------------------------------------------------------------------------
# Per-ticker processing
# ---------------------------------------------------------------------------
def _process_ticker(
    ticker: str,
    today: date,
    risk_free_rate: float = RISK_FREE_RATE,
) -> tuple[list[dict], list[dict]]:
    """
    Fetch and normalise one ticker's put chain into DB-ready row dicts.

    For each expiration in the DTE window (DTE_MIN..DTE_MAX):
      1. Pull the full put chain (sorted high → low strike).
      2. Emit one put row per strike with bid/ask, IV, BS delta, and liquidity.
      3. Pair adjacent strikes into bull put spreads where:
           - width is in (0, MAX_SPREAD_WIDTH]
           - credit = short bid − long ask is positive
           - max_profit and max_loss are both positive

    Args:
        ticker:          Underlying symbol (e.g. "AAPL").
        today:           Snapshot date; written to run_date on every row.
        risk_free_rate:  Annual rate for Black-Scholes delta (default RISK_FREE_RATE).

    Returns:
        (put_rows, spread_rows) — two lists of plain dicts matching the
        `puts` and `spreads` table schemas. Empty lists if the ticker has
        no price history or no expirations in range.
    """
    t = yf.Ticker(ticker)

    hist = t.history(period="1d")
    if hist.empty:
        log.warning("%s — no price history, skipping.", ticker)
        return [], []
    current_price: float = hist["Close"].iloc[-1]

    expirations = _target_expirations(t, today)
    if not expirations:
        log.info("%s — no expirations in %d–%d DTE window.", ticker, DTE_MIN, DTE_MAX)
        return [], []

    log.info("%s @ %.2f — scanning %d expiration(s): %s",
             ticker, current_price, len(expirations), expirations)

    put_rows:    list[dict] = []
    spread_rows: list[dict] = []

    for exp in expirations:
        dte = _dte(exp, today)
        T = max(dte / 365.0, 1 / 365.0)

        try:
            puts = _fetch_puts_with_backoff(t, exp)
        except RuntimeError as exc:
            log.error(str(exc))
            continue

        # --- build put rows (every strike) ---
        for _, row in puts.iterrows():
            iv = row.get("impliedVolatility", np.nan)
            iv = float(iv) if (iv is not None and not np.isnan(iv) and iv > 0) else None

            strike = float(row["strike"])
            delta  = _bs_put_delta(current_price, strike, T, risk_free_rate, iv) if iv else None
            prob_profit = (1.0 - abs(delta)) if delta is not None else None

            put_rows.append({
                "ticker":        ticker,
                "run_date":      today.isoformat(),
                "expiration":    exp,
                "dte":           dte,
                "strike":        strike,
                "current_price": round(current_price, 2),
                "bid":           float(row["bid"])               if pd.notna(row.get("bid"))           else None,
                "ask":           float(row["ask"])               if pd.notna(row.get("ask"))           else None,
                "iv":            round(iv, 4)                    if iv is not None                     else None,
                "delta":         round(delta, 4)                 if delta is not None                  else None,
                "prob_profit":   round(prob_profit, 4)           if prob_profit is not None            else None,
                "volume":        int(row["volume"])              if pd.notna(row.get("volume"))        else None,
                "open_interest": int(row["openInterest"])        if pd.notna(row.get("openInterest")) else None,
            })

        # --- build spread rows (adjacent pairs) ---
        for i in range(len(puts) - 1):
            sell = puts.iloc[i]
            buy  = puts.iloc[i + 1]

            sell_strike = float(sell["strike"])
            buy_strike  = float(buy["strike"])
            width = sell_strike - buy_strike

            if width <= 0 or width > MAX_SPREAD_WIDTH:
                continue

            credit = sell["bid"] - buy["ask"]
            if credit <= 0:
                continue

            max_profit = credit * 100.0
            max_loss   = (width - credit) * 100.0
            if max_profit <= 0 or max_loss <= 0:
                continue

            spread_rows.append({
                "ticker":        ticker,
                "run_date":      today.isoformat(),
                "expiration":    exp,
                "sell_strike":   sell_strike,
                "buy_strike":    buy_strike,
                "width":         width,
                "credit":        round(credit, 2),
                "max_profit":    round(max_profit, 2),
                "max_loss":      round(max_loss, 2),
                "risk_multiple": round(max_loss / max_profit, 2),
                "spread_type":   "bull_put",
            })

    log.info("%s — %d put(s), %d spread(s).", ticker, len(put_rows), len(spread_rows))
    return put_rows, spread_rows


# ---------------------------------------------------------------------------
# Top-level entry point
# ---------------------------------------------------------------------------
def ingest(
    tickers: list[str] = TICKERS,
    risk_free_rate: float = RISK_FREE_RATE,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    today = date.today()

    all_puts:    list[dict] = []
    all_spreads: list[dict] = []

    for ticker in tickers:
        put_rows, spread_rows = _process_ticker(ticker, today, risk_free_rate=risk_free_rate)
        all_puts.extend(put_rows)
        all_spreads.extend(spread_rows)

    puts_df    = pd.DataFrame(all_puts)
    spreads_df = pd.DataFrame(all_spreads)

    if not spreads_df.empty:
        spreads_df.sort_values("risk_multiple", ascending=True, inplace=True)
        spreads_df.reset_index(drop=True, inplace=True)

    return puts_df, spreads_df


def main():
    puts_df, spreads_df = ingest()

    if puts_df.empty:
        print("No puts found.")
        return

    print(f"\nPuts:    {len(puts_df)} rows across {puts_df['ticker'].nunique()} ticker(s)")
    print(f"Spreads: {len(spreads_df)} rows\n")

    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 160)

    if not spreads_df.empty:
        print(spreads_df[[
            "ticker", "expiration", "sell_strike", "buy_strike", "width",
            "credit", "max_profit", "max_loss", "risk_multiple",
        ]].to_string(index=False))

    # --- write to supabase ---
    id_map = upsert_puts(puts_df)
    upsert_spreads(spreads_df, id_map)


if __name__ == "__main__":
    main()
