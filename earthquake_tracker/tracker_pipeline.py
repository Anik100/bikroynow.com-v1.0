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

def process_single_event(event):
    """
    Intelligent Earthquake Publishing Pipeline:
    - M4.5+ : 3D Video Reel with AI Voiceover & Subtitles
    - M4.0 to M4.4 : High-Resolution Infographic Photo + Detailed Text Report
    """
    event_id = event["id"]
    mag = event["mag"]
    place = event["place"]

    print(f"\n==========================================")
    print(f"🚀 Processing Event [{event_id}]: M{mag} - {place}")
    print(f"==========================================")

    if mag >= VIDEO_MIN_MAGNITUDE:
        # 🎬 M4.5+ -> 3D Video Reel
        print(f"🎬 Magnitude {mag} >= {VIDEO_MIN_MAGNITUDE}: Generating 3D Video Reel...")
        audio_path = os.path.join(OUTPUT_DIR, f"audio_{event_id}.mp3")
        full_script, sentences, srt_content = create_audio_voiceover(event, audio_path)

        video_path = os.path.join(OUTPUT_DIR, f"earthquake_{event_id}.mp4")
        create_earthquake_video(event, audio_path, sentences, video_path)

        upload_video_to_facebook(video_path, event)

        # Cleanup audio
        try:
            if os.path.exists(audio_path):
                os.remove(audio_path)
        except Exception:
            pass
    else:
        # 📸 M4.0 to M4.4 -> Infographic Photo + Text
        print(f"📸 Magnitude {mag} (< {VIDEO_MIN_MAGNITUDE}): Generating High-Resolution Infographic Photo...")
        photo_path = os.path.join(OUTPUT_DIR, f"infographic_{event_id}.png")
        try:
            create_earthquake_infographic_photo(event, photo_path)
            upload_photo_to_facebook(photo_path, event)
        except Exception as img_err:
            print(f"❌ Infographic Photo Error: {img_err}")

    # Mark as posted
    mark_event_as_posted(event_id)
    print(f"✨ Finished processing: {place}\n")

def run_pipeline():
    """Main tracker loop."""
    print("🌍 Earthquake Tracker Bot starting run...")
    events = fetch_latest_earthquakes()

    if not events:
        print("💤 No new earthquakes >= M4.0 found. All caught up!")
        return

    # Sort events to ensure the newest ones are processed first
    events.sort(key=lambda x: x.get("epoch_ms", 0), reverse=True)

    # Process events (up to 4 events per run)
    for event in events[:4]:
        try:
            process_single_event(event)
        except Exception as e:
            print(f"❌ Error processing event {event.get('id')}: {e}")

if __name__ == "__main__":
    run_pipeline()
