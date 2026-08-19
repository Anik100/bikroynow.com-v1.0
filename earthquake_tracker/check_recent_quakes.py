import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import requests
import json
from datetime import datetime

url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
res = requests.get(url).json()

print(f"Total events in USGS feed >= 4.5: {len(res['features'])}")

with open("earthquake_tracker/history.json", "r") as f:
    history = json.load(f)
posted_ids = set(history.get("posted_ids", []))

new_events = []
for f in res["features"]:
    eid = f["id"]
    mag = f["properties"]["mag"]
    place = f["properties"]["place"]
    time_ms = f["properties"]["time"]
    time_str = datetime.utcfromtimestamp(time_ms / 1000).strftime("%Y-%m-%d %H:%M UTC")
    is_new = eid not in posted_ids
    if is_new:
        new_events.append((eid, mag, place, time_str))

print(f"Total Unposted New Earthquakes: {len(new_events)}")
for eid, mag, place, time_str in new_events[:10]:
    print(f" - [{eid}] M{mag} | {place} | {time_str}")
