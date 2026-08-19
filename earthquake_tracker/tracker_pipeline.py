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

from config import OUTPUT_DIR
from fetcher import (
    fetch_latest_earthquakes,
    mark_event_as_posted,
    can_post_photo_today,
    get_today_photo_count,
    record_photo_posted
)
from tts_engine import create_audio_voiceover
from video_engine import create_earthquake_video
from infographic_engine import create_earthquake_infographic_photo
from fb_publisher import upload_video_to_facebook, upload_photo_to_facebook

def process_single_event(event):
    """
    Complete end-to-end processing of a single earthquake event:
    1. AI Voiceover & Subtitles
    2. Broadcast 3D Video Reel Rendering & Upload (Always posts for every qualifying earthquake)
    3. High-Resolution Infographic Photo Card Rendering & Upload (MAX 2 per day)
    4. Mark as posted
    """
    event_id = event["id"]
    print(f"\n==========================================")
    print(f"🚀 Processing Event [{event_id}]: M{event['mag']} - {event['place']}")
    print(f"==========================================")

    # 1. Generate Voiceover and Subtitles
    audio_path = os.path.join(OUTPUT_DIR, f"audio_{event_id}.mp3")
    full_script, sentences, srt_content = create_audio_voiceover(event, audio_path)

    # 2. Render Full HD Pro Video Reel
    video_path = os.path.join(OUTPUT_DIR, f"earthquake_{event_id}.mp4")
    create_earthquake_video(event, audio_path, sentences, video_path)

    # 3. Publish Video to Facebook (Always uploaded)
    upload_video_to_facebook(video_path, event)

    # 4. Generate & Publish Infographic Photo Post (Max 2 per day)
    if can_post_photo_today(max_per_day=2):
        photo_path = os.path.join(OUTPUT_DIR, f"infographic_{event_id}.png")
        try:
            curr_count = get_today_photo_count()
            print(f"📸 Daily Photo Post {curr_count + 1}/2: Creating Infographic Photo Card for: {event['place']}")
            create_earthquake_infographic_photo(event, photo_path)
            upload_photo_to_facebook(photo_path, event)
            record_photo_posted(event_id)
            print(f"✅ Photo {curr_count + 1}/2 posted successfully for today!")
        except Exception as img_err:
            print(f"⚠️ Infographic Photo Error: {img_err}")
    else:
        print(f"ℹ️ Daily photo limit reached (2/2 photos already posted today). Video published, skipping photo.")

    # 5. Mark video as posted
    mark_event_as_posted(event_id)

    # Cleanup temp files safely
    for temp_f in [audio_path]:
        try:
            if os.path.exists(temp_f):
                os.remove(temp_f)
        except Exception:
            pass

    print(f"✨ Finished processing: {event['place']}\n")

def run_pipeline():
    """Main tracker loop."""
    print("🌍 Earthquake Tracker Bot starting run...")
    print(f"📊 Today's photo posts count: {get_today_photo_count()}/2")
    events = fetch_latest_earthquakes()

    if not events:
        print("💤 No new earthquakes >= M4.5 found. All caught up!")
        return

    # Process events
    for event in events[:3]:
        try:
            process_single_event(event)
        except Exception as e:
            print(f"❌ Error processing event {event.get('id')}: {e}")

if __name__ == "__main__":
    run_pipeline()
