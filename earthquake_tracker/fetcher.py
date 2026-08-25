import os
import sys
import json
import requests
from datetime import datetime, timezone

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
from config import USGS_FEED_URL, USGS_DAY_FEED_URL, EMSC_FEED_URL, MIN_MAGNITUDE, HISTORY_FILE
from time_utils import get_earthquake_times

def load_history():
    """Load list of previously posted earthquake IDs."""
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "posted_ids" not in data:
                    data["posted_ids"] = []
                return data
        except Exception:
            return {"posted_ids": []}
    return {"posted_ids": []}

def save_history(history_data):
    """Save updated history to disk."""
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history_data, f, indent=2)

def is_duplicate_event(candidate, existing_list):
    """
    Checks if a candidate earthquake is already present in existing_list
    via geospatial proximity (<120km) and time proximity (<5 minutes).
    """
    c_lat, c_lon, c_time = candidate["latitude"], candidate["longitude"], candidate["epoch_ms"]
    for ex in existing_list:
        time_diff = abs(c_time - ex["epoch_ms"])
        if time_diff < 300000: # within 5 minutes
            # Approximate distance in km
            d_lat = (c_lat - ex["latitude"]) * 111.0
            d_lon = (c_lon - ex["longitude"]) * 111.0 * math.cos(math.radians(c_lat))
            dist_km = math.hypot(d_lat, d_lon)
            if dist_km < 120.0:
                return True
    return False

import math

def fetch_latest_earthquakes():
    """
    Fetches real-time earthquakes (>= MIN_MAGNITUDE) from:
    1. USGS Instant 1-minute real-time stream
    2. USGS 24-hour backup feed
    3. EMSC Global Seismic Portal (fastest for Europe/Asia/Middle East)
    """
    print(f"📡 Polling Real-Time Earthquake Feeds (USGS Real-Time + EMSC Global Network, >= M{MIN_MAGNITUDE})...")
    history = load_history()
    posted_ids = set(history.get("posted_ids", []))
    current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    history_updated = False

    raw_candidates = []

    # 1. Fetch USGS Instant Live Stream
    for u_url in [USGS_FEED_URL, USGS_DAY_FEED_URL]:
        try:
            r = requests.get(u_url, timeout=10)
            if r.status_code == 200:
                data = r.json()
                for item in data.get("features", []):
                    event_id = str(item.get("id"))
                    props = item.get("properties", {})
                    coords = item.get("geometry", {}).get("coordinates", [0, 0, 0])
                    mag = props.get("mag")
                    if mag is None or mag < MIN_MAGNITUDE:
                        continue
                    epoch_ms = props.get("time", 0)
                    raw_candidates.append({
                        "id": event_id,
                        "source": "USGS",
                        "mag": round(float(mag), 1),
                        "place": props.get("place", "Unknown Location"),
                        "latitude": coords[1],
                        "longitude": coords[0],
                        "depth_km": round(coords[2], 1) if len(coords) > 2 else 10.0,
                        "epoch_ms": epoch_ms,
                        "tsunami": props.get("tsunami", 0) == 1,
                        "url": props.get("url", "")
                    })
                break
        except Exception as e:
            print(f"⚠️ USGS feed fetch note: {e}")

    # 2. Fetch EMSC Real-Time Global Stream (often 2-4 minutes faster for global quakes)
    try:
        r_emsc = requests.get(EMSC_FEED_URL, timeout=8)
        if r_emsc.status_code == 200:
            e_data = r_emsc.json()
            for item in e_data.get("features", []):
                p = item.get("properties", {})
                geom = item.get("geometry", {}).get("coordinates", [0, 0, 0])
                mag = p.get("mag")
                if mag is None or float(mag) < MIN_MAGNITUDE:
                    continue
                t_str = p.get("time")
                try:
                    dt = datetime.fromisoformat(t_str.replace("Z", "+00:00"))
                    epoch_ms = int(dt.timestamp() * 1000)
                except Exception:
                    continue

                emsc_id = "emsc_" + str(item.get("id") or p.get("unid"))
                place_name = p.get("flynn_region") or "Unknown Region"
                
                raw_candidates.append({
                    "id": emsc_id,
                    "source": "EMSC",
                    "mag": round(float(mag), 1),
                    "place": place_name,
                    "latitude": geom[1],
                    "longitude": geom[0],
                    "depth_km": round(abs(geom[2]), 1) if len(geom) > 2 else 10.0,
                    "epoch_ms": epoch_ms,
                    "tsunami": False,
                    "url": f"https://www.emsc-csem.org/Earthquake/earthquake.php?id={p.get('unid')}"
                })
    except Exception as e:
        print(f"⚠️ EMSC feed fetch note: {e}")

    new_events = []

    for cand in raw_candidates:
        event_id = cand["id"]
        if event_id in posted_ids:
            continue

        age_minutes = (current_time_ms - cand["epoch_ms"]) / 60000.0

        # Skip events older than 35 minutes and mark as posted
        if age_minutes > 35.0:
            history["posted_ids"].append(event_id)
            history_updated = True
            continue

        # Prevent duplicate reporting between USGS and EMSC for the exact same quake
        if is_duplicate_event(cand, new_events):
            history["posted_ids"].append(event_id)
            history_updated = True
            continue

        # Compute accurate Local and UTC times
        t_data = get_earthquake_times(cand["epoch_ms"], cand["latitude"], cand["longitude"])

        event_data = {
            "id": cand["id"],
            "mag": cand["mag"],
            "place": cand["place"],
            "latitude": cand["latitude"],
            "longitude": cand["longitude"],
            "depth_km": cand["depth_km"],
            "time_utc": t_data["utc_full"],
            "utc_short": t_data["utc_short"],
            "local_time_short": t_data["local_short"],
            "local_time_full": t_data["local_full"],
            "local_voice": t_data["local_voice"],
            "tz_name": t_data["tz_name"],
            "epoch_ms": cand["epoch_ms"],
            "tsunami_alert": cand["tsunami"],
            "url": cand["url"],
            "source": cand["source"]
        }
        new_events.append(event_data)

    if history_updated:
        if len(history["posted_ids"]) > 500:
            history["posted_ids"] = history["posted_ids"][-500:]
        save_history(history)

    print(f"✅ Found {len(new_events)} new unposted earthquake(s) >= M{MIN_MAGNITUDE}")
    return new_events

def mark_event_as_posted(event_id):
    """Adds event_id to history so it won't be reposted."""
    history = load_history()
    if "posted_ids" not in history:
        history["posted_ids"] = []
    if event_id not in history["posted_ids"]:
        history["posted_ids"].append(event_id)
        if len(history["posted_ids"]) > 500:
            history["posted_ids"] = history["posted_ids"][-500:]
        save_history(history)
