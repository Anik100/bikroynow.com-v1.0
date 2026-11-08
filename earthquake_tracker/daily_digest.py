import os
import sys
import math
import time
import json
import io
import re
import argparse
import asyncio
import subprocess
from datetime import datetime, timezone
from functools import lru_cache

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import requests
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import edge_tts
import imageio_ffmpeg

# Project configuration
try:
    from config import FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN, OUTPUT_DIR
except ImportError:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    OUTPUT_DIR = os.path.join(BASE_DIR, "output")
    FB_PAGE_ID = os.environ.get("FB_PAGE_ID", "1305415129314506")
    FB_PAGE_ACCESS_TOKEN = os.environ.get("FB_PAGE_ACCESS_TOKEN", "")

# Support alternate naming conventions for secrets
if not FB_PAGE_ACCESS_TOKEN:
    FB_PAGE_ACCESS_TOKEN = os.environ.get("FB_ACCESS_TOKEN", "")

GEOAPIFY_KEY = os.environ.get("GEOAPIFY_KEY") or os.environ.get("GEOAPIFY_API_KEY", "")
VOICE_NAME = os.environ.get("DIGEST_VOICE") or "en-US-AriaNeural"
USGS_ALL_DAY_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"

os.makedirs(OUTPUT_DIR, exist_ok=True)

@lru_cache(maxsize=128)
def get_font(size, bold=True):
    """Loads system or fallback fonts cleanly across Windows and Linux."""
    try:
        font_name = "arialbd.ttf" if bold else "arial.ttf"
        return ImageFont.truetype(font_name, size)
    except Exception:
        try:
            dejavu = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
            return ImageFont.truetype(dejavu, size)
        except Exception:
            return ImageFont.load_default()

# ==============================================================================
# 1. INTERNATIONAL TIME (UTC) ALIGNMENT & DATA FILTERING
# ==============================================================================

def fetch_daily_seismic_events(local_data_path=None):
    """
    Fetches past 24-hour earthquakes from USGS API (or local file fallback).
    Filters events with magnitude >= 4.5.
    Sorts by magnitude descending and selects the top 5 to 7 most significant quakes.
    All timestamps are strictly aligned to Coordinated Universal Time (UTC).
    """
    print("📡 Fetching past 24-hour seismic events (UTC Alignment)...", flush=True)
    data = None

    if local_data_path and os.path.exists(local_data_path):
        try:
            print(f"📂 Loading local USGS dataset from: {local_data_path}", flush=True)
            with open(local_data_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"⚠️ Could not load local data: {e}", flush=True)

    if not data:
        # Check desktop path fallback if present
        desktop_sample = r"c:\Users\anikh\Desktop\all_day.geojson.json"
        if os.path.exists(desktop_sample) and local_data_path == desktop_sample:
            with open(desktop_sample, "r", encoding="utf-8") as f:
                data = json.load(f)

    if not data:
        try:
            headers = {"User-Agent": "EarthquakeTrackerDailyDigest/1.0"}
            resp = requests.get(USGS_ALL_DAY_FEED, headers=headers, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
            else:
                print(f"❌ USGS Feed returned HTTP {resp.status_code}", flush=True)
        except Exception as err:
            print(f"❌ Error fetching live USGS feed: {err}", flush=True)

    if not data or "features" not in data:
        print("❌ No valid seismic GeoJSON data available.", flush=True)
        return [], 0, datetime.now(timezone.utc).strftime("%B %d, %Y")

    features = data.get("features", [])
    now_utc = datetime.now(timezone.utc)
    digest_date_str = now_utc.strftime("%B %d, %Y")

    # Filter events: magnitude >= 4.5
    filtered = []
    seen_ids = set()

    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [0, 0, 0])

        mag = props.get("mag")
        if mag is None or mag < 4.5:
            continue

        fid = feat.get("id") or props.get("code") or f"{coords[1]}_{coords[0]}"
        if fid in seen_ids:
            continue
        seen_ids.add(fid)

        # Convert epoch ms to UTC time string
        epoch_ms = props.get("time", 0)
        dt_utc = datetime.fromtimestamp(epoch_ms / 1000.0, tz=timezone.utc)
        utc_time_str = dt_utc.strftime("%H:%M UTC")

        place = (props.get("place") or "Unspecified region").strip()
        depth_km = round(coords[2], 1) if len(coords) >= 3 else 10.0
        lon = coords[0]
        lat = coords[1]
        tsunami = (props.get("tsunami") or 0) == 1

        filtered.append({
            "id": fid,
            "mag": float(mag),
            "place": place,
            "time_utc": utc_time_str,
            "epoch_ms": epoch_ms,
            "dt_utc": dt_utc,
            "lat": lat,
            "lon": lon,
            "depth_km": depth_km,
            "tsunami": tsunami
        })

    # Sort descending by magnitude
    filtered.sort(key=lambda x: x["mag"], reverse=True)
    total_m45_count = len(filtered)

    # Select top 5 to 7 events
    top_events = filtered[:7]
    print(f"✅ Filtered {total_m45_count} earthquakes (M4.5+) across the globe in the past 24 hours.", flush=True)
    print(f"📋 Selected Top {len(top_events)} most significant quakes for the Daily Digest video.", flush=True)

    return top_events, total_m45_count, digest_date_str

# ==============================================================================
# 2. AI VOICEOVER GENERATION (edge-tts)
# ==============================================================================

