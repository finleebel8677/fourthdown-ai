#!/usr/bin/env python3
"""Build verified NGS metric summaries and walk-forward NFL matchup predictions."""
from __future__ import annotations
import io, json, math, sys
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://github.com/nflverse/nflverse-data/releases/download"
HEADERS = {"User-Agent": "GRIDIRON-IQ-data-builder"}
TIMEOUT = 180

def fetch_parquet(tag: str, filename: str) -> tuple[pd.DataFrame, str]:
    url = f"{BASE}/{tag}/{filename}"
    response = requests.get(url, timeout=TIMEOUT, headers=HEADERS)
    response.raise_for_status()
    return pd.read_parquet(io.BytesIO(response.content)), url

def write_json(name: str, payload: dict) -> None:
    (OUT / name).write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False))

def num(series, default=0.0):
    return pd.to_numeric(series, errors="coerce").fillna(default)

def build_ngs():
    tables, errors, sources = [], [], []
    for kind in ("passing", "receiving", "rushing"):
        try:
            frame, url = fetch_parquet("nextgen_stats", f"ngs_{kind}.parquet")
            frame["metric_type"] = kind
            tables.append(frame)
            sources.append(url)
        except Exception as exc:
            errors.append(f"{kind}: {exc}")
    if not tables:
        raise RuntimeError("No published NGS metric tables could be downloaded: " + " | ".join(errors))
    all_rows = pd.concat(tables, ignore_index=True, sort=False)
    season_col = "season" if "season" in all_rows.columns else None
    if season_col:
        all_rows[season_col] = num(all_rows[season_col]).astype(int)
        latest = int(all_rows[season_col].max())
        all_rows = all_rows[all_rows[season_col] == latest]
    else:
        latest = None
    # Keep published, player-level NGS metrics only. Deliberately exclude coordinates.
    identity = [c for c in ("player_gsis_id", "player_id", "player_display_name", "player_position", "team_abbr", "season", "season_type", "week", "metric_type") if c in all_rows.columns]
    metric_candidates = [
        "avg_time_to_throw", "avg_completed_air_yards", "avg_intended_air_yards",
        "aggressiveness", "max_completed_air_yards", "avg_air_yards_differential",
        "avg_air_yards_to_sticks", "passer_rating", "completion_percentage",
        "expected_completion_percentage", "completion_percentage_above_expectation",
        "avg_air_yards", "avg_yac", "avg_expected_yac", "avg_yac_above_expectation",
        "avg_cushion", "avg_separation", "avg_tracking_speed", "max_speed",
        "avg_speed", "rush_yards_over_expected", "rush_yards_over_expected_per_att",
        "efficiency", "percent_attempts_gte_eight_defenders", "receptions", "targets",
        "attempts", "pass_yards", "rush_yards", "rec_yards"
    ]
    metrics = [c for c in metric_candidates if c in all_rows.columns]
    if not metrics:
        # Preserve any numeric published columns not part of the identity.
        metrics = [c for c in all_rows.select_dtypes(include=["number"]).columns if c not in identity]
    keep = identity + metrics
    out = all_rows[keep].copy()
    for col in metrics:
        out[col] = pd.to_numeric(out[col], errors="coerce").round(3)
    out = out.replace({np.nan: None})
    records = out.to_dict(orient="records")
    write_json("nfl-ngs-metrics.json", {
        "season": latest, "source": "nflverse nextgen_stats",
        "sourceUrls": sources, "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "recordCount": len(records), "coordinatesAvailable": False,
        "metricTypes": sorted(out["metric_type"].dropna().unique().tolist()) if "metric_type" in out else [],
        "metrics": records,
        "note": "Published tracking-derived player metrics only. This dataset does not contain raw player x/y coordinates or frame-by-frame routes.",
        "warnings": errors
    })
    print(f"NGS: saved {len(records)} published player metric rows for {latest}; no coordinates.")

STAT_DEFAULTS = {
    "off_epa": 0.0, "off_success": 0.42, "pass_epa": 0.0, "rush_epa": 0.0,
    "off_yards": 5.2, "off_plays": 60.0, "turnovers": 1.2, "third_down": 0.38,
    "redzone_td": 0.55, "points_for": 22.0,
    "def_epa": 0.0, "def_success": 0.42, "pass_epa_allowed": 0.0,
    "rush_epa_allowed": 0.0, "yards_allowed": 5.2, "plays_defended": 60.0,
    "turnovers_forced": 1.2, "third_down_allowed": 0.38,
    "redzone_td_allowed": 0.55, "points_against": 22.0
}
FEATURE_KEYS = [
    "off_epa","off_success","pass_epa","rush_epa","off_yards","turnovers","third_down","redzone_td","points_for",
    "def_epa","def_success","pass_epa_allowed","rush_epa_allowed","yards_allowed","turnovers_forced","third_down_allowed","redzone_td_allowed","points_against"
]

