#!/usr/bin/env python3
"""Publish additional verified NFL intelligence feeds from nflverse."""
import io, json
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd
import requests

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public"/"data"
OUT.mkdir(parents=True,exist_ok=True)
YEAR=datetime.now(timezone.utc).year
BASE="https://github.com/nflverse/nflverse-data/releases/download"
HEAD={"User-Agent":"GRIDIRON-IQ-data-builder"}
NOW=datetime.now(timezone.utc).isoformat()

def get_parquet(tag,name):
    url=f"{BASE}/{tag}/{name}"
    r=requests.get(url,headers=HEAD,timeout=120)
    r.raise_for_status()
    return pd.read_parquet(io.BytesIO(r.content)),url

def clean(df):
    df=df.copy()
    for c in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[c]):
            df[c]=df[c].astype(str)
    df=df.where(pd.notna(df),None)
    return df.to_dict(orient="records")

def write(name,payload):
    (OUT/name).write_text(json.dumps(payload,separators=(",",":"),allow_nan=False))

def publish(tag,filename,outname,kind,keep=None):
    errors=[]
    for year in (YEAR,YEAR-1):
        try:
            df,url=get_parquet(tag,filename.format(year=year))
            if "season" in df.columns:
                df=df[pd.to_numeric(df["season"],errors="coerce")==year]
            if keep:
                cols=[c for c in keep if c in df.columns]
                df=df[cols]
            records=clean(df)
            write(outname,{"season":year,"source":"nflverse","sourceUrl":url,"retrievedAt":NOW,"recordCount":len(records),"records":records,"warnings":errors})
            print(f"{kind}: {len(records)} rows ({year})")
            return True
        except Exception as e:
            errors.append(f"{year}: {e}")
    write(outname,{"season":None,"source":"nflverse","retrievedAt":NOW,"recordCount":0,"records":[],"error":" | ".join(errors)})
    print(f"{kind}: unavailable: {' | '.join(errors)}")
    return False

# Officially published weekly injury report and practice participation fields.
publish("injuries","injuries_{year}.parquet","nfl-injuries.json","injuries",
 ["season","game_type","team","week","gsis_id","position","full_name","report_primary_injury","report_secondary_injury","report_status","practice_primary_injury","practice_secondary_injury","practice_status","date_modified"])

# Player snap counts (offense, defense, special teams) from Pro Football Reference.
publish("snap_counts","snap_counts_{year}.parquet","nfl-snap-counts.json","snap counts",
 ["game_id","season","game_type","week","player","pfr_player_id","position","team","opponent","offense_snaps","offense_pct","defense_snaps","defense_pct","st_snaps","st_pct"])

# Weekly PFR advanced data. Defensive pressure indicators are charted statistics,
# not universal coverage/assignment grades. Keep only the fields supplied.
adv=[]
errors=[]
for kind in ("pass","rush","rec","def"):
    try:
        df,url=get_parquet("pfr_advstats",f"advstats_week_{kind}_{YEAR}.parquet")
        ids=[c for c in ("game_id","season","week","game_type","team","opponent","pfr_player_name","pfr_player_id","position") if c in df.columns]
        metric=[c for c in df.columns if c not in ids and pd.api.types.is_numeric_dtype(df[c])]
        df=df[ids+metric]
        adv.extend([dict(r,stat_type=kind) for r in clean(df)])
    except Exception as e:
        errors.append(f"{kind}: {e}")
write("nfl-pfr-advanced.json",{"season":YEAR,"source":"Pro Football Reference advanced stats via nflverse","sourceUrls":[f"{BASE}/pfr_advstats/advstats_week_{k}_{YEAR}.parquet" for k in ("pass","rush","rec","def")],"retrievedAt":NOW,"recordCount":len(adv),"records":adv,"warnings":errors,
 "note":"Published weekly PFR advanced statistics. Fields differ by stat group; pressure and charting counts are not the same as full player grades or coverage assignments."})
print(f"PFR advanced: {len(adv)} rows; warnings: {errors}")
