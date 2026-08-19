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
from config import USGS_FEED_URL, MIN_MAGNITUDE, HISTORY_FILE

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

def fetch_latest_earthquakes():
    """
    Fetches real-time earthquakes from USGS (>= MIN_MAGNITUDE)
    that have not yet been posted.
    """
    print(f"📡 Fetching latest earthquake data (>= M{MIN_MAGNITUDE}) from USGS...")
    history = load_history()
    posted_ids = set(history.get("posted_ids", []))

    try:
        response = requests.get(USGS_FEED_URL, timeout=15)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"❌ Error fetching USGS data: {e}")
        return []

    features = data.get("features", [])
    new_events = []

    for item in features:
        event_id = item.get("id")
        props = item.get("properties", {})
        geometry = item.get("geometry", {})
        coords = geometry.get("coordinates", [0, 0, 0])

        mag = props.get("mag")
        if mag is None or mag < MIN_MAGNITUDE:
            continue

        if event_id in posted_ids:
            continue

        epoch_ms = props.get("time", 0)
        event_time_utc = datetime.fromtimestamp(epoch_ms / 1000.0, tz=timezone.utc)
        formatted_time = event_time_utc.strftime("%B %d, %Y at %H:%M UTC")

        place = props.get("place", "Unknown Location")
        tsunami = props.get("tsunami", 0) == 1
        depth_km = round(coords[2], 1) if len(coords) > 2 else 10.0
        longitude = coords[0]
        latitude = coords[1]
        url = props.get("url", "")

        event_data = {
            "id": event_id,
            "mag": round(mag, 1),
            "place": place,
            "latitude": latitude,
            "longitude": longitude,
            "depth_km": depth_km,
            "time_utc": formatted_time,
            "epoch_ms": epoch_ms,
            "tsunami_alert": tsunami,
            "url": url
        }
        new_events.append(event_data)

    print(f"✅ Found {len(new_events)} new earthquake(s) >= M{MIN_MAGNITUDE}")
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
