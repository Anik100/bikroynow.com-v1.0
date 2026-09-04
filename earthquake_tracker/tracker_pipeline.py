import os
import sys

# Support unicode emojis in Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Ensure local imports work
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from config import OUTPUT_DIR, VIDEO_MIN_MAGNITUDE
from fetcher import fetch_latest_earthquakes, mark_event_as_posted
from tts_engine import create_audio_voiceover
from video_engine import create_earthquake_video
from infographic_engine import create_earthquake_infographic_photo
from fb_publisher import upload_video_to_facebook, upload_photo_to_facebook

import threading
import concurrent.futures
from auto_commenter import process_comment_auto_replies

def prepare_event_media(event):
    """
    Renders video reel or infographic photo in parallel.
    Returns: dict with event, media_path, media_type
    """
    event_id = event["id"]
    mag = event["mag"]
    place = event["place"]

    print(f"\n==========================================")
    print(f"🚀 [Priority M{mag}] Rendering Media for [{event_id}]: {place}")
    print(f"==========================================")

    # 🌊 Smart Uninhabited Ocean Filter:
    # Earthquakes on remote uninhabited oceanic ridges/trenches (M < 5.2) generate 0 comments
    # and cause Reels viewer fatigue. We render them as high-res infographic photos,
    # reserving full 3D Video Reels for inhabited regions or strong M >= 5.2 seismic events.
    uninhabited_ocean_zones = [
        "ridge", "rise", "fracture zone", "south sandwich islands",
        "balleny islands", "mid-indian", "kermadec islands",
        "macquarie island", "prince edward", "mariana trench"
    ]
    place_lower = place.lower()
    is_uninhabited_ocean = any(zone in place_lower for zone in uninhabited_ocean_zones)
    should_render_video = (mag >= VIDEO_MIN_MAGNITUDE) and (not is_uninhabited_ocean or mag >= 5.2)

    if should_render_video:
        # 🎬 Inhabited or Strong M5.2+ -> 3D Video Reel
        audio_path = os.path.join(OUTPUT_DIR, f"audio_{event_id}.mp3")
        full_script, sentences, srt_content = create_audio_voiceover(event, audio_path)

        video_path = os.path.join(OUTPUT_DIR, f"earthquake_{event_id}.mp4")
        create_earthquake_video(event, audio_path, sentences, video_path)

        # Cleanup audio
        try:
            if os.path.exists(audio_path):
                os.remove(audio_path)
        except Exception:
            pass

        return {
            "event": event,
            "media_path": video_path,
            "media_type": "video"
        }
    else:
        # 📸 M4.0-M4.4 or Remote Oceanic M < 5.2 -> High-Resolution Infographic Photo + Text
        photo_path = os.path.join(OUTPUT_DIR, f"infographic_{event_id}.png")
        create_earthquake_infographic_photo(event, photo_path)
        return {
            "event": event,
            "media_path": photo_path,
            "media_type": "photo"
        }

def process_priority_worker(idx, event, publish_locks):
    """
    Worker executing parallel media rendering, followed by magnitude-first
    priority gate publishing to Facebook.
    """
    event_id = event["id"]
    mag = event["mag"]
    place = event["place"]

    try:
        # 1. Parallel Render Stage: Generates media concurrently at full speed
        media_item = prepare_event_media(event)
        
        # 2. Magnitude-First Publishing Gate:
        # Wait for all higher-magnitude events (0 to idx-1) to publish to Facebook first
        if idx > 0:
            for prev_idx in range(idx):
                # Wait up to 45s per higher priority event so nothing is ever permanently blocked
                publish_locks[prev_idx].wait(timeout=45.0)

        # 3. Publish to Facebook in strict magnitude order
        print(f"📢 [PUBLISH GATE] Uploading M{mag} to Facebook: {place}...")
        if media_item["media_type"] == "video":
            upload_video_to_facebook(media_item["media_path"], event)
        else:
            upload_photo_to_facebook(media_item["media_path"], event)

        # Mark as posted with spatial coordinates
        mark_event_as_posted(event)
        print(f"✨ Successfully published M{mag} [{event_id}]: {place}\n")

    except Exception as e:
        print(f"❌ Error in priority worker for M{mag} [{event_id}]: {e}")
    finally:
        # Always release lock so downstream events are never stalled
        publish_locks[idx].set()

def run_pipeline():
    """Main tracker loop with Magnitude-First Priority Parallel Engine & Auto-Commenter."""
    print("🌍 Earthquake Tracker Bot starting run...")
    events = fetch_latest_earthquakes()

    if events:
        # Sort events strictly descending by Magnitude first, then epoch time
        events.sort(key=lambda x: (x.get("mag", 0), x.get("epoch_ms", 0)), reverse=True)

        target_events = events[:10]
        num_events = len(target_events)
        print(f"⚡ Dispatched {num_events} earthquake(s) to Magnitude-First Priority Worker Pool...")

        # Initialize synchronization locks for magnitude-ordered publishing
        publish_locks = {i: threading.Event() for i in range(num_events)}

        # Parallel Execution: 3 concurrent workers render simultaneously,
        # but publish to Facebook strictly by magnitude order
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(3, num_events)) as executor:
            futures = [
                executor.submit(process_priority_worker, i, ev, publish_locks)
                for i, ev in enumerate(target_events)
            ]
            for future in concurrent.futures.as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"❌ Worker thread exception: {e}")
    else:
        print("💤 No new earthquakes >= M4.0 found. All caught up!")

    # Check and Auto-Reply to new Facebook comments
    try:
        process_comment_auto_replies()
    except Exception as e:
        print(f"⚠️ Auto-commenter run note: {e}")

if __name__ == "__main__":
    run_pipeline()