def safe_mean(values, default):
    vals = [float(v) for v in values if v is not None and math.isfinite(float(v))]
    return float(np.mean(vals)) if vals else float(default)

def build_predictions():
    pbp, pbp_url = fetch_parquet("pbp", f"play_by_play_{datetime.now(timezone.utc).year}.parquet")
    schedules, schedule_url = fetch_parquet("schedules", "games.parquet")
    # Current season may not be posted yet; retry latest available PBP release only on current-year 404.
    # (The normal workflow uses the actual season year.)
    if "season" not in pbp or "game_id" not in pbp:
        raise RuntimeError("nflverse play-by-play is missing season/game_id fields")
    pbp["season"] = num(pbp["season"]).astype(int)
    if "play_type" not in pbp:
        raise RuntimeError("nflverse play-by-play is missing play_type")
    plays = pbp[pbp["play_type"].isin(["pass", "run", "rush"])].copy()
    if "posteam" not in plays or "defteam" not in plays:
        raise RuntimeError("nflverse play-by-play is missing posteam/defteam")
    for c in ("epa","success","yards_gained","interception","fumble_lost","first_down","down","yardline_100","touchdown","pass","rush"):
        if c not in plays: plays[c] = 0
        plays[c] = num(plays[c])
    plays["pass"] = plays["play_type"].eq("pass").astype(int)
    plays["rush"] = plays["play_type"].isin(["run","rush"]).astype(int)
    plays["turnover"] = ((plays["interception"] > 0) | (plays["fumble_lost"] > 0)).astype(int)
    plays["third_down_try"] = (plays["down"] == 3).astype(int)
    plays["third_down_conv"] = ((plays["down"] == 3) & (plays["first_down"] > 0)).astype(int)
    plays["redzone_try"] = (plays["yardline_100"] <= 20).astype(int)
    plays["redzone_td"] = ((plays["yardline_100"] <= 20) & (plays["touchdown"] > 0)).astype(int)

    def aggregate(group):
        def mean(col, mask=None):
            x = group if mask is None else group[mask]
            return float(x[col].mean()) if len(x) else None
        third = group[group["third_down_try"] > 0]
        rz = group[group["redzone_try"] > 0]
        return {
            "epa": mean("epa"), "success": mean("success"), "yards": mean("yards_gained"),
            "plays": int(len(group)), "turnovers": int(group["turnover"].sum()),
            "pass_epa": mean("epa", group["play_type"].eq("pass")),
            "rush_epa": mean("epa", group["play_type"].isin(["run","rush"])),
            "third_down": float(third["third_down_conv"].mean()) if len(third) else None,
            "redzone_td": float(rz["redzone_td"].mean()) if len(rz) else None,
        }
    offense = {}
    for (gid, team), group in plays.dropna(subset=["game_id","posteam"]).groupby(["game_id","posteam"]):
        offense[(str(gid), str(team))] = aggregate(group)
    defense = {}
    for (gid, team), group in plays.dropna(subset=["game_id","defteam"]).groupby(["game_id","defteam"]):
        defense[(str(gid), str(team))] = aggregate(group)

    schedules = schedules.copy()
    if "game_id" not in schedules:
        raise RuntimeError("nflverse schedule table is missing game_id")
    schedules["season"] = num(schedules["season"]).astype(int)
    if "game_type" in schedules:
        schedules = schedules[schedules["game_type"].isin(["REG","POST"])]
    schedules = schedules[schedules["season"] >= 2010]
    schedules["sort_date"] = pd.to_datetime(schedules.get("gameday", pd.Series(index=schedules.index, dtype=str)), errors="coerce")
    schedules = schedules.sort_values(["sort_date","season","week"], na_position="last")
    history = defaultdict(lambda: deque(maxlen=10))
    training_x, training_y, training_years = [], [], []
    game_rows = []
    for _, g in schedules.iterrows():
        gid = str(g["game_id"])
        home, away = str(g.get("home_team","")), str(g.get("away_team",""))
        if not home or not away or home == "nan" or away == "nan": continue
        hhist, ahist = list(history[home]), list(history[away])
        hstats, astats = {}, {}
        for key in FEATURE_KEYS:
            hstats[key] = safe_mean([x.get(key) for x in hhist], STAT_DEFAULTS[key])
            astats[key] = safe_mean([x.get(key) for x in ahist], STAT_DEFAULTS[key])
        # Model learns the home result from the matchup-specific offense-vs-defense profile.
        x = [
            hstats["off_epa"] - astats["def_epa"], hstats["off_success"] - astats["def_success"],
            hstats["pass_epa"] - astats["pass_epa_allowed"], hstats["rush_epa"] - astats["rush_epa_allowed"],
            hstats["off_yards"] - astats["yards_allowed"], astats["turnovers_forced"] - hstats["turnovers"],
            hstats["third_down"] - astats["third_down_allowed"], hstats["redzone_td"] - astats["redzone_td_allowed"],
            hstats["points_for"] - astats["points_against"],
            astats["off_epa"] - hstats["def_epa"], astats["off_success"] - hstats["def_success"],
            astats["pass_epa"] - hstats["pass_epa_allowed"], astats["rush_epa"] - hstats["rush_epa_allowed"],
            astats["off_yards"] - hstats["yards_allowed"], hstats["turnovers_forced"] - astats["turnovers"],
            astats["third_down"] - hstats["third_down_allowed"], astats["redzone_td"] - hstats["redzone_td_allowed"],
            astats["points_for"] - hstats["points_against"], 1.0
        ]
        hs, aws = g.get("home_score"), g.get("away_score")
        completed = pd.notna(hs) and pd.notna(aws)
        if completed:
            try:
                hs, aws = float(hs), float(aws)
                if len(hhist) >= 2 and len(ahist) >= 2:
                    training_x.append(x); training_y.append(1 if hs > aws else 0); training_years.append(int(g["season"]))
            except Exception:
                completed = False
        game_rows.append({"game_id":gid,"season":int(g["season"]),"week":int(g.get("week") or 0),
                          "home_team":home,"away_team":away,"home_score":hs if completed else None,
                          "away_score":aws if completed else None,"completed":bool(completed),
                          "features":x,"home_stats":hstats,"away_stats":astats})
        # Update team rolling form only after feature creation (prevents leakage).
        for team, opp in ((home,away),(away,home)):
            o = offense.get((gid,team), {})
            d = defense.get((gid,team), {})
            rec = {k:STAT_DEFAULTS[k] for k in FEATURE_KEYS}
            rec.update({
                "off_epa":o.get("epa"),"off_success":o.get("success"),"pass_epa":o.get("pass_epa"),
                "rush_epa":o.get("rush_epa"),"off_yards":o.get("yards"),"off_plays":o.get("plays"),
                "turnovers":o.get("turnovers"),"third_down":o.get("third_down"),"redzone_td":o.get("redzone_td"),
                "def_epa":d.get("epa"),"def_success":d.get("success"),"pass_epa_allowed":d.get("pass_epa"),
                "rush_epa_allowed":d.get("rush_epa"),"yards_allowed":d.get("yards"),"plays_defended":d.get("plays"),
                "turnovers_forced":d.get("turnovers"),"third_down_allowed":d.get("third_down"),
                "redzone_td_allowed":d.get("redzone_td"),
                "points_for":float(hs if team==home and completed else aws if team==away and completed else STAT_DEFAULTS["points_for"]),
                "points_against":float(aws if team==home and completed else hs if team==away and completed else STAT_DEFAULTS["points_against"])
            })
            history[team].append(rec)

    if len(training_y) < 300 or len(set(training_y)) < 2:
        raise RuntimeError(f"Not enough historical game samples to validate a prediction model ({len(training_y)} samples)")
    years = sorted(set(training_years))
    holdout_year = years[-1]
    train_idx = [i for i,y in enumerate(training_years) if y < holdout_year]
    test_idx = [i for i,y in enumerate(training_years) if y == holdout_year]
    if len(train_idx) < 200 or len(test_idx) < 50:
        holdout_year = years[-2] if len(years)>1 else years[-1]
        train_idx = [i for i,y in enumerate(training_years) if y < holdout_year]
        test_idx = [i for i,y in enumerate(training_years) if y == holdout_year]
    if len(train_idx) < 100 or len(test_idx) < 30:
        raise RuntimeError("Not enough chronological holdout data to validate model quality")
    validation = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.7))
    validation.fit(np.array(training_x)[train_idx], np.array(training_y)[train_idx])
    test_prob = validation.predict_proba(np.array(training_x)[test_idx])[:,1]
    test_pred = (test_prob >= .5).astype(int)
    accuracy = float(accuracy_score(np.array(training_y)[test_idx], test_pred))
    brier = float(brier_score_loss(np.array(training_y)[test_idx], test_prob))
    final_model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.7))
    final_model.fit(np.array(training_x), np.array(training_y))

    upcoming = [g for g in game_rows if not g["completed"]]
    upcoming.sort(key=lambda g:(g["season"],g["week"],g["game_id"]))
    predictions = []
    for g in upcoming[:32]:
        prob = float(final_model.predict_proba([g["features"]])[0,1])
        h, a = g["home_stats"], g["away_stats"]
        # Transparent score estimate from recent points scored and allowed.
        hp = max(0.0, (h["points_for"] + a["points_against"]) / 2)
        ap = max(0.0, (a["points_for"] + h["points_against"]) / 2)
        dimensions = [
            ("Offensive efficiency", h["off_epa"]-a["def_epa"], a["off_epa"]-h["def_epa"]),
            ("Third down", h["third_down"]-a["third_down_allowed"], a["third_down"]-h["third_down_allowed"]),
            ("Red zone", h["redzone_td"]-a["redzone_td_allowed"], a["redzone_td"]-h["redzone_td_allowed"]),
            ("Points profile", h["points_for"]-a["points_against"], a["points_for"]-h["points_against"]),
        ]
        edges=[]
        for label, hv, av in dimensions:
            if hv > av + .025: edges.append({"category":label,"team":g["home_team"],"difference":round(hv-av,3)})
            elif av > hv + .025: edges.append({"category":label,"team":g["away_team"],"difference":round(av-hv,3)})
            else: edges.append({"category":label,"team":"Even","difference":round(hv-av,3)})
        predictions.append({
            "gameId":g["game_id"],"season":g["season"],"week":g["week"],
            "homeTeam":g["home_team"],"awayTeam":g["away_team"],
            "homeWinProbability":round(prob,4),"awayWinProbability":round(1-prob,4),
            "projectedHomePoints":round(hp,1),"projectedAwayPoints":round(ap,1),
            "projectedScoreMethod":"Average of each team's trailing points scored and opponent points allowed; descriptive estimate, not a guaranteed result.",
            "advantages":edges,"sampleGamesHome":10,"sampleGamesAway":10,
            "homeFormGames":min(10, len(history[g["home_team"]])),
            "awayFormGames":min(10, len(history[g["away_team"]])),
            "dataNote":"Probabilities are generated by a logistic-regression model trained on historical NFL play-by-play, using pregame rolling team form. No sportsbook odds or AI-generated stats are used."
        })
    payload = {
        "season":int(schedules["season"].max()),"source":"nflverse play-by-play + schedules",
        "sourceUrls":[pbp_url,schedule_url],"retrievedAt":datetime.now(timezone.utc).isoformat(),
        "model":{"name":"GRIDIRON IQ rolling-form logistic regression","trainingGames":len(training_y),
                 "trainingSeasons":[min(years),max(years)],"holdoutSeason":int(holdout_year),
                 "holdoutGames":len(test_idx),"holdoutAccuracy":round(accuracy,4),
                 "holdoutBrierScore":round(brier,4),
                 "validationMethod":"Chronological season holdout; each game uses only team games played before that matchup.",
                 "features":FEATURE_KEYS + ["home_field_advantage"]},
        "predictionCount":len(predictions),"predictions":predictions,
        "limitations":["Probabilities are estimates, not guarantees.","Injuries and inactive lists are not included unless present in the underlying play-by-play inputs.","Early-season predictions rely on limited current-season form and neutral defaults where necessary.","Projected scores are simple recent scoring/allowance estimates, not a separate trained score model."]
    }
    write_json("nfl-matchup-predictions.json",payload)
    print(f"Predictions: {len(predictions)} upcoming games; holdout accuracy {accuracy:.3f} on {len(test_idx)} games in {holdout_year}.")

def main():
    errors=[]
    try: build_ngs()
    except Exception as exc:
        errors.append("NGS metrics: "+str(exc))
        write_json("nfl-ngs-metrics.json",{"source":"nflverse nextgen_stats","retrievedAt":datetime.now(timezone.utc).isoformat(),"coordinatesAvailable":False,"recordCount":0,"metrics":[],"error":str(exc)})
        print(errors[-1],file=sys.stderr)
    try: build_predictions()
    except Exception as exc:
        errors.append("Matchup predictions: "+str(exc))
        write_json("nfl-matchup-predictions.json",{"source":"nflverse play-by-play + schedules","retrievedAt":datetime.now(timezone.utc).isoformat(),"predictionCount":0,"predictions":[],"error":str(exc)})
        print(errors[-1],file=sys.stderr)
        raise
    if errors: print("Completed with optional data warnings: "+" | ".join(errors))

if __name__ == "__main__":
    main()
