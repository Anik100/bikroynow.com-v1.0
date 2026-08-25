import os

# Real-Time Earthquake Data Feeds (USGS Instant Stream + EMSC Global Seismic Portal)
USGS_FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
USGS_DAY_FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
EMSC_FEED_URL = "https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=40&minmag=4.0"

MIN_MAGNITUDE = 4.0        # Fetch all earthquakes starting from M4.0
VIDEO_MIN_MAGNITUDE = 4.5  # M4.5+ -> 3D Video Reels
PHOTO_MAX_MAGNITUDE = 4.49 # M4.0 to M4.4 -> High-Resolution Infographic Photo + Text
CHECK_INTERVAL_SECONDS = 600  # 10 minutes

# Facebook Page Settings (Always fallback to valid Page ID)
FB_PAGE_ID = os.environ.get("FB_PAGE_ID") or "1305415129314506"
FB_PAGE_ACCESS_TOKEN = os.environ.get(
    "FB_PAGE_ACCESS_TOKEN"
) or "EAAXKINI8fZCABSR3DRhedsygsJe23QQSzEc6v1VdRXx94r7yZCraEZBl2kqbJNwFUFrOjdxjzfZBpX1ChdwYLEiTN1rAZBCb4AiO5wmFqh9J6tvFO49wJiflILkfMjaTSUDH0vVWkV3H5TFRFl1YkiotrZBqTx3Tz3Cn4bBZAoS5UZAwjbvyHoJ4HglXTEuuTi9qBUoj"

# AI Voice Settings (Microsoft Edge Neural TTS - 100% Free)
VOICE_NAME = "en-US-JennyNeural"
VOICE_RATE = "+0%"
VOICE_PITCH = "+0Hz"

# Video Specifications
VIDEO_WIDTH = 1080
VIDEO_HEIGHT = 1920
FPS = 30

# File Storage Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
HISTORY_FILE = os.path.join(BASE_DIR, "history.json")

os.makedirs(OUTPUT_DIR, exist_ok=True)
