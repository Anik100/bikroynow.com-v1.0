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
from fetcher import fetch_latest_earthquakes, mark_event_as_posted
from tts_engine import create_audio_voiceover
from video_engine import create_earthquake_video
from fb_publisher import upload_video_to_facebook

def process_single_event(event):
    """
    Complete end-to-end processing of a single earthquake event:
    1. AI Voiceover
    2. Broadcast Video Rendering
    3. Facebook Publishing
    4. Mark as posted
    """
    event_id = event["id"]
    print(f"\n==========================================")
    print(f"🚀 Processing Event [{event_id}]: M{event['mag']} - {event['place']}")
    print(f"==========================================")

    # 1. Generate Voiceover and Subtitles
    audio_path = os.path.join(OUTPUT_DIR, f"audio_{event_id}.mp3")
    full_script, sentences, srt_content = create_audio_voiceover(event, audio_path)

    # 2. Render Full HD Pro Video with Real Map & Subtitles
    video_path = os.path.join(OUTPUT_DIR, f"earthquake_{event_id}.mp4")
    create_earthquake_video(event, audio_path, sentences, video_path)

    # 3. Publish to Facebook
    published = upload_video_to_facebook(video_path, event)

    # 4. Mark as posted so it won't be processed again
    mark_event_as_posted(event_id)

    # Cleanup temp audio safely
    try:
        if os.path.exists(audio_path):
            os.remove(audio_path)
    except Exception:
        pass

    print(f"✨ Finished processing: {event['place']}\n")

def run_pipeline():
    """Main tracker loop."""
    print("🌍 Earthquake Tracker Bot starting run...")
    events = fetch_latest_earthquakes()

    if not events:
        print("💤 No new earthquakes >= M4.5 found. All caught up!")
        return

    # Process up to 3 events per cycle to stay within rate-limits and processing budget
    for event in events[:3]:
        try:
            process_single_event(event)
        except Exception as e:
            print(f"❌ Error processing event {event.get('id')}: {e}")

if __name__ == "__main__":
    run_pipeline()
