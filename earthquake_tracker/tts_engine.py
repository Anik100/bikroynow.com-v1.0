import asyncio
import os
import sys
import edge_tts

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config import VOICE_NAME, VOICE_RATE, VOICE_PITCH

def generate_script(event):
    """
    Generates a high-impact, professional international news broadcast script.
    """
    mag = event["mag"]
    place = event["place"]
    depth = event["depth_km"]
    time_str = event["time_utc"]
    tsunami = event["tsunami_alert"]

    if mag >= 7.0:
        urgency_prefix = "Major seismic emergency alert."
    elif mag >= 6.0:
        urgency_prefix = "Significant earthquake alert."
    else:
        urgency_prefix = "Breaking seismic alert."

    tsunami_text = (
        "Authorities are actively assessing potential tsunami hazards for nearby coastal regions."
        if tsunami
        else "No immediate tsunami warning has been reported by official monitoring agencies."
    )

    sentences = [
        urgency_prefix,
        f"A magnitude {mag} earthquake has struck {place}.",
        f"The seismic event occurred at a depth of {depth} kilometers on {time_str}.",
        tsunami_text,
        "Stay alert and follow Earthquake Tracker for 24/7 global seismic updates."
    ]

    full_script = " ".join(sentences)
    return full_script, sentences

async def generate_voiceover_async(text, output_audio_path):
    """
    Generates AI Voiceover using Microsoft Neural Edge-TTS and captures word timing.
    """
    communicate = edge_tts.Communicate(
        text=text,
        voice=VOICE_NAME,
        rate=VOICE_RATE,
        pitch=VOICE_PITCH
    )
    submaker = edge_tts.SubMaker()
    
    with open(output_audio_path, "wb") as file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                file.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                submaker.feed(chunk)

    return submaker.get_srt()

def create_audio_voiceover(event, output_audio_path):
    """Sync wrapper to generate script, audio file, and subtitle timings."""
    full_script, sentences = generate_script(event)
    print(f"🎙️ Generating AI Voiceover: \"{full_script[:60]}...\"")
    srt_content = asyncio.run(generate_voiceover_async(full_script, output_audio_path))
    return full_script, sentences, srt_content
