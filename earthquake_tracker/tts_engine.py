import asyncio
import os
import sys
import random
import edge_tts

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config import VOICE_NAME, VOICE_RATE, VOICE_PITCH

def get_dynamic_opener(mag, country):
    """
    Selects varied, high-impact broadcast openers based on earthquake magnitude.
    """
    if mag >= 7.0:
        openers = [
            f"Major seismic catastrophe alert in {country}.",
            f"Emergency disaster bulletin. A destructive earthquake has struck {country}.",
            f"Critical high-magnitude earthquake emergency in {country}.",
            f"Breaking crisis broadcast. Severe earthquake rocks {country}."
        ]
    elif mag >= 6.0:
        openers = [
            f"Significant earthquake detected in {country}.",
            f"Powerful seismic activity alert across {country}.",
            f"Urgent earthquake bulletin. Strong tremor rocks {country}.",
            f"Major seismic disturbance recorded in {country}."
        ]
    elif mag >= 5.0:
        openers = [
            f"Breaking seismic update for {country}.",
            f"Moderate earthquake detected in {country}.",
            f"Live global earthquake monitoring alert.",
            f"Seismic disturbance reported in {country}."
        ]
    else:
        openers = [
            f"Earthquake detection bulletin.",
            f"Regional seismic activity recorded near {country}.",
            f"Automated earthquake alert.",
            f"Seismic tremor registered in {country}."
        ]
    return random.choice(openers)

def get_dynamic_cta(place, country):
    """
    Generates dynamic call-to-actions asking local residents to comment with ground updates.
    """
    ctas = [
        f"If you are in {country} or nearby regions and felt this shaking, please comment below and tell us what you felt and how strong it was.",
        f"Did you feel the tremor in {country}? Don't forget to write in the comments what the shaking felt like in your location.",
        f"Residents across {country}, if you experienced this quake, please comment below to share what you felt and help us map the impact.",
        f"For anyone near the epicenter in {country}, tell us in the comments what you felt during the shaking and stay safe.",
        f"If you felt this earthquake in {country}, please share your experience and local ground conditions in the comments below."
    ]
    return random.choice(ctas)

def generate_script(event):
    """
    Generates dynamic broadcast scripts with varied duration (20s to 35-40s),
    custom magnitude openers, local & UTC times, and resident comment CTAs.
    """
    mag = event["mag"]
    place = event["place"]
    depth = event["depth_km"]
    local_time = event.get("local_time_short", "local time")
    utc_time = event.get("utc_short", event.get("time_utc", "UTC"))
    tsunami = event["tsunami_alert"]

    parts = [p.strip() for p in place.split(",")]
    country = parts[-1] if len(parts) >= 1 else "the region"

    opener = get_dynamic_opener(mag, country)
    cta = get_dynamic_cta(place, country)

    # Randomize video length style:
    # 0: Quick Update (~20s - 22s)
    # 1: Standard Update (~26s - 30s)
    # 2: In-Depth Analysis (~34s - 40s)
    # Larger quakes (M5.5+) default more to In-Depth
    if mag >= 5.5:
        mode = random.choice([1, 2, 2])
    else:
        mode = random.choice([0, 1, 2])

    sentences = []
    sentences.append(opener)
    sentences.append(f"A magnitude {mag} earthquake has struck {place}.")
    
    is_utc_same = event.get("is_utc_same", False)
    if is_utc_same or "UTC" in str(local_time) or "GMT" in str(local_time) or str(event.get("tz_name", "")).upper() in ["UTC", "GMT"]:
        sentences.append(f"The tremor occurred at {utc_time}.")
    else:
        sentences.append(f"The tremor occurred at {local_time}, which corresponds to {utc_time}.")

    if mode == 0:
        # Quick ~20s
        sentences.append(f"The focal depth was measured at {depth} kilometers.")
        sentences.append(cta)
        sentences.append("Follow Earthquake Tracker for 24/7 real-time global alerts.")
    elif mode == 1:
        # Standard ~28s
        sentences.append(f"The focal depth was measured at {depth} kilometers beneath the surface.")
        if tsunami:
            sentences.append("Authorities are actively evaluating coastal tsunami hazards.")
        else:
            sentences.append("No immediate tsunami threat has been reported by monitoring agencies.")
        sentences.append(cta)
        sentences.append("Stay tuned to Earthquake Tracker for continuous real-time seismic updates.")
    else:
        # In-Depth ~36-40s
        sentences.append(f"The seismic event originated at a depth of {depth} kilometers beneath the Earth's crust.")
        if depth < 30:
            sentences.append("Shallow earthquakes of this nature can produce pronounced ground shaking near the epicenter.")
        else:
            sentences.append("Geological monitoring networks are actively tracking potential aftershock activity across the fault zone.")
        if tsunami:
            sentences.append("Coastal tsunami advisories are being closely monitored by regional disaster authorities.")
        else:
            sentences.append("Official monitoring agencies report no immediate tsunami risk.")
        sentences.append(cta)
        sentences.append("Stay alert, stay safe, and follow Earthquake Tracker for 24/7 global seismic monitoring.")

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
    print(f"🎙️ Generating AI Voiceover ({len(sentences)} lines): \"{full_script[:65]}...\"")
    srt_content = asyncio.run(generate_voiceover_async(full_script, output_audio_path))
    return full_script, sentences, srt_content
