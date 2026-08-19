import os

# Earthquake Monitoring Settings
USGS_FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
MIN_MAGNITUDE = 4.5
CHECK_INTERVAL_SECONDS = 600  # 10 minutes

# Facebook Page Settings
FB_PAGE_ID = "1305415129314506"
FB_PAGE_ACCESS_TOKEN = os.environ.get(
    "FB_PAGE_ACCESS_TOKEN",
    "EAAXKINI8fZCABSR3DRhedsygsJe23QQSzEc6v1VdRXx94r7yZCraEZBl2kqbJNwFUFrOjdxjzfZBpX1ChdwYLEiTN1rAZBCb4AiO5wmFqh9J6tvFO49wJiflILkfMjaTSUDH0vVWkV3H5TFRFl1YkiotrZBqTx3Tz3Cn4bBZAoS5UZAwjbvyHoJ4HglXTEuuTi9qBUoj"
)

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
