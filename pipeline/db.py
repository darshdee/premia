"""
premia/pipeline/db.py

Supabase write layer.

Two-step upsert:
  1. upsert_puts(df)    — writes raw put legs to `puts` table, returns id map
  2. upsert_spreads(df) — writes derived spreads to `spreads` table using put ids
"""

import logging
import os

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

log = logging.getLogger(__name__)

PUTS_TABLE    = "puts"
SPREADS_TABLE = "spreads"
BATCH_SIZE    = 200

# columns that must be integers in Postgres
PUTS_INT_COLS    = ["dte", "volume", "open_interest"]
SPREADS_INT_COLS: list[str] = []


def _get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
        )
    return create_client(url, key)


def _clean(df: pd.DataFrame, int_cols: list[str]) -> pd.DataFrame:
    """
    - Replace inf/-inf and NaN with None (JSON-safe nulls)
    - Cast integer columns to pandas Int64 (nullable int) so they
      serialise as 14 not 14.0, even when NaNs are present
    """
    df = df.copy()
    df = df.replace([float("inf"), float("-inf")], None)
    for col in int_cols:
        if col in df.columns:
            df[col] = pd.array(df[col], dtype="Int64")  # nullable integer
    df = df.where(pd.notna(df), other=None)
    return df


def upsert_puts(puts_df: pd.DataFrame) -> dict[tuple, int]:
    """
    Upsert raw put rows into `puts` table.

    Returns a dict mapping (ticker, run_date, expiration, strike) -> put.id
    so the spread builder can resolve foreign keys.
    """
    if puts_df.empty:
        log.warning("upsert_puts called with empty DataFrame.")
        return {}

    required = ["ticker", "run_date", "expiration", "dte", "strike", "current_price"]
    missing = [c for c in required if c not in puts_df.columns]
    if missing:
        raise ValueError(f"puts_df missing columns: {missing}")

    df = puts_df.copy()
    for col in ("run_date", "expiration"):
        df[col] = df[col].astype(str)
    df = _clean(df, PUTS_INT_COLS)

    records = df.to_dict(orient="records")
    client = _get_client()

    all_rows = []
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        response = (
            client.table(PUTS_TABLE)
            .upsert(batch, on_conflict="ticker,run_date,expiration,strike")
            .execute()
        )
        all_rows.extend(response.data)
        log.info("puts: upserted batch %d–%d.", i + 1, i + len(batch))

    # build lookup map: (ticker, run_date, expiration, strike) -> id
    id_map: dict[tuple, int] = {
        (row["ticker"], row["run_date"], row["expiration"], float(row["strike"])): row["id"]
        for row in all_rows
    }

    log.info("puts: %d rows upserted, id map built (%d entries).", len(all_rows), len(id_map))
    return id_map


def upsert_spreads(spreads_df: pd.DataFrame, id_map: dict[tuple, int]) -> int:
    """
    Upsert spread rows into `spreads` table.

    Resolves sell_put_id and buy_put_id from id_map before inserting.
    Skips any spread where either leg id cannot be resolved.
    """
    if spreads_df.empty:
        log.warning("upsert_spreads called with empty DataFrame.")
        return 0

    required = ["ticker", "run_date", "expiration", "sell_strike", "buy_strike",
                "width", "credit", "max_profit", "max_loss", "risk_multiple", "spread_type"]
    missing = [c for c in required if c not in spreads_df.columns]
    if missing:
        raise ValueError(f"spreads_df missing columns: {missing}")

    df = spreads_df.copy()
    for col in ("run_date", "expiration"):
        df[col] = df[col].astype(str)

    records = []
    skipped = 0

    for _, row in df.iterrows():
        sell_key = (row["ticker"], row["run_date"], row["expiration"], float(row["sell_strike"]))
        buy_key  = (row["ticker"], row["run_date"], row["expiration"], float(row["buy_strike"]))

        sell_id = id_map.get(sell_key)
        buy_id  = id_map.get(buy_key)

        if sell_id is None or buy_id is None:
            log.warning("Could not resolve put ids for spread %s %s %s/%s — skipping.",
                        row["ticker"], row["expiration"], row["sell_strike"], row["buy_strike"])
            skipped += 1
            continue

        records.append({
            "sell_put_id":   sell_id,
            "buy_put_id":    buy_id,
            "width":         float(row["width"]),
            "credit":        float(row["credit"]),
            "max_profit":    float(row["max_profit"]),
            "max_loss":      float(row["max_loss"]),
            "risk_multiple": float(row["risk_multiple"]),
            "spread_type":   row["spread_type"],
        })

    if not records:
        log.warning("No spread records to upsert after id resolution.")
        return 0

    client = _get_client()
    total = 0

    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        client.table(SPREADS_TABLE) \
            .upsert(batch, on_conflict="sell_put_id,buy_put_id") \
            .execute()
        total += len(batch)
        log.info("spreads: upserted batch %d–%d.", i + 1, i + len(batch))

    log.info("spreads: %d rows upserted, %d skipped.", total, skipped)
    return total
