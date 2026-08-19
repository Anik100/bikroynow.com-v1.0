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
    """Load list of previously posted earthquake IDs and photo tracking by date."""
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "posted_ids" not in data:
                    data["posted_ids"] = []
                if "photo_posts_by_date" not in data:
                    data["photo_posts_by_date"] = {}
                return data
        except Exception:
            return {"posted_ids": [], "photo_posts_by_date": {}}
    return {"posted_ids": [], "photo_posts_by_date": {}}

def save_history(history_data):
    """Save updated history to disk."""
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history_data, f, indent=2)

def get_today_key():
    """Returns today's date key in YYYY-MM-DD UTC format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def can_post_photo_today(max_per_day=2):
    """
    Checks if today's photo post count is under the maximum limit (default: 2 per day).
    """
    history = load_history()
    today_key = get_today_key()
    today_photos = history.get("photo_posts_by_date", {}).get(today_key, [])
    return len(today_photos) < max_per_day

def get_today_photo_count():
    """Returns how many photos have been posted today."""
    history = load_history()
    today_key = get_today_key()
    return len(history.get("photo_posts_by_date", {}).get(today_key, []))

def record_photo_posted(event_id):
    """Records photo post in today's date bucket."""
    history = load_history()
    today_key = get_today_key()
    if "photo_posts_by_date" not in history:
        history["photo_posts_by_date"] = {}
    if today_key not in history["photo_posts_by_date"]:
        history["photo_posts_by_date"][today_key] = []
    
    if event_id not in history["photo_posts_by_date"][today_key]:
        history["photo_posts_by_date"][today_key].append(event_id)
        
        # Keep only the last 30 days of photo history
        all_dates = sorted(history["photo_posts_by_date"].keys())
        if len(all_dates) > 30:
            for old_d in all_dates[:-30]:
                del history["photo_posts_by_date"][old_d]
                
        save_history(history)

def fetch_latest_earthquakes():
    """
    Fetches real-time earthquakes from USGS and filters events >= MIN_MAGNITUDE
    that have not yet been posted.
    """
    print("📡 Fetching latest earthquake data from USGS...")
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
