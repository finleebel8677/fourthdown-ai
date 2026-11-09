#!/usr/bin/env python3
"""Build lightweight, real NFL player-stat JSON from nflverse releases."""
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)
YEAR = datetime.now(timezone.utc).year
BASE = "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{year}.parquet"
STAT_COLUMNS = [
    "passing_yards", "passing_tds", "interceptions",
    "rushing_yards", "rushing_tds", "carries",
    "receiving_yards", "receiving_tds", "receptions", "targets"
]

def fetch_season(year):
    url = BASE.format(year=year)
    response = requests.get(url, timeout=120, headers={"User-Agent": "GRIDIRON-IQ-data-builder"})
    if response.status_code != 200:
        raise RuntimeError(f"{year} release returned HTTP {response.status_code}")
    frame = pd.read_parquet(io.BytesIO(response.content))
    if "season_type" in frame.columns:
        frame = frame[frame["season_type"].astype(str).str.upper().eq("REG")]
    if frame.empty:
        raise RuntimeError(f"{year} regular-season file contains no rows yet")
    return frame, url

errors = []
frame = None
source_url = None
season_used = None
for year in (YEAR, YEAR - 1):
    try:
        frame, source_url = fetch_season(year)
        season_used = year
        break
    except Exception as exc:
        errors.append(f"{year}: {exc}")

if frame is None:
    raise SystemExit("Could not download NFL stats: " + " | ".join(errors))

name_col = "player_display_name" if "player_display_name" in frame.columns else "player_name"
id_col = "player_id" if "player_id" in frame.columns else name_col
team_col = "recent_team" if "recent_team" in frame.columns else ("team" if "team" in frame.columns else None)
required = [name_col, id_col]
if any(col not in frame.columns for col in required):
    raise SystemExit("The nflverse file is missing player identity columns")

for col in STAT_COLUMNS:
    if col not in frame.columns:
        alternate = {"interceptions": "passing_interceptions", "carries": "rushing_attempts"}.get(col)
        if alternate and alternate in frame.columns:
            frame[col] = frame[alternate]
        else:
            frame[col] = 0
    frame[col] = pd.to_numeric(frame[col], errors="coerce").fillna(0)

sort_cols = [c for c in ("week", "game_id") if c in frame.columns]
if sort_cols:
    frame = frame.sort_values(sort_cols)

players = []
for player_id, group in frame.groupby(id_col, dropna=False):
    first = group.iloc[0]
    teams = []
    if team_col:
        teams = [str(t) for t in group[team_col].dropna().unique() if str(t).strip()]
    weeks = sorted({int(w) for w in pd.to_numeric(group.get("week", pd.Series(dtype=float)), errors="coerce").dropna() if w > 0})
    record = {
        "id": str(player_id),
        "name": str(first.get(name_col, "")),
        "position": str(first.get("position", "")) if pd.notna(first.get("position", "")) else "",
        "teams": teams,
        "weeks": weeks,
        "games": len(weeks),
    }
    for col in STAT_COLUMNS:
        record[col] = round(float(group[col].sum()), 2)
    if record["name"] and record["name"] != "nan":
        players.append(record)

players.sort(key=lambda p: p["name"].lower())
retrieved = datetime.now(timezone.utc).isoformat()
payload = {
    "season": season_used,
    "isCurrentSeason": season_used == YEAR,
    "retrievedAt": retrieved,
    "source": "nflverse",
    "sourceUrl": source_url,
    "totalPlayers": len(players),
    "players": players,
}
(OUT / "nfl-players.json").write_text(json.dumps(payload, separators=(",", ":")))
status = {k: v for k, v in payload.items() if k != "players"}
(OUT / "nfl-status.json").write_text(json.dumps(status, separators=(",", ":")))
print(f"Saved {len(players)} real player records for {season_used}")