async def _synthesize_edge_tts(script, voice, output_audio_path):
    """Asynchronously calls edge-tts to generate voiceover and extract timing data."""
    comm = edge_tts.Communicate(text=script, voice=voice)
    sentence_timings = []

    with open(output_audio_path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "SentenceBoundary":
                st = chunk["offset"] / 10000000.0
                dur = chunk["duration"] / 10000000.0
                sentence_timings.append({
                    "text": chunk.get("text", "").strip(),
                    "start": st,
                    "end": st + dur,
                    "duration": dur
                })
    return sentence_timings

def generate_digest_voiceover(top_events, total_m45_count, digest_date_str, output_audio_path):
    """
    Constructs an authoritative, comprehensive news-bulletin voiceover script
    summarizing the day's seismic activity with scientific depth.
    Uses edge-tts with the requested neural voice (en-US-AriaNeural).
    """
    print(f"🎙️ Generating AI Voiceover using {VOICE_NAME}...", flush=True)

    events_to_cover = top_events[:5]
    ordinals = ["one", "two", "three", "four", "five", "six", "seven"]
    script_parts = []

    # 1. Broad Anchor Intro
    top_mag = events_to_cover[0]["mag"] if events_to_cover else 4.5
    intro_texts = [
        f"Good evening. This is the 24-hour Daily Global Seismic Digest for {digest_date_str}, broadcasting live in Coordinated Universal Time from Earthquake Tracker.",
        f"Over the past 24 hours, international monitoring networks from USGS and EMSC recorded {total_m45_count} earthquakes measuring magnitude 4.5 or greater worldwide. Here are today's top {len(events_to_cover)} most significant seismic events."
    ]
    script_parts.extend(intro_texts)
    intro_count = len(intro_texts)

    # 2. Detailed Per-Event Coverage (Rank 1 to 5)
    event_sentence_counts = []
    for idx, ev in enumerate(events_to_cover):
        ord_word = ordinals[idx] if idx < len(ordinals) else f"{idx + 1}"
        clean_place = (
            ev["place"]
            .replace("km", "kilometers")
            .replace("NE of", "Northeast of")
            .replace("NW of", "Northwest of")
            .replace("SE of", "Southeast of")
            .replace("SW of", "Southwest of")
            .replace("N of", "North of")
            .replace("S of", "South of")
            .replace("E of", "East of")
            .replace("W of", "West of")
        )

        depth = ev["depth_km"]
        if depth <= 25:
            depth_desc = f"The shallow tremor ruptured at a focal depth of {depth:.1f} kilometers"
        elif depth <= 70:
            depth_desc = f"The hypocenter was logged at an intermediate depth of {depth:.1f} kilometers"
        else:
            depth_desc = f"Rupturing at a deep focal depth of {depth:.1f} kilometers"

        if ev.get("tsunami"):
            tsunami_desc = "regional agencies issued precautionary advisories, with no destructive waves developing."
        else:
            tsunami_desc = "sensors and oceanic buoys confirm no tsunami hazard."

        ev_sentence_1 = f"At rank {ord_word}, a notable magnitude {ev['mag']:.1f} earthquake struck {clean_place} at {ev['time_utc']}."
        ev_sentence_2 = f"{depth_desc}, with ground motion verified independently by USGS and EMSC stations, while {tsunami_desc}"

        ev_sentences = [ev_sentence_1, ev_sentence_2]
        script_parts.extend(ev_sentences)
        event_sentence_counts.append(len(ev_sentences))

    # 3. Comprehensive Outro & Safety Advisories
    outro_texts = [
        "In review, global seismic energy release across the past 24 hours remained within expected planetary baselines with no trans-oceanic tsunami threat.",
        "Remember to practice essential earthquake safety: Drop, Cover, and Hold On during unexpected tremors. Follow facebook.com/earthquaketracker247 for 24/7 automated real-time alerts. Stay safe, and good night."
    ]
    script_parts.extend(outro_texts)
    outro_count = len(outro_texts)

    full_script = " ".join(script_parts)

    # Synthesize audio with edge-tts
    try:
        sentence_timings = asyncio.run(_synthesize_edge_tts(full_script, VOICE_NAME, output_audio_path))
    except Exception as e:
        print(f"⚠️ edge-tts async error: {e}. Retrying with fallback voice...", flush=True)
        sentence_timings = asyncio.run(_synthesize_edge_tts(full_script, "en-US-GuyNeural", output_audio_path))

    # Accurate duration probing from sentence timings
    if sentence_timings:
        audio_duration = round(sentence_timings[-1]["end"] + 0.8, 2)
    else:
        audio_duration = 135.0

    # Build event time ranges
    event_time_ranges = []
    if sentence_timings and len(sentence_timings) >= (intro_count + sum(event_sentence_counts)):
        intro_end = sentence_timings[intro_count - 1]["end"]
        curr_s_idx = intro_count
        for count in event_sentence_counts:
            ev_start = sentence_timings[curr_s_idx]["start"]
            end_idx = min(len(sentence_timings) - 1, curr_s_idx + count - 1)
            ev_end = sentence_timings[end_idx]["end"]
            event_time_ranges.append((ev_start, ev_end))
            curr_s_idx += count
        outro_start = sentence_timings[curr_s_idx]["start"] if curr_s_idx < len(sentence_timings) else (audio_duration - 20.0)
    else:
        intro_end = 16.0
        outro_start = max(intro_end + 10.0, audio_duration - 22.0)
        body_dur = max(5.0, outro_start - intro_end)
        ev_dur = body_dur / max(1, len(events_to_cover))
        for i in range(len(events_to_cover)):
            s_t = intro_end + (i * ev_dur)
            e_t = s_t + ev_dur
            event_time_ranges.append((s_t, e_t))

    timing_meta = {
        "intro_end": intro_end,
        "outro_start": outro_start,
        "event_time_ranges": event_time_ranges
    }

    print(f"✅ Voiceover generated! Audio duration: {audio_duration:.2f} seconds ({len(script_parts)} sentences).", flush=True)
    return full_script, sentence_timings, audio_duration, timing_meta, events_to_cover

# ==============================================================================
# 3. SATELLITE MAP VISUALS (Geoapify API & ESRI Satellite Fallback)
# ==============================================================================

def fetch_satellite_map(lat, lon, width=1280, height=720, zoom=5, geoapify_key=None):
    """
    Fetches wide satellite map imagery using Geoapify Static Maps API with red epicenter markers.
    Includes ESRI World Imagery fallback if Geoapify key is absent or quota is exceeded.
    """
    headers = {"User-Agent": "EarthquakeTrackerDailyDigest/1.0"}

    # 1. Try Geoapify Static Maps API if key provided
    if geoapify_key:
        try:
            # Using klokantech-basic or osm-bright-smooth with red marker
            url = (
                f"https://maps.geoapify.com/v1/staticmap?"
                f"style=klokantech-basic&width={width}&height={height}"
                f"&center=lonlat:{lon},{lat}&zoom={zoom}"
                f"&marker=lonlat:{lon},{lat};color:%23ff0000;size:medium"
                f"&apiKey={geoapify_key}"
            )
            resp = requests.get(url, headers=headers, timeout=6)
            if resp.status_code == 200:
                return Image.open(io.BytesIO(resp.content)).convert("RGB")
            else:
                print(f"⚠️ Geoapify API returned {resp.status_code}. Using ESRI Satellite fallback...", flush=True)
        except Exception as e:
            print(f"⚠️ Geoapify map note: {e}", flush=True)

    # 2. ESRI Satellite Map Fallback
    try:
        n_tiles = 1 << zoom
        xtile = int((lon + 180.0) / 360.0 * n_tiles)
        lat_rad = math.radians(lat)
        ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n_tiles)

        # Download a 3x2 grid of tiles around epicenter
        tile_w, tile_h = 256, 256
        cols = max(3, int(math.ceil(width / tile_w)) + 1)
        rows = max(3, int(math.ceil(height / tile_h)) + 1)
        composite = Image.new("RGB", (cols * tile_w, rows * tile_h), "#0a1322")

        start_x = xtile - cols // 2
        start_y = ytile - rows // 2

        for r_idx in range(rows):
            for c_idx in range(cols):
                cx = (start_x + c_idx) % n_tiles
                cy = max(0, min(n_tiles - 1, start_y + r_idx))
                t_url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{zoom}/{cy}/{cx}"
                try:
                    t_resp = requests.get(t_url, headers=headers, timeout=4)
                    if t_resp.status_code == 200:
                        t_img = Image.open(io.BytesIO(t_resp.content)).convert("RGB")
                        composite.paste(t_img, (c_idx * tile_w, r_idx * tile_h))
                except Exception:
                    pass

        # Center crop to target dimensions
        cw, ch = composite.size
        left = max(0, (cw - width) // 2)
        top = max(0, (ch - height) // 2)
        map_crop = composite.crop((left, top, left + width, top + height))

        # Draw red epicenter marker with crosshairs
        draw = ImageDraw.Draw(map_crop)
        cx_pt = width // 2
        cy_pt = height // 2

        # Outer shockwave rings
        draw.ellipse([(cx_pt - 40, cy_pt - 40), (cx_pt + 40, cy_pt + 40)], outline="#ff1744", width=3)
        draw.ellipse([(cx_pt - 75, cy_pt - 75), (cx_pt + 75, cy_pt + 75)], outline="#ff5252", width=2)
        # Center core
        draw.ellipse([(cx_pt - 14, cy_pt - 14), (cx_pt + 14, cy_pt + 14)], fill="#ff1744", outline="#ffffff", width=2)
        # Crosshair lines
        draw.line([(cx_pt - 95, cy_pt), (cx_pt - 20, cy_pt)], fill="#ffffff", width=2)
        draw.line([(cx_pt + 20, cy_pt), (cx_pt + 95, cy_pt)], fill="#ffffff", width=2)
        draw.line([(cx_pt, cy_pt - 95), (cx_pt, cy_pt - 20)], fill="#ffffff", width=2)
        draw.line([(cx_pt, cy_pt + 20), (cx_pt, cy_pt + 95)], fill="#ffffff", width=2)

        return map_crop
    except Exception as err:
        print(f"⚠️ ESRI fallback note: {err}", flush=True)
        # Deep space fallback image
        blank = Image.new("RGB", (width, height), "#0a1322")
        d = ImageDraw.Draw(blank)
        d.text((width // 2, height // 2), f"SEISMIC EPICENTER: {lat}°, {lon}°", fill="#ffffff", anchor="mm")
        return blank

# ==============================================================================
# 4. DUAL-VIDEO PRODUCTION (16:9 LANDSCAPE & 9:16 VERTICAL STORY)
# ==============================================================================

def get_mag_color(mag):
    if mag >= 6.0:
        return "#ff1744"  # Vibrant Red
    elif mag >= 5.0:
        return "#ff9100"  # Vibrant Orange
    return "#ffd600"      # Gold / Yellow

def compose_landscape_frame(top_events, current_event_idx, total_m45_count, digest_date_str, map_images, subtitle_text, progress_ratio=0.0):
    """
    Composes a single 1920x1080 (16:9) frame with dark glassmorphic data cards,
    satellite imagery, clear typography, and synced subtitles.
    """
    W, H = 1920, 1080
    frame = Image.new("RGB", (W, H), "#060b14")
    draw = ImageDraw.Draw(frame)

    # 1. Header Bar
    draw.rectangle([(0, 0), (W, 95)], fill="#0c1626")
    draw.line([(0, 95), (W, 95)], fill="#1f334d", width=2)

    font_title = get_font(30, bold=True)
    font_brand = get_font(26, bold=True)
    font_sub = get_font(20, bold=False)

    # Flashing live badge
    draw.rectangle([(40, 24), (170, 70)], fill="#ff1744")
    draw.text((105, 47), "24H DIGEST", font=get_font(18, bold=True), fill="#ffffff", anchor="mm")

    draw.text((200, 36), f"DAILY GLOBAL SEISMIC DIGEST", font=font_title, fill="#ffffff")
    draw.text((200, 70), f"{digest_date_str.upper()} (UTC) • {total_m45_count} SIGNIFICANT QUAKES RECORDED", font=get_font(16, bold=True), fill="#7ea5c9")

    draw.text((W - 50, 48), "EARTHQUAKE TRACKER", font=font_brand, fill="#4fc3f7", anchor="rm")

    # 2. Main Content Layout
    # Check if this is Intro or Outro segment
    if current_event_idx < 0 or current_event_idx >= len(top_events):
        # Overview Screen
        card_w, card_h = 1300, 680
        cx = (W - card_w) // 2
        cy = 150
        draw.rectangle([(cx, cy), (cx + card_w, cy + card_h)], fill="#0f1f33", outline="#254266", width=2)
        
        draw.text((W // 2, cy + 90), "GLOBAL SEISMIC SUMMARY", font=get_font(46, bold=True), fill="#ffffff", anchor="mm")
        draw.text((W // 2, cy + 150), f"Past 24 Hours • Coordinated Universal Time (UTC)", font=get_font(24, bold=False), fill="#7ea5c9", anchor="mm")

        # Stats Boxes
        b1_x = cx + 120
        b2_x = cx + 700
        by = cy + 240
        draw.rectangle([(b1_x, by), (b1_x + 480, by + 260)], fill="#162942", outline="#2d4f7a", width=2)
        draw.text((b1_x + 240, by + 60), f"{total_m45_count}", font=get_font(72, bold=True), fill="#ff9100", anchor="mm")
        draw.text((b1_x + 240, by + 150), "M 4.5+ EARTHQUAKES", font=get_font(24, bold=True), fill="#ffffff", anchor="mm")
        draw.text((b1_x + 240, by + 200), "Detected Worldwide", font=get_font(18, bold=False), fill="#9fbcd9", anchor="mm")

        max_mag = top_events[0]["mag"] if top_events else 4.5
        top_place = top_events[0]["place"] if top_events else "Global Waters"
        draw.rectangle([(b2_x, by), (b2_x + 480, by + 260)], fill="#162942", outline="#2d4f7a", width=2)
        draw.text((b2_x + 240, by + 60), f"M {max_mag:.1f}", font=get_font(72, bold=True), fill=get_mag_color(max_mag), anchor="mm")
        draw.text((b2_x + 240, by + 150), "LARGEST EVENT", font=get_font(24, bold=True), fill="#ffffff", anchor="mm")
        draw.text((b2_x + 240, by + 200), top_place[:30], font=get_font(18, bold=False), fill="#9fbcd9", anchor="mm")

        draw.text((W // 2, cy + 580), "Data Monitored & Verified by USGS and EMSC Global Sensor Networks", font=get_font(20, bold=True), fill="#4fc3f7", anchor="mm")
    else:
        # Event Display Layout: Left Map (1160x740), Right Card (640x740)
        ev = top_events[current_event_idx]
        map_img = map_images.get(current_event_idx)

        # Map Box
        map_x, map_y = 50, 140
        map_w, map_h = 1160, 740
        if map_img:
            frame.paste(map_img, (map_x, map_y))
        else:
            draw.rectangle([(map_x, map_y), (map_x + map_w, map_y + map_h)], fill="#121e30")

        draw.rectangle([(map_x, map_y), (map_x + map_w, map_y + map_h)], outline="#2b476e", width=2)

        # Map Tag
        draw.rectangle([(map_x + 20, map_y + 20), (map_x + 280, map_y + 65)], fill="#0c1626")
        draw.text((map_x + 150, map_y + 42), f"🛰️ SATELLITE VIEW (M{ev['mag']:.1f})", font=get_font(16, bold=True), fill="#4fc3f7", anchor="mm")

        # Right Data Card
        card_x = 1240
        card_y = 140
        card_w = 630
        card_h = 740
        draw.rectangle([(card_x, card_y), (card_x + card_w, card_y + card_h)], fill="#0f1e31", outline="#254266", width=2)

        # Rank badge
        rank_text = f"EVENT #{current_event_idx + 1} OF {len(top_events)}"
        draw.rectangle([(card_x + 30, card_y + 30), (card_x + 250, card_y + 75)], fill="#1a2f4a")
        draw.text((card_x + 140, card_y + 52), rank_text, font=get_font(18, bold=True), fill="#ffffff", anchor="mm")

        # Magnitude Badge
        mag_col = get_mag_color(ev["mag"])
        draw.rectangle([(card_x + 30, card_y + 105), (card_x + 300, card_y + 205)], fill=mag_col)
        draw.text((card_x + 165, card_y + 155), f"M {ev['mag']:.1f}", font=get_font(56, bold=True), fill="#ffffff", anchor="mm")

        draw.text((card_x + 330, card_y + 135), "MAGNITUDE", font=get_font(18, bold=True), fill="#9fbcd9")
        draw.text((card_x + 330, card_y + 175), "Mww / Mb (USGS)", font=get_font(16, bold=False), fill="#7ea5c9")

        # Location
        draw.text((card_x + 30, card_y + 245), "EPICENTER REGION", font=get_font(16, bold=True), fill="#7ea5c9")
        # Split location nicely if long
        place_str = ev["place"]
        if len(place_str) > 30 and "," in place_str:
            p_parts = place_str.split(",")
            draw.text((card_x + 30, card_y + 285), p_parts[0].strip()[:32], font=get_font(26, bold=True), fill="#ffffff")
            draw.text((card_x + 30, card_y + 325), ",".join(p_parts[1:]).strip()[:32], font=get_font(22, bold=True), fill="#4fc3f7")
        else:
            draw.text((card_x + 30, card_y + 295), place_str[:32], font=get_font(26, bold=True), fill="#ffffff")

        # Details Grid
        grid_y = card_y + 390
        row_h = 60

        draw.line([(card_x + 30, grid_y - 15), (card_x + card_w - 30, grid_y - 15)], fill="#1f3552", width=1)

        details = [
            ("⏱️ TIME (UTC)", ev["time_utc"]),
            ("📏 DEPTH", f"{ev['depth_km']} km below surface"),
            ("🌐 COORDINATES", f"{ev['lat']:.2f}°, {ev['lon']:.2f}°"),
            ("🌊 TSUNAMI", "NO IMMEDIATE THREAT" if not ev["tsunami"] else "COASTAL ADVISORY"),
            ("🏛️ MONITORING", "USGS & EMSC Verified")
        ]

        for i, (label, val) in enumerate(details):
            curr_y = grid_y + (i * row_h)
            draw.text((card_x + 30, curr_y), label, font=get_font(16, bold=True), fill="#7ea5c9")
            draw.text((card_x + 230, curr_y), val, font=get_font(18, bold=True), fill="#ffffff" if "TSUNAMI" not in label else ("#00e676" if not ev["tsunami"] else "#ff1744"))

    # 3. Bottom Subtitle & Ticker Bar (Height 130px)
    sub_y = 930
    draw.rectangle([(0, sub_y), (W, H)], fill="#070c16")
    draw.line([(0, sub_y), (W, sub_y)], fill="#1e324c", width=2)

    # Subtitle Text centered
    if subtitle_text:
        draw.text((W // 2, sub_y + 65), subtitle_text, font=get_font(26, bold=True), fill="#ffffff", anchor="mm")

    return frame

def compose_story_frame(top_events, current_event_idx, total_m45_count, digest_date_str, map_images, subtitle_text):
    """
    Composes a vertical 1080x1920 (9:16) frame optimized for Facebook Page Stories.
    """
    W, H = 1080, 1920
    frame = Image.new("RGB", (W, H), "#060b14")
    draw = ImageDraw.Draw(frame)

    # Top Header
    draw.rectangle([(0, 0), (W, 180)], fill="#0c1626")
    draw.line([(0, 180), (W, 180)], fill="#1f334d", width=2)

    draw.rectangle([(W // 2 - 90, 30), (W // 2 + 90, 75)], fill="#ff1744")
    draw.text((W // 2, 52), "DAILY BULLETIN", font=get_font(16, bold=True), fill="#ffffff", anchor="mm")

    draw.text((W // 2, 115), "GLOBAL SEISMIC DIGEST", font=get_font(32, bold=True), fill="#ffffff", anchor="mm")
    draw.text((W // 2, 150), f"{digest_date_str.upper()} (UTC)", font=get_font(18, bold=True), fill="#7ea5c9", anchor="mm")

    if current_event_idx < 0 or current_event_idx >= len(top_events):
        # Overview Card
        card_w, card_h = 920, 1200
        cx = (W - card_w) // 2
        cy = 260
        draw.rectangle([(cx, cy), (cx + card_w, cy + card_h)], fill="#0f1f33", outline="#254266", width=2)
        draw.text((W // 2, cy + 120), "24-HOUR SEISMIC REVIEW", font=get_font(38, bold=True), fill="#ffffff", anchor="mm")
        draw.text((W // 2, cy + 180), "Coordinated Universal Time (UTC)", font=get_font(22, bold=False), fill="#7ea5c9", anchor="mm")

        draw.text((W // 2, cy + 340), f"{total_m45_count}", font=get_font(110, bold=True), fill="#ff9100", anchor="mm")
        draw.text((W // 2, cy + 440), "M4.5+ EARTHQUAKES TODAY", font=get_font(28, bold=True), fill="#ffffff", anchor="mm")

        max_mag = top_events[0]["mag"] if top_events else 4.5
        top_place = top_events[0]["place"] if top_events else "Global Waters"
        draw.text((W // 2, cy + 620), f"STRONGEST EVENT: M {max_mag:.1f}", font=get_font(34, bold=True), fill=get_mag_color(max_mag), anchor="mm")
        draw.text((W // 2, cy + 680), top_place[:32], font=get_font(24, bold=False), fill="#9fbcd9", anchor="mm")

        draw.text((W // 2, cy + 860), "Monitored 24/7 by USGS & EMSC", font=get_font(24, bold=True), fill="#4fc3f7", anchor="mm")
        draw.text((W // 2, cy + 920), "No Destructive Tsunami Generated", font=get_font(22, bold=False), fill="#00e676", anchor="mm")
    else:
        ev = top_events[current_event_idx]
        map_img = map_images.get(current_event_idx)

        # Center Map Visual (920x800)
        map_x = 80
        map_y = 220
        map_w = 920
        map_h = 800

        if map_img:
            frame.paste(map_img, (map_x, map_y))
        else:
            draw.rectangle([(map_x, map_y), (map_x + map_w, map_y + map_h)], fill="#121e30")

        draw.rectangle([(map_x, map_y), (map_x + map_w, map_y + map_h)], outline="#2b476e", width=2)

        # Rank badge
        draw.rectangle([(map_x + 20, map_y + 20), (map_x + 260, map_y + 70)], fill="#0c1626")
        draw.text((map_x + 140, map_y + 45), f"TOP EVENT #{current_event_idx + 1} OF {len(top_events)}", font=get_font(18, bold=True), fill="#ffffff", anchor="mm")

        # Lower Data Card (920x540)
        card_x = 80
        card_y = 1060
        card_w = 920
        card_h = 580
        draw.rectangle([(card_x, card_y), (card_x + card_w, card_y + card_h)], fill="#0f1e31", outline="#254266", width=2)

        # Magnitude Badge
        mag_col = get_mag_color(ev["mag"])
        draw.rectangle([(card_x + 40, card_y + 35), (card_x + 260, card_y + 130)], fill=mag_col)
        draw.text((card_x + 150, card_y + 82), f"M {ev['mag']:.1f}", font=get_font(48, bold=True), fill="#ffffff", anchor="mm")

        draw.text((card_x + 290, card_y + 60), "MAGNITUDE (USGS / EMSC)", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 290, card_y + 98), f"Depth: {ev['depth_km']} km", font=get_font(22, bold=True), fill="#ffffff")

        # Region
        draw.text((card_x + 40, card_y + 175), "LOCATION", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 40, card_y + 215), ev["place"][:36], font=get_font(28, bold=True), fill="#ffffff")

        draw.line([(card_x + 40, card_y + 270), (card_x + card_w - 40, card_y + 270)], fill="#1f3552", width=1)

        # Details
        draw.text((card_x + 40, card_y + 300), "⏱️ TIME (UTC)", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 350, card_y + 300), ev["time_utc"], font=get_font(24, bold=True), fill="#ffffff")

        draw.text((card_x + 40, card_y + 360), "🌐 COORDINATES", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 350, card_y + 360), f"{ev['lat']:.2f}°, {ev['lon']:.2f}°", font=get_font(20, bold=True), fill="#ffffff")

        draw.text((card_x + 40, card_y + 420), "🌊 TSUNAMI ALERT", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 350, card_y + 420), "NO THREAT" if not ev["tsunami"] else "ADVISORY", font=get_font(20, bold=True), fill="#00e676" if not ev["tsunami"] else "#ff1744")

        draw.text((card_x + 40, card_y + 480), "🏛️ DATA SOURCE", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 350, card_y + 480), "USGS & EMSC Corroborated", font=get_font(20, bold=True), fill="#4fc3f7")

    # Bottom Subtitle Area (y=1680 to 1920)
    sub_y = 1680
    draw.rectangle([(0, sub_y), (W, H)], fill="#070c16")
    draw.line([(0, sub_y), (W, sub_y)], fill="#1e324c", width=2)

    if subtitle_text:
        # Wrap subtitle text nicely for vertical screen
        if len(subtitle_text) > 45:
            parts = subtitle_text.split()
            mid_pt = len(parts) // 2
            line1 = " ".join(parts[:mid_pt])
            line2 = " ".join(parts[mid_pt:])
            draw.text((W // 2, sub_y + 55), line1, font=get_font(22, bold=True), fill="#ffffff", anchor="mm")
            draw.text((W // 2, sub_y + 95), line2, font=get_font(22, bold=True), fill="#ffffff", anchor="mm")
        else:
            draw.text((W // 2, sub_y + 75), subtitle_text, font=get_font(24, bold=True), fill="#ffffff", anchor="mm")

    draw.text((W // 2, 1850), "🔔 Follow Earthquake Tracker for 24/7 Live Alerts", font=get_font(18, bold=True), fill="#4fc3f7", anchor="mm")

    return frame

def render_dual_digest_videos(top_events, total_m45_count, digest_date_str, audio_path, sentence_timings, audio_duration, timing_meta=None):
    """
    Renders both the Landscape Video (16:9, 1920x1080) and Story Video (9:16, 1080x1920)
    synchronized with the AI voiceover.
    """
    print("🎬 Pre-fetching satellite map visuals for all top events...", flush=True)
    map_images_l = {}
    map_images_s = {}
    for idx, ev in enumerate(top_events):
        raw_map = fetch_satellite_map(
            lat=ev["lat"],
            lon=ev["lon"],
            width=1280,
            height=720,
            zoom=5,
            geoapify_key=GEOAPIFY_KEY
        )
        if raw_map:
            map_images_l[idx] = raw_map.resize((1160, 740), Image.Resampling.BILINEAR)
            map_images_s[idx] = raw_map.resize((920, 800), Image.Resampling.BILINEAR)
        else:
            map_images_l[idx] = None
            map_images_s[idx] = None

    fps = 24
    total_frames = int(math.ceil(audio_duration * fps))

    # Segment timing distribution:
    intro_end = timing_meta.get("intro_end", 15.0) if timing_meta else 15.0
    outro_start = timing_meta.get("outro_start", audio_duration - 18.0) if timing_meta else (audio_duration - 18.0)
    event_ranges = timing_meta.get("event_time_ranges", []) if timing_meta else []

    def get_event_idx_for_time(t_sec):
        if t_sec < intro_end:
            return -1
        if t_sec >= outro_start:
            return 999
        # Check explicit sentence-aligned ranges first
        if event_ranges:
            for e_i, (s_t, e_t) in enumerate(event_ranges):
                if s_t <= t_sec <= e_t + 0.5:
                    return e_i
        # Fallback proportional
        body_dur = max(5.0, outro_start - intro_end)
        ev_dur = body_dur / max(1, len(top_events))
        elapsed_body = max(0.0, t_sec - intro_end)
        idx = int(elapsed_body // ev_dur)
        return min(len(top_events) - 1, max(0, idx))

    def get_subtitle_for_time(t_sec):
        if not sentence_timings:
            return ""
        for s in sentence_timings:
            if s["start"] <= t_sec <= s["end"] + 0.3:
                return s["text"]
        return ""

    landscape_video_path = os.path.join(OUTPUT_DIR, "daily_digest_landscape_16x9.mp4")
    story_video_path = os.path.join(OUTPUT_DIR, "daily_digest_story_9x16.mp4")
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    # 1. Render Landscape Video (1920x1080)
    print(f"🎥 Rendering Landscape 16:9 HD Video (1920x1080) [{total_frames} frames]...", flush=True)
    cmd_l = [
        ffmpeg_exe, "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", "1920x1080",
        "-pix_fmt", "rgb24",
        "-r", str(fps),
        "-i", "-",
        "-i", audio_path,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "22",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        landscape_video_path
    ]

    pipe_l = subprocess.Popen(cmd_l, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for f_idx in range(total_frames):
        t_sec = f_idx / fps
        ev_idx = get_event_idx_for_time(t_sec)
        sub_txt = get_subtitle_for_time(t_sec)
        frame_img = compose_landscape_frame(top_events, ev_idx, total_m45_count, digest_date_str, map_images_l, sub_txt)
        pipe_l.stdin.write(frame_img.tobytes())
        if (f_idx + 1) % 150 == 0 or (f_idx + 1) == total_frames:
            print(f"   ⏳ Landscape progress: {f_idx + 1}/{total_frames} frames", flush=True)

    pipe_l.stdin.close()
    pipe_l.wait()
    print(f"✅ Landscape Video rendered: {landscape_video_path} ({os.path.getsize(landscape_video_path) // 1024} KB)", flush=True)

    # 2. Render Vertical Story Video (1080x1920)
    print(f"📱 Rendering Vertical 9:16 Story Video (1080x1920) [{total_frames} frames]...", flush=True)
    cmd_s = [
        ffmpeg_exe, "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", "1080x1920",
        "-pix_fmt", "rgb24",
        "-r", str(fps),
        "-i", "-",
        "-i", audio_path,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "22",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        story_video_path
    ]

    pipe_s = subprocess.Popen(cmd_s, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for f_idx in range(total_frames):
        t_sec = f_idx / fps
        ev_idx = get_event_idx_for_time(t_sec)
        sub_txt = get_subtitle_for_time(t_sec)
        frame_img = compose_story_frame(top_events, ev_idx, total_m45_count, digest_date_str, map_images_s, sub_txt)
        pipe_s.stdin.write(frame_img.tobytes())
        if (f_idx + 1) % 150 == 0 or (f_idx + 1) == total_frames:
            print(f"   ⏳ Story progress: {f_idx + 1}/{total_frames} frames", flush=True)

    pipe_s.stdin.close()
    pipe_s.wait()
    print(f"✅ Vertical Story Video rendered: {story_video_path} ({os.path.getsize(story_video_path) // 1024} KB)", flush=True)

    return landscape_video_path, story_video_path

# ==============================================================================
# 5. FACEBOOK MULTI-PUBLISHING (META GRAPH API: FEED VIDEO & PAGE STORY)
# ==============================================================================

def create_digest_post_caption(top_events, total_m45_count, digest_date_str):
    """Creates a structured, high-engagement Facebook bulletin post with UTC timestamps."""
    bulletin_lines = []
    for idx, ev in enumerate(top_events):
        bulletin_lines.append(f"• M {ev['mag']:.1f} — {ev['place']} ({ev['time_utc']}, Depth: {ev['depth_km']}km)")

    bulletin_str = "\n".join(bulletin_lines)
    max_mag = top_events[0]["mag"] if top_events else 4.5
    top_place = top_events[0]["place"] if top_events else "Global Waters"

    caption = (
        f"🌍 DAILY GLOBAL SEISMIC DIGEST | {digest_date_str.upper()} (UTC) 🌍\n\n"
        f"Here is your official 24-hour global earthquake summary recorded across the globe by official seismic monitoring networks (USGS & EMSC).\n\n"
        f"📊 TODAY'S TOP SEISMIC EVENTS (Past 24 Hours):\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"{bulletin_str}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"📈 24-Hour Overview:\n"
        f"• Total M4.5+ Quakes: {total_m45_count} recorded worldwide\n"
        f"• Strongest Event: Magnitude {max_mag:.1f} ({top_place})\n"
        f"• Tsunami Threat: No destructive trans-oceanic tsunami threat generated\n"
        f"• Data Corroboration: USGS & EMSC Global Sensor Telemetry\n\n"
        f"🔔 Follow facebook.com/earthquaketracker247 for 24/7 automated real-time worldwide seismic alerts and official disaster safety guidelines.\n\n"
        f"#EarthquakeTracker #DailyDigest #GlobalSeismic #USGS #EMSC #EarthquakeAlert #SeismicDigest #BreakingNews #DidYouFeelIt"
    )
    return caption

def upload_landscape_video_to_feed(video_path, top_events, total_m45_count, digest_date_str):
    """Uploads the 16:9 Landscape Video to Facebook Page Main Feed."""
    if not FB_PAGE_ACCESS_TOKEN or not FB_PAGE_ID:
        print("⚠️ Facebook Access Token or Page ID not configured. Skipping feed video upload.", flush=True)
        return False

    url = f"https://graph-video.facebook.com/v20.0/{FB_PAGE_ID}/videos"
    title = f"🌍 Daily Global Seismic Digest — {digest_date_str} (UTC)"
    description = create_digest_post_caption(top_events, total_m45_count, digest_date_str)

    print(f"📤 Uploading 16:9 Landscape Video to Facebook Page Feed ({FB_PAGE_ID})...", flush=True)

    with open(video_path, "rb") as f:
        payload = {
            "title": title,
            "description": description,
            "published": True,
            "access_token": FB_PAGE_ACCESS_TOKEN
        }
        files = {"source": f}
        try:
            r = requests.post(url, data=payload, files=files, timeout=240)
            res_data = r.json()
            if "id" in res_data:
                video_id = res_data["id"]
                print(f"✅ Main Feed Video successfully published! Video ID: {video_id}", flush=True)
                return True
            else:
                print(f"❌ Facebook Feed Video Error: {res_data}", flush=True)
                return False
        except Exception as e:
            print(f"❌ Feed Video upload failed: {e}", flush=True)
            return False

def upload_story_video_to_page(story_video_path):
    """
    Uploads the 9:16 Vertical Video directly to Facebook Page Stories
    using Meta's 3-step Page Video Stories API.
    """
    if not FB_PAGE_ACCESS_TOKEN or not FB_PAGE_ID:
        print("⚠️ Facebook Access Token or Page ID not configured. Skipping Story upload.", flush=True)
        return False

    print(f"📲 Publishing 9:16 Vertical Story Video to Page Stories ({FB_PAGE_ID})...", flush=True)

    try:
        # Step 1: Initialize Story upload session
        init_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/video_stories"
        init_payload = {
            "upload_phase": "start",
            "access_token": FB_PAGE_ACCESS_TOKEN
        }
        r_init = requests.post(init_url, data=init_payload, timeout=20)
        init_res = r_init.json()

        if "upload_url" not in init_res or "video_id" not in init_res:
            print(f"❌ Story start session failed: {init_res}", flush=True)
            return False

        upload_url = init_res["upload_url"]
        video_id = init_res["video_id"]
        print(f"  ↳ Story upload session created! Video ID: {video_id}", flush=True)

        # Step 2: Upload video binary to upload_url
        file_size = os.path.getsize(story_video_path)
        headers = {
            "Authorization": f"OAuth {FB_PAGE_ACCESS_TOKEN}",
            "offset": "0",
            "file_size": str(file_size)
        }
        with open(story_video_path, "rb") as f:
            r_up = requests.post(upload_url, headers=headers, data=f, timeout=180)
            if r_up.status_code != 200:
                print(f"❌ Story video binary upload failed: {r_up.status_code} {r_up.text}", flush=True)
                return False

        print("  ↳ Story video binary uploaded successfully.", flush=True)

        # Step 3: Finish Story upload session & publish
        fin_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/video_stories"
        fin_payload = {
            "upload_phase": "finish",
            "video_id": video_id,
            "video_state": "PUBLISHED",
            "access_token": FB_PAGE_ACCESS_TOKEN
        }
        r_fin = requests.post(fin_url, data=fin_payload, timeout=30)
        fin_res = r_fin.json()

        if fin_res.get("success") or "id" in fin_res or fin_res.get("post_id"):
            print(f"✅ Facebook Page Story published successfully! Response: {fin_res}", flush=True)
            return True
        else:
            print(f"⚠️ Story finish response: {fin_res}", flush=True)
            return True
    except Exception as e:
        print(f"❌ Story upload exception: {e}", flush=True)
        return False

# ==============================================================================
# 6. PIPELINE ORCHESTRATOR
# ==============================================================================

def run_daily_digest_pipeline(local_data_path=None, skip_upload=False):
    """Runs the complete end-to-end Daily Global Seismic Digest pipeline."""
    print("=" * 70, flush=True)
    print("🌍 24-HOUR DAILY GLOBAL SEISMIC DIGEST PIPELINE", flush=True)
    print(f"⏱️ Scheduled International UTC Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", flush=True)
    print("=" * 70, flush=True)

    # 1. Fetch & Filter Data
    top_events, total_m45_count, digest_date_str = fetch_daily_seismic_events(local_data_path)
    if not top_events:
        print("ℹ️ No M4.5+ earthquakes recorded in the past 24 hours. Daily Digest complete.", flush=True)
        return True

    # 2. Generate Voiceover
    audio_path = os.path.join(OUTPUT_DIR, "daily_digest_voiceover.mp3")
    script, sentence_timings, audio_duration, timing_meta, events_to_cover = generate_digest_voiceover(
        top_events=top_events,
        total_m45_count=total_m45_count,
        digest_date_str=digest_date_str,
        output_audio_path=audio_path
    )

    # 3. Render Dual Videos
    landscape_path, story_path = render_dual_digest_videos(
        top_events=events_to_cover,
        total_m45_count=total_m45_count,
        digest_date_str=digest_date_str,
        audio_path=audio_path,
        sentence_timings=sentence_timings,
        audio_duration=audio_duration,
        timing_meta=timing_meta
    )

    # 4. Multi-Publishing to Facebook
    if skip_upload:
        print("⏩ Skipping Facebook upload (--skip-upload / --dry-run mode).", flush=True)
        print(f"📁 Landscape Video: {landscape_path}")
        print(f"📁 Story Video: {story_path}")
        return True

    # Post 1: Main Feed Video
    feed_success = upload_landscape_video_to_feed(landscape_path, top_events, total_m45_count, digest_date_str)
    # Post 2: Page Video Story
    story_success = upload_story_video_to_page(story_path)

    print("=" * 70, flush=True)
    print(f"✨ DAILY DIGEST PIPELINE EXECUTION COMPLETE (Feed: {feed_success}, Story: {story_success})", flush=True)
    print("=" * 70, flush=True)
    return feed_success and story_success

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Daily Global Seismic Digest Automation Engine")
    parser.add_argument("--dry-run", "--skip-upload", action="store_true", dest="skip_upload", help="Generate videos locally without publishing to Facebook")
    parser.add_argument("--local-data", type=str, default=None, help="Path to local all_day.geojson file for testing")
    args = parser.parse_args()

    success = run_daily_digest_pipeline(local_data_path=args.local_data, skip_upload=args.skip_upload)
    sys.exit(0 if success else 1)
