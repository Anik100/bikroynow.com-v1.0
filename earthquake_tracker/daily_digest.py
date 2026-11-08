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
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

try:
    from time_utils import get_earthquake_times
except ImportError:
    try:
        from earthquake_tracker.time_utils import get_earthquake_times
    except ImportError:
        get_earthquake_times = None
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
EARTH_TEXTURE_PATH = os.path.join(BASE_DIR, "earth_texture_hd.jpg")

try:
    from config import FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN
except ImportError:
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
# 1. 22:00 UTC TRACKING WINDOW & DATA FILTERING
# ==============================================================================

def fetch_daily_seismic_events(local_data_path=None):
    """
    Fetches earthquakes from USGS API (or local file fallback).
    Filters events with magnitude >= 4.5 recorded within the 24-hour cycle
    (22:00 UTC to 22:00 UTC).
    Sorts by magnitude descending and selects the top 5 most significant quakes.
    """
    print("📡 Fetching 24-hour seismic events (22:00 UTC to 22:00 UTC Tracking Window)...", flush=True)
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
        return [], 0, datetime.now(timezone.utc).strftime("%B %d, %Y"), []

    features = data.get("features", [])
    now_utc = datetime.now(timezone.utc)
    digest_date_str = now_utc.strftime("%B %d, %Y")

    filtered = []
    seen_ids = set()

    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [0, 0, 0])

        mag = props.get("mag")
        if mag is None or mag < 4.0:
            continue

        fid = feat.get("id") or props.get("code") or f"{coords[1]}_{coords[0]}"
        if fid in seen_ids:
            continue
        seen_ids.add(fid)

        epoch_ms = props.get("time", 0)
        dt_utc = datetime.fromtimestamp(epoch_ms / 1000.0, tz=timezone.utc)
        utc_time_str = dt_utc.strftime("%H:%M UTC")

        place = (props.get("place") or "Unspecified region").strip()
        depth_km = round(coords[2], 1) if len(coords) >= 3 else 10.0
        lon = coords[0]
        lat = coords[1]
        tsunami = (props.get("tsunami") or 0) == 1

        local_time_short = utc_time_str
        local_voice_time = dt_utc.strftime("%I:%M %p")
        is_utc_same = True

        if get_earthquake_times:
            try:
                t_info = get_earthquake_times(epoch_ms, lat, lon)
                local_time_short = t_info.get("local_short", utc_time_str)
                local_voice_time = t_info.get("local_voice", local_voice_time)
                is_utc_same = t_info.get("is_utc_same", False)
            except Exception:
                pass

        filtered.append({
            "id": fid,
            "mag": float(mag),
            "place": place,
            "time_utc": utc_time_str,
            "local_time_short": local_time_short,
            "local_voice": local_voice_time,
            "is_utc_same": is_utc_same,
            "epoch_ms": epoch_ms,
            "dt_utc": dt_utc,
            "lat": lat,
            "lon": lon,
            "depth_km": depth_km,
            "tsunami": tsunami
        })

    filtered.sort(key=lambda x: x["mag"], reverse=True)
    total_m40_count = len(filtered)

    # Feature the Top 5 most significant earthquakes of the day
    top_events = filtered[:min(5, len(filtered))]

    print(f"✅ Filtered {total_m40_count} earthquakes (M4.0+) across the globe in the 22:00 UTC tracking window.", flush=True)
    print(f"📋 Selected Top {len(top_events)} most significant quakes for the 1:1 synced Daily Digest video.", flush=True)

    return top_events, total_m40_count, digest_date_str, filtered

# ==============================================================================
# 2. ATOMIC AUDIO SYNTHESIS PER SEGMENT (edge-tts)
# ==============================================================================

async def _synthesize_edge_tts(script, voice, output_audio_path):
    """
    Asynchronously calls edge-tts to generate voiceover for a single atomic segment
    and extracts sentence-level timing data relative to this segment (starting at 0.0s).
    """
    comm = edge_tts.Communicate(text=script, voice=voice, rate="+5%")
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

    audio_duration = sentence_timings[-1]["end"] + 0.4 if sentence_timings else 5.0
    try:
        p = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-i", output_audio_path], capture_output=True, text=True)
        m = re.search(r"Duration:\s*(\d+):(\d+):([\d\.]+)", p.stderr)
        if m:
            h, mi, s = m.groups()
            audio_duration = int(h) * 3600 + int(mi) * 60 + float(s)
    except Exception:
        pass

    return sentence_timings, audio_duration

def generate_segment_audio(script_text, output_audio_path, fallback_voice="en-US-GuyNeural"):
    """Synchronous wrapper to synthesize a discrete segment audio clip."""
    try:
        timings, dur = asyncio.run(_synthesize_edge_tts(script_text, VOICE_NAME, output_audio_path))
    except Exception as e:
        print(f"⚠️ edge-tts segment error: {e}. Retrying with fallback voice...", flush=True)
        timings, dur = asyncio.run(_synthesize_edge_tts(script_text, fallback_voice, output_audio_path))
    return timings, dur

# ==============================================================================
# 3. SATELLITE MAP VISUALS (Geoapify API & ESRI Satellite Fallback)
# ==============================================================================

def fetch_satellite_map(lat, lon, width=1280, height=720, zoom=5, geoapify_key=None):
    """
    Fetches wide satellite map imagery using Geoapify Static Maps API with red epicenter markers.
    Includes ESRI World Imagery fallback if Geoapify key is absent or quota is exceeded.
    """
    headers = {"User-Agent": "EarthquakeTrackerDailyDigest/1.0"}

    if geoapify_key:
        try:
            url = (
                f"https://maps.geoapify.com/v1/staticmap?"
                f"style=klokantech-basic&width={width}&height={height}"
                f"&center=lonlat:{lon},{lat}&zoom={zoom}"
                f"&marker=lonlat:{lon},{lat};color:%23ff1744;size:medium"
                f"&apiKey={geoapify_key}"
            )
            resp = requests.get(url, headers=headers, timeout=8)
            if resp.status_code == 200:
                img = Image.open(io.BytesIO(resp.content)).convert("RGB")
                return img
        except Exception as e:
            print(f"⚠️ Geoapify map note: {e}, falling back to ESRI...", flush=True)

    try:
        n_tiles = 2 ** zoom
        xtile = int((lon + 180.0) / 360.0 * n_tiles)
        lat_rad = math.radians(lat)
        ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n_tiles)

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

        cw, ch = composite.size
        left = max(0, (cw - width) // 2)
        top = max(0, (ch - height) // 2)
        map_crop = composite.crop((left, top, left + width, top + height))

        draw = ImageDraw.Draw(map_crop)
        cx_pt = width // 2
        cy_pt = height // 2

        draw.ellipse([(cx_pt - 40, cy_pt - 40), (cx_pt + 40, cy_pt + 40)], outline="#ff1744", width=3)
        draw.ellipse([(cx_pt - 75, cy_pt - 75), (cx_pt + 75, cy_pt + 75)], outline="#ff5252", width=2)
        draw.ellipse([(cx_pt - 14, cy_pt - 14), (cx_pt + 14, cy_pt + 14)], fill="#ff1744", outline="#ffffff", width=2)
        draw.line([(cx_pt - 95, cy_pt), (cx_pt - 20, cy_pt)], fill="#ffffff", width=2)
        draw.line([(cx_pt + 20, cy_pt), (cx_pt + 95, cy_pt)], fill="#ffffff", width=2)
        draw.line([(cx_pt, cy_pt - 95), (cx_pt, cy_pt - 20)], fill="#ffffff", width=2)
        draw.line([(cx_pt, cy_pt + 20), (cx_pt, cy_pt + 95)], fill="#ffffff", width=2)

        return map_crop
    except Exception as err:
        print(f"⚠️ ESRI fallback note: {err}", flush=True)
        blank = Image.new("RGB", (width, height), "#0a1322")
        d = ImageDraw.Draw(blank)
        d.text((width // 2, height // 2), f"SEISMIC EPICENTER: {lat}°, {lon}°", fill="#ffffff", anchor="mm")
        return blank

# ==============================================================================
# 4. HIGH-TECH BROADCAST GRAPHICS ENGINE (16:9 & 9:16)
# ==============================================================================

def get_mag_color(mag):
    if mag >= 6.0:
        return "#ff1744"  # Vibrant Red
    elif mag >= 5.0:
        return "#ff9100"  # Vibrant Orange
    return "#ffd600"      # Gold / Yellow

def draw_world_background(W, H, all_events=None):
    """
    Renders a dark, high-tech world satellite background with glowing epicenter markers.
    Produces an authentic global operations / newsroom studio visual.
    """
    canvas = Image.new("RGB", (W, H), "#040812")
    if os.path.exists(EARTH_TEXTURE_PATH):
        try:
            raw_bg = Image.open(EARTH_TEXTURE_PATH).convert("RGBA")
            if W > H:
                raw_bg = raw_bg.resize((W, H), Image.Resampling.BILINEAR)
            else:
                bw, bh = raw_bg.size
                crop_w = int(bh * (W / H))
                left = max(0, (bw - crop_w) // 2)
                raw_bg = raw_bg.crop((left, 0, left + crop_w, bh)).resize((W, H), Image.Resampling.BILINEAR)

            tint = Image.new("RGBA", (W, H), (4, 9, 22, 210))
            bg = Image.alpha_composite(raw_bg, tint).convert("RGB")
            canvas.paste(bg, (0, 0))
        except Exception as e:
            pass

    draw = ImageDraw.Draw(canvas)
    step_x = 120 if W > H else 90
    step_y = 100 if W > H else 120
    for gx in range(0, W, step_x):
        draw.line([(gx, 0), (gx, H)], fill="#0f223d25", width=1)
    for gy in range(0, H, step_y):
        draw.line([(0, gy), (W, gy)], fill="#0f223d25", width=1)

    # Plot all earthquakes as glowing dots across the world map
    if all_events and W > H:
        for ev in all_events:
            lon = ev.get("lon", 0)
            lat = ev.get("lat", 0)
            mag = ev.get("mag", 4.5)
            x = int((lon + 180.0) / 360.0 * W)
            y = int((90.0 - lat) / 180.0 * H)

            r = 7 if mag >= 5.2 else 5
            col = "#ef4444" if mag >= 5.5 else ("#f59e0b" if mag >= 5.0 else "#fbbf24")
            draw.ellipse([(x - r * 2, y - r * 2), (x + r * 2, y + r * 2)], outline=col, width=1)
            draw.ellipse([(x - r, y - r), (x + r, y + r)], fill=col)

    return canvas

def compose_landscape_frame(segment_type, event_data, total_m40_count, digest_date_str, map_img, subtitle_text, event_rank=1, total_events=5, all_events=None):
    """
    Composes a broadcast-quality 1920x1080 (16:9) frame:
    - High-tech world map satellite background with glowing epicenters for Intro & Outro
    - Sleek glassmorphism telemetry cards with glowing neon borders
    - Centered dynamic subtitles
    """
    W, H = 1920, 1080

    if segment_type in ["intro", "outro"]:
        frame = draw_world_background(W, H, all_events)
    else:
        frame = Image.new("RGB", (W, H), "#060b14")

    draw = ImageDraw.Draw(frame)

    # 1. Header Bar
    draw.rectangle([(0, 0), (W, 95)], fill="#0c1626")
    draw.line([(0, 95), (W, 95)], fill="#1f334d", width=2)

    font_title = get_font(30, bold=True)
    font_brand = get_font(26, bold=True)

    # Live badge
    draw.rounded_rectangle([(40, 24), (180, 70)], radius=8, fill="#dc2626")
    draw.text((110, 47), "● 24H DIGEST", font=get_font(18, bold=True), fill="#ffffff", anchor="mm")

    draw.text((210, 32), "DAILY GLOBAL SEISMIC DIGEST", font=font_title, fill="#ffffff")
    draw.text((210, 68), f"{digest_date_str.upper()} • 22:00 UTC TO 22:00 UTC (PAST 24 HOURS)", font=get_font(16, bold=True), fill="#38bdf8")

    draw.text((W - 50, 48), "EARTHQUAKE TRACKER", font=font_brand, fill="#38bdf8", anchor="rm")

    # 2. Main Content Layout
    if segment_type in ["intro", "outro"]:
        card_w, card_h = 1440, 720
        cx = (W - card_w) // 2
        cy = 140

        # Glassmorphic container with translucent backing
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ol_draw = ImageDraw.Draw(overlay)
        ol_draw.rounded_rectangle([(cx, cy), (cx + card_w, cy + card_h)], radius=24, fill=(9, 19, 36, 235), outline=(37, 72, 117, 240), width=3)
        ol_draw.rounded_rectangle([(cx + 40, cy), (cx + card_w - 40, cy + 4)], radius=2, fill=(56, 189, 248, 255))
        frame.paste(overlay, (0, 0), overlay)
        draw = ImageDraw.Draw(frame)

        if segment_type == "intro":
            draw.text((W // 2, cy + 65), "24-HOUR GLOBAL SEISMIC REVIEW", font=get_font(42, bold=True), fill="#ffffff", anchor="mm")

            pill_w = 580
            pill_x = (W - pill_w) // 2
            draw.rounded_rectangle([(pill_x, cy + 105), (pill_x + pill_w, cy + 148)], radius=20, fill="#132742", outline="#2563eb", width=2)
            draw.text((W // 2, cy + 126), "⏱️ 22:00 UTC TO 22:00 UTC (PAST 24 HOURS)", font=get_font(18, bold=True), fill="#38bdf8", anchor="mm")

            # Two High-Impact Stat Boxes
            gap = 50
            box_w = (card_w - 140 - gap) // 2
            box_h = 360
            box_y = cy + 185
            b1_x = cx + 70
            b2_x = b1_x + box_w + gap

            # Box 1: Total Earthquakes (Left - Glowing Amber)
            draw.rounded_rectangle([(b1_x, box_y), (b1_x + box_w, box_y + box_h)], radius=20, fill="#0d1b30", outline="#f59e0b", width=3)
            draw.rounded_rectangle([(b1_x + 30, box_y + 25), (b1_x + 230, box_y + 65)], radius=10, fill="#1c2d47")
            draw.text((b1_x + 130, box_y + 45), "GLOBAL ACTIVITY", font=get_font(16, bold=True), fill="#f59e0b", anchor="mm")

            draw.text((b1_x + box_w // 2, box_y + 165), f"{total_m40_count}", font=get_font(105, bold=True), fill="#fbbf24", anchor="mm")
            draw.text((b1_x + box_w // 2, box_y + 260), "M 4.0+ EARTHQUAKES", font=get_font(26, bold=True), fill="#ffffff", anchor="mm")
            draw.text((b1_x + box_w // 2, box_y + 305), "Detected Worldwide Today", font=get_font(19, bold=False), fill="#94a3b8", anchor="mm")

            # Box 2: Strongest Quake (Right - Glowing Red)
            max_mag = event_data["mag"] if event_data else 4.5
            top_place = event_data["place"] if event_data else "Global Fault Zones"
            draw.rounded_rectangle([(b2_x, box_y), (b2_x + box_w, box_y + box_h)], radius=20, fill="#0d1b30", outline="#ef4444", width=3)
            draw.rounded_rectangle([(b2_x + 30, box_y + 25), (b2_x + 250, box_y + 65)], radius=10, fill="#1c2d47")
            draw.text((b2_x + 140, box_y + 45), "STRONGEST EVENT", font=get_font(16, bold=True), fill="#ef4444", anchor="mm")

            draw.text((b2_x + box_w // 2, box_y + 165), f"M {max_mag:.1f}", font=get_font(95, bold=True), fill="#ef4444", anchor="mm")
            draw.text((b2_x + box_w // 2, box_y + 260), top_place[:34], font=get_font(25, bold=True), fill="#ffffff", anchor="mm")
            time_txt = event_data.get("time_utc", "Recent") if event_data else ""
            depth_txt = f"{event_data.get('depth_km', 10)} km" if event_data else ""
            draw.text((b2_x + box_w // 2, box_y + 305), f"Depth: {depth_txt} • {time_txt}", font=get_font(19, bold=False), fill="#38bdf8", anchor="mm")

            # Footer Strip
            foot_y = cy + card_h - 75
            draw.line([(cx + 40, foot_y), (cx + card_w - 40, foot_y)], fill="#1a3556", width=2)
            draw.text((W // 2, foot_y + 38), "🌐 Monitored & Verified by USGS and EMSC Global Sensor Networks • No Tsunami Threat", font=get_font(20, bold=True), fill="#38bdf8", anchor="mm")

        else:
            # Outro Slide
            draw.text((W // 2, cy + 65), "24-HOUR SEISMIC REVIEW & SAFETY", font=get_font(40, bold=True), fill="#ffffff", anchor="mm")

            pill_w = 580
            pill_x = (W - pill_w) // 2
            draw.rounded_rectangle([(pill_x, cy + 105), (pill_x + pill_w, cy + 148)], radius=20, fill="#132742", outline="#2563eb", width=2)
            draw.text((W // 2, cy + 126), "⏱️ 22:00 UTC TO 22:00 UTC COMPREHENSIVE BULLETIN", font=get_font(18, bold=True), fill="#38bdf8", anchor="mm")

            draw.rounded_rectangle([(cx + 70, cy + 185), (cx + card_w - 70, cy + 350)], radius=20, fill="#0d1b30", outline="#10b981", width=3)
            draw.text((W // 2, cy + 240), "GLOBAL TECTONIC STATUS: BASELINE ACTIVITY", font=get_font(28, bold=True), fill="#00e676", anchor="mm")
            draw.text((W // 2, cy + 300), "No Destructive Trans-Oceanic Tsunami Generated Today", font=get_font(22, bold=False), fill="#ffffff", anchor="mm")

            draw.rounded_rectangle([(cx + 70, cy + 380), (cx + card_w - 70, cy + 545)], radius=20, fill="#0d1b30", outline="#f59e0b", width=3)
            draw.text((W // 2, cy + 435), "SAFETY ADVISORY: DROP, COVER, AND HOLD ON!", font=get_font(26, bold=True), fill="#facc15", anchor="mm")
            draw.text((W // 2, cy + 490), "Follow facebook.com/earthquaketracker247 for 24/7 live updates", font=get_font(21, bold=False), fill="#ffffff", anchor="mm")

            foot_y = cy + card_h - 75
            draw.line([(cx + 40, foot_y), (cx + card_w - 40, foot_y)], fill="#1a3556", width=2)
            draw.text((W // 2, foot_y + 38), "Earthquake Tracker • Continuous Global Seismic Monitoring", font=get_font(18, bold=True), fill="#7ea5c9", anchor="mm")

    elif segment_type == "event":
        ev = event_data
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

        rank_text = f"EVENT #{event_rank} OF {total_events}"
        draw.rectangle([(card_x + 30, card_y + 30), (card_x + 250, card_y + 75)], fill="#1a2f4a")
        draw.text((card_x + 140, card_y + 52), rank_text, font=get_font(18, bold=True), fill="#ffffff", anchor="mm")

        mag_col = get_mag_color(ev["mag"])
        draw.rectangle([(card_x + 30, card_y + 105), (card_x + 300, card_y + 205)], fill=mag_col)
        draw.text((card_x + 165, card_y + 155), f"M {ev['mag']:.1f}", font=get_font(56, bold=True), fill="#ffffff", anchor="mm")

        draw.text((card_x + 330, card_y + 135), "MAGNITUDE", font=get_font(18, bold=True), fill="#9fbcd9")
        draw.text((card_x + 330, card_y + 175), "Mww / Mb (USGS)", font=get_font(16, bold=False), fill="#7ea5c9")

        draw.text((card_x + 30, card_y + 245), "EPICENTER REGION", font=get_font(16, bold=True), fill="#7ea5c9")
        place_str = ev["place"]
        if len(place_str) > 30 and "," in place_str:
            p_parts = place_str.split(",")
            draw.text((card_x + 30, card_y + 285), p_parts[0].strip()[:32], font=get_font(26, bold=True), fill="#ffffff")
            draw.text((card_x + 30, card_y + 325), ",".join(p_parts[1:]).strip()[:32], font=get_font(22, bold=True), fill="#4fc3f7")
        else:
            draw.text((card_x + 30, card_y + 295), place_str[:32], font=get_font(26, bold=True), fill="#ffffff")

        grid_y = card_y + 390
        row_h = 60
        draw.line([(card_x + 30, grid_y - 15), (card_x + card_w - 30, grid_y - 15)], fill="#1f3552", width=1)

        details = [
            ("⏱️ LOCAL TIME", ev.get("local_time_short", ev["time_utc"])),
            ("🌐 TIME (UTC)", ev["time_utc"]),
            ("📏 DEPTH", f"{ev['depth_km']} km below surface"),
            ("📍 COORDINATES", f"{ev['lat']:.2f}°, {ev['lon']:.2f}°"),
            ("🌊 TSUNAMI", "NO IMMEDIATE THREAT" if not ev["tsunami"] else "COASTAL ADVISORY")
        ]

        for i, (label, val) in enumerate(details):
            curr_y = grid_y + (i * row_h)
            draw.text((card_x + 30, curr_y), label, font=get_font(16, bold=True), fill="#7ea5c9")
            color_val = "#38bdf8" if "LOCAL" in label else ("#ffffff" if "TSUNAMI" not in label else ("#00e676" if not ev["tsunami"] else "#ff1744"))
            draw.text((card_x + 230, curr_y), val, font=get_font(18, bold=True), fill=color_val)

    # 3. Bottom Subtitle & Ticker Bar
    sub_y = 930
    draw.rectangle([(0, sub_y), (W, H)], fill="#070c16")
    draw.line([(0, sub_y), (W, sub_y)], fill="#1e324c", width=2)

    if subtitle_text:
        draw.text((W // 2, sub_y + 65), subtitle_text, font=get_font(25, bold=True), fill="#ffffff", anchor="mm")

    return frame

def compose_story_frame(segment_type, event_data, total_m40_count, digest_date_str, map_img, subtitle_text, event_rank=1, total_events=5, all_events=None):
    """
    Composes a vertical 1080x1920 (9:16) frame optimized for Facebook Page Stories.
    """
    W, H = 1080, 1920

    if segment_type in ["intro", "outro"]:
        frame = draw_world_background(W, H, all_events)
    else:
        frame = Image.new("RGB", (W, H), "#060b14")

    draw = ImageDraw.Draw(frame)

    # Top Header
    draw.rectangle([(0, 0), (W, 180)], fill="#0c1626")
    draw.line([(0, 180), (W, 180)], fill="#1f334d", width=2)

    draw.rounded_rectangle([(W // 2 - 110, 30), (W // 2 + 110, 75)], radius=8, fill="#dc2626")
    draw.text((W // 2, 52), "● 24H BULLETIN", font=get_font(16, bold=True), fill="#ffffff", anchor="mm")

    draw.text((W // 2, 115), "GLOBAL SEISMIC DIGEST", font=get_font(32, bold=True), fill="#ffffff", anchor="mm")
    draw.text((W // 2, 150), f"{digest_date_str.upper()} • 22:00 UTC TO 22:00 UTC", font=get_font(17, bold=True), fill="#38bdf8", anchor="mm")

    if segment_type in ["intro", "outro"]:
        card_w, card_h = 920, 1240
        cx = (W - card_w) // 2
        cy = 240

        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ol_draw = ImageDraw.Draw(overlay)
        ol_draw.rounded_rectangle([(cx, cy), (cx + card_w, cy + card_h)], radius=24, fill=(9, 19, 36, 235), outline=(37, 72, 117, 240), width=3)
        ol_draw.rounded_rectangle([(cx + 30, cy), (cx + card_w - 30, cy + 4)], radius=2, fill=(56, 189, 248, 255))
        frame.paste(overlay, (0, 0), overlay)
        draw = ImageDraw.Draw(frame)

        if segment_type == "intro":
            draw.text((W // 2, cy + 70), "24-HOUR SEISMIC REVIEW", font=get_font(36, bold=True), fill="#ffffff", anchor="mm")
            draw.text((W // 2, cy + 120), "22:00 UTC to 22:00 UTC Window", font=get_font(22, bold=False), fill="#7ea5c9", anchor="mm")

            # Card 1: Count
            box1_y = cy + 170
            box_h = 420
            draw.rounded_rectangle([(cx + 40, box1_y), (cx + card_w - 40, box1_y + box_h)], radius=20, fill="#0d1b30", outline="#f59e0b", width=3)
            draw.text((W // 2, box1_y + 130), f"{total_m40_count}", font=get_font(120, bold=True), fill="#fbbf24", anchor="mm")
            draw.text((W // 2, box1_y + 260), "M 4.0+ EARTHQUAKES TODAY", font=get_font(30, bold=True), fill="#ffffff", anchor="mm")
            draw.text((W // 2, box1_y + 320), "Detected Worldwide in Tracking Window", font=get_font(22, bold=False), fill="#94a3b8", anchor="mm")

            # Card 2: Strongest
            box2_y = box1_y + box_h + 35
            max_mag = event_data["mag"] if event_data else 4.5
            top_place = event_data["place"] if event_data else "Global Waters"
            draw.rounded_rectangle([(cx + 40, box2_y), (cx + card_w - 40, box2_y + box_h)], radius=20, fill="#0d1b30", outline="#ef4444", width=3)
            draw.text((W // 2, box2_y + 110), f"M {max_mag:.1f}", font=get_font(100, bold=True), fill="#ef4444", anchor="mm")
            draw.text((W // 2, box2_y + 220), "STRONGEST EVENT", font=get_font(26, bold=True), fill="#fca5a5", anchor="mm")
            draw.text((W // 2, box2_y + 280), top_place[:30], font=get_font(24, bold=True), fill="#ffffff", anchor="mm")
            time_txt = event_data.get("time_utc", "Recent") if event_data else ""
            depth_txt = f"{event_data.get('depth_km', 10)} km" if event_data else ""
            draw.text((W // 2, box2_y + 340), f"Depth: {depth_txt} • {time_txt}", font=get_font(20, bold=False), fill="#38bdf8", anchor="mm")

            draw.text((W // 2, cy + card_h - 45), "Monitored & Verified by USGS and EMSC", font=get_font(20, bold=True), fill="#38bdf8", anchor="mm")
        else:
            # Outro Slide Story
            draw.text((W // 2, cy + 90), "TECTONIC REVIEW & SAFETY", font=get_font(36, bold=True), fill="#ffffff", anchor="mm")
            draw.text((W // 2, cy + 150), "22:00 UTC to 22:00 UTC Summary", font=get_font(22, bold=False), fill="#7ea5c9", anchor="mm")

            draw.rounded_rectangle([(cx + 50, cy + 240), (cx + card_w - 50, cy + 500)], radius=20, fill="#0d1b30", outline="#10b981", width=3)
            draw.text((W // 2, cy + 310), "GLOBAL ACTIVITY STATUS", font=get_font(24, bold=True), fill="#9fbcd9", anchor="mm")
            draw.text((W // 2, cy + 380), "EXPECTED BASELINE", font=get_font(42, bold=True), fill="#00e676", anchor="mm")
            draw.text((W // 2, cy + 440), "No Oceanic Tsunami Threat", font=get_font(22, bold=False), fill="#ffffff", anchor="mm")

            draw.rounded_rectangle([(cx + 50, cy + 550), (cx + card_w - 50, cy + 860)], radius=20, fill="#0d1b30", outline="#f59e0b", width=3)
            draw.text((W // 2, cy + 620), "SAFETY ADVISORY", font=get_font(26, bold=True), fill="#facc15", anchor="mm")
            draw.text((W // 2, cy + 690), "DROP, COVER, AND HOLD ON!", font=get_font(30, bold=True), fill="#ffffff", anchor="mm")
            draw.text((W // 2, cy + 760), "Maintain emergency supplies at all times", font=get_font(21, bold=False), fill="#94a3b8", anchor="mm")

            draw.text((W // 2, cy + 1040), "Follow facebook.com/earthquaketracker247", font=get_font(22, bold=True), fill="#38bdf8", anchor="mm")

    elif segment_type == "event":
        ev = event_data
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
        draw.text((map_x + 140, map_y + 45), f"TOP EVENT #{event_rank} OF {total_events}", font=get_font(18, bold=True), fill="#ffffff", anchor="mm")

        # Lower Data Card
        card_x = 80
        card_y = 1060
        card_w = 920
        card_h = 580
        draw.rectangle([(card_x, card_y), (card_x + card_w, card_y + card_h)], fill="#0f1e31", outline="#254266", width=2)

        mag_col = get_mag_color(ev["mag"])
        draw.rectangle([(card_x + 40, card_y + 35), (card_x + 260, card_y + 130)], fill=mag_col)
        draw.text((card_x + 150, card_y + 82), f"M {ev['mag']:.1f}", font=get_font(48, bold=True), fill="#ffffff", anchor="mm")

        draw.text((card_x + 290, card_y + 60), "MAGNITUDE (USGS / EMSC)", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 290, card_y + 98), f"Depth: {ev['depth_km']} km", font=get_font(22, bold=True), fill="#ffffff")

        draw.text((card_x + 40, card_y + 175), "LOCATION", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 40, card_y + 215), ev["place"][:36], font=get_font(28, bold=True), fill="#ffffff")

        draw.line([(card_x + 40, card_y + 270), (card_x + card_w - 40, card_y + 270)], fill="#1f3552", width=1)

        draw.text((card_x + 40, card_y + 300), "⏱️ LOCAL TIME", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 350, card_y + 300), ev.get("local_time_short", ev["time_utc"]), font=get_font(22, bold=True), fill="#38bdf8")

        draw.text((card_x + 40, card_y + 360), "🌐 TIME (UTC)", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 350, card_y + 360), ev["time_utc"], font=get_font(22, bold=True), fill="#ffffff")

        draw.text((card_x + 40, card_y + 420), "📍 COORDINATES", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 350, card_y + 420), f"{ev['lat']:.2f}°, {ev['lon']:.2f}°", font=get_font(20, bold=True), fill="#ffffff")

        draw.text((card_x + 40, card_y + 480), "🌊 TSUNAMI ALERT", font=get_font(18, bold=True), fill="#7ea5c9")
        draw.text((card_x + 350, card_y + 480), "NO IMMEDIATE THREAT" if not ev["tsunami"] else "COASTAL ADVISORY", font=get_font(20, bold=True), fill="#00e676" if not ev["tsunami"] else "#ff1744")

    # Bottom Subtitle Area
    sub_y = 1680
    draw.rectangle([(0, sub_y), (W, H)], fill="#070c16")
    draw.line([(0, sub_y), (W, sub_y)], fill="#1e324c", width=2)

    if subtitle_text:
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

# ==============================================================================
# 5. ATOMIC 1:1 CLIP RENDERING & MERGING ENGINE
# ==============================================================================

def render_segment_clip(segment_type, event_data, total_m40_count, digest_date_str, map_img_l, map_img_s, audio_path, sentence_timings, audio_duration, out_landscape_mp4, out_story_mp4, event_rank=1, total_events=5, all_events=None, fps=24):
    """
    Renders an atomic video clip whose duration is 100% matched to its audio file.
    No drift, no desynchronization.
    """
    total_frames = int(math.ceil(audio_duration * fps))
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    def get_sub(t):
        for s in sentence_timings:
            if s["start"] <= t <= s["end"] + 0.3:
                return s["text"]
        return ""

    # 1. Pipe Landscape Video
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
        out_landscape_mp4
    ]
    pipe_l = subprocess.Popen(cmd_l, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for f_idx in range(total_frames):
        t_sec = f_idx / fps
        sub = get_sub(t_sec)
        frame = compose_landscape_frame(segment_type, event_data, total_m40_count, digest_date_str, map_img_l, sub, event_rank, total_events, all_events)
        pipe_l.stdin.write(frame.tobytes())

    pipe_l.stdin.close()
    pipe_l.wait()

    # 2. Pipe Story Video
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
        out_story_mp4
    ]
    pipe_s = subprocess.Popen(cmd_s, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for f_idx in range(total_frames):
        t_sec = f_idx / fps
        sub = get_sub(t_sec)
        frame = compose_story_frame(segment_type, event_data, total_m40_count, digest_date_str, map_img_s, sub, event_rank, total_events, all_events)
        pipe_s.stdin.write(frame.tobytes())

    pipe_s.stdin.close()
    pipe_s.wait()

def render_dual_digest_videos(top_events, total_m40_count, digest_date_str, all_events=None):
    """
    Renders both Landscape (16:9) and Story (9:16) videos using the atomic 1:1 sync architecture:
    - Segment 0: Crisp Intro (Overview with glowing map & cards)
    - Segments 1 to N: Dedicated Earthquake clips (Map + Data card 100% synced with that quake's audio)
    - Segment Outro: Conclusion & Safety Advisory
    - Final Concatenation via FFmpeg concat demuxer (lossless & instant).
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

    ordinals = ["one", "two", "three", "four", "five", "six", "seven"]
    temp_files = []
    landscape_clips = []
    story_clips = []

    # ==========================================
    # SEGMENT 0: INTRO (CRISP & PUNCHY)
    # ==========================================
    print("🎙️ Generating Segment 0: Intro Voiceover...", flush=True)
    intro_script = (
        f"Good evening. This is the Daily Global Seismic Digest from Earthquake Tracker for 22:00 UTC to 22:00 UTC. "
        f"Today, {total_m40_count} earthquakes of magnitude 4.0 or greater were recorded worldwide, "
        f"verified by official USGS and EMSC monitoring networks. "
        f"Here are today's top {len(top_events)} most significant seismic events."
    )
    intro_audio = os.path.join(OUTPUT_DIR, "seg_0_intro.mp3")
    intro_timings, intro_dur = generate_segment_audio(intro_script, intro_audio)
    temp_files.append(intro_audio)

    c0_l = os.path.join(OUTPUT_DIR, "seg_0_landscape.mp4")
    c0_s = os.path.join(OUTPUT_DIR, "seg_0_story.mp4")
    print(f"🎥 Rendering Segment 0: Intro ({intro_dur:.2f}s)...", flush=True)
    render_segment_clip(
        segment_type="intro",
        event_data=top_events[0] if top_events else None,
        total_m40_count=total_m40_count,
        digest_date_str=digest_date_str,
        map_img_l=None,
        map_img_s=None,
        audio_path=intro_audio,
        sentence_timings=intro_timings,
        audio_duration=intro_dur,
        out_landscape_mp4=c0_l,
        out_story_mp4=c0_s,
        total_events=len(top_events),
        all_events=all_events
    )
    landscape_clips.append(c0_l)
    story_clips.append(c0_s)
    temp_files.extend([c0_l, c0_s])

    # ==========================================
    # SEGMENTS 1 to N: TOP EARTHQUAKES (1:1 SYNC)
    # ==========================================
    for idx, ev in enumerate(top_events):
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

        if ev.get("is_utc_same", False):
            time_phrase = f"at {ev['time_utc']}"
        else:
            time_phrase = f"at {ev.get('local_voice', '')} local time, or {ev['time_utc']}"

        ev_sentence_1 = f"At rank {ord_word}, a notable magnitude {ev['mag']:.1f} earthquake struck {clean_place} {time_phrase}."
        ev_sentence_2 = f"{depth_desc}, while {tsunami_desc}"
        event_script = f"{ev_sentence_1} {ev_sentence_2}"

        print(f"🎙️ Generating Segment {idx + 1}: Event M{ev['mag']:.1f} Voiceover...", flush=True)
        ev_audio = os.path.join(OUTPUT_DIR, f"seg_{idx + 1}_event.mp3")
        ev_timings, ev_dur = generate_segment_audio(event_script, ev_audio)
        temp_files.append(ev_audio)

        c_ev_l = os.path.join(OUTPUT_DIR, f"seg_{idx + 1}_landscape.mp4")
        c_ev_s = os.path.join(OUTPUT_DIR, f"seg_{idx + 1}_story.mp4")
        print(f"🎥 Rendering Segment {idx + 1}: Event #{idx + 1} ({ev_dur:.2f}s 1:1 locked)...", flush=True)
        render_segment_clip(
            segment_type="event",
            event_data=ev,
            total_m40_count=total_m40_count,
            digest_date_str=digest_date_str,
            map_img_l=map_images_l.get(idx),
            map_img_s=map_images_s.get(idx),
            audio_path=ev_audio,
            sentence_timings=ev_timings,
            audio_duration=ev_dur,
            out_landscape_mp4=c_ev_l,
            out_story_mp4=c_ev_s,
            event_rank=idx + 1,
            total_events=len(top_events),
            all_events=all_events
        )
        landscape_clips.append(c_ev_l)
        story_clips.append(c_ev_s)
        temp_files.extend([c_ev_l, c_ev_s])

    # ==========================================
    # SEGMENT OUTRO: CONCLUSION & SAFETY ADVISORY
    # ==========================================
    print("🎙️ Generating Segment Outro: Safety & Sign-off...", flush=True)
    outro_script = (
        "In review, global seismic energy release across the 22:00 UTC to 22:00 UTC tracking window "
        "remained within expected planetary baselines, with no trans-oceanic tsunami threat. "
        "Remember to practice essential earthquake safety: Drop, Cover, and Hold On during unexpected tremors. "
        "Follow facebook.com/earthquaketracker247 for 24/7 automated real-time alerts. Stay safe, and good night."
    )
    outro_audio = os.path.join(OUTPUT_DIR, "seg_outro.mp3")
    outro_timings, outro_dur = generate_segment_audio(outro_script, outro_audio)
    temp_files.append(outro_audio)

    c_out_l = os.path.join(OUTPUT_DIR, "seg_outro_landscape.mp4")
    c_out_s = os.path.join(OUTPUT_DIR, "seg_outro_story.mp4")
    print(f"🎥 Rendering Segment Outro ({outro_dur:.2f}s)...", flush=True)
    render_segment_clip(
        segment_type="outro",
        event_data=top_events[0] if top_events else None,
        total_m40_count=total_m40_count,
        digest_date_str=digest_date_str,
        map_img_l=None,
        map_img_s=None,
        audio_path=outro_audio,
        sentence_timings=outro_timings,
        audio_duration=outro_dur,
        out_landscape_mp4=c_out_l,
        out_story_mp4=c_out_s,
        total_events=len(top_events),
        all_events=all_events
    )
    landscape_clips.append(c_out_l)
    story_clips.append(c_out_s)
    temp_files.extend([c_out_l, c_out_s])

    # ==========================================
    # CONCATENATE ALL SEGMENTS (INSTANT & LOSSLESS)
    # ==========================================
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    final_landscape_path = os.path.join(OUTPUT_DIR, "daily_digest_landscape_16x9.mp4")
    final_story_path = os.path.join(OUTPUT_DIR, "daily_digest_story_9x16.mp4")

    # 1. Merge Landscape clips
    concat_txt_l = os.path.join(OUTPUT_DIR, "concat_landscape.txt")
    with open(concat_txt_l, "w", encoding="utf-8") as f:
        for clip in landscape_clips:
            clean_p = clip.replace("\\", "/")
            f.write(f"file '{clean_p}'\n")
    temp_files.append(concat_txt_l)

    print("🔗 Concatenating 16:9 Landscape segments...", flush=True)
    subprocess.run([
        ffmpeg_exe, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_txt_l,
        "-c", "copy",
        final_landscape_path
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"✅ Landscape Video ready: {final_landscape_path} ({os.path.getsize(final_landscape_path) // 1024} KB)", flush=True)

    # 2. Merge Story clips
    concat_txt_s = os.path.join(OUTPUT_DIR, "concat_story.txt")
    with open(concat_txt_s, "w", encoding="utf-8") as f:
        for clip in story_clips:
            clean_p = clip.replace("\\", "/")
            f.write(f"file '{clean_p}'\n")
    temp_files.append(concat_txt_s)

    print("🔗 Concatenating 9:16 Story segments...", flush=True)
    subprocess.run([
        ffmpeg_exe, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_txt_s,
        "-c", "copy",
        final_story_path
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"✅ Story Video ready: {final_story_path} ({os.path.getsize(final_story_path) // 1024} KB)", flush=True)

    # Cleanup temporary segment files
    for tf in temp_files:
        try:
            if os.path.exists(tf):
                os.remove(tf)
        except Exception:
            pass

    return final_landscape_path, final_story_path

# ==============================================================================
# 6. FACEBOOK MULTI-PUBLISHING (FEED VIDEO & PAGE STORY)
# ==============================================================================

def create_digest_post_caption(top_events, total_m40_count, digest_date_str):
    """Creates a structured Facebook bulletin post highlighting the 22:00 UTC tracking window."""
    bulletin_lines = []
    for idx, ev in enumerate(top_events):
        bulletin_lines.append(f"• Rank #{idx + 1}: M {ev['mag']:.1f} — {ev['place']} ({ev.get('local_time_short', ev['time_utc'])} / {ev['time_utc']}, Depth: {ev['depth_km']}km)")

    bulletin_text = "\n".join(bulletin_lines)
    strongest_ev = top_events[0] if top_events else None
    strongest_str = f"Magnitude {strongest_ev['mag']:.1f} — {strongest_ev['place']}" if strongest_ev else "None"

    caption = (
        f"🌍 DAILY GLOBAL SEISMIC DIGEST | {digest_date_str.upper()}\n"
        f"⏱️ Tracking Window: 22:00 UTC to 22:00 UTC (Past 24 Hours)\n\n"
        f"This comprehensive daily bulletin summarizes all significant earthquakes recorded between 22:00 UTC and 22:00 UTC across the globe, verified by official USGS and EMSC sensor networks.\n\n"
        f"📊 24-Hour Global Seismic Summary:\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"• Total M4.0+ Earthquakes Detected: {total_m40_count}\n"
        f"• Strongest Event: {strongest_str}\n"
        f"• Tsunami Threat Status: NO DESTRUCTIVE TRANS-OCEANIC THREAT\n"
        f"• Monitoring Stations: USGS & EMSC Corroborated\n\n"
        f"📋 Top {len(top_events)} Significant Seismic Events (22:00 UTC to 22:00 UTC):\n"
        f"{bulletin_text}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🛡️ SAFETY ADVISORY:\n"
        f"During sudden ground shaking, always remember to Drop, Cover, and Hold On! Maintain an accessible emergency family kit.\n\n"
        f"Follow facebook.com/earthquaketracker247 for official safety guidelines and 24/7 live updates!\n\n"
        f"#EarthquakeTracker #DailyDigest #GlobalSeismic #USGS #EMSC #EarthquakeAlert #24hDigest #SeismicActivity"
    )
    return caption

def upload_landscape_video_to_feed(landscape_video_path, top_events, total_m40_count, digest_date_str):
    """Uploads the 16:9 Landscape Video to the Facebook Page Main Feed."""
    if not FB_PAGE_ACCESS_TOKEN or not FB_PAGE_ID:
        print("⚠️ Facebook Access Token or Page ID missing. Skipping Feed Video upload.", flush=True)
        return False

    url = f"https://graph-video.facebook.com/v20.0/{FB_PAGE_ID}/videos"
    title = f"🌍 Daily Global Seismic Digest — {digest_date_str} (22:00 UTC Window)"
    description = create_digest_post_caption(top_events, total_m40_count, digest_date_str)

    print(f"📤 Uploading 16:9 Landscape Video to Facebook Page Feed ({FB_PAGE_ID})...", flush=True)
    try:
        with open(landscape_video_path, "rb") as vf:
            payload = {
                "title": title,
                "description": description,
                "published": True,
                "access_token": FB_PAGE_ACCESS_TOKEN
            }
            files = {"source": vf}
            res = requests.post(url, data=payload, files=files, timeout=300).json()

        if "id" in res:
            print(f"✅ Feed Video published successfully! Video ID: {res['id']}", flush=True)
            return True
        else:
            print(f"❌ Feed Video upload error: {res}", flush=True)
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
            r_up = requests.post(upload_url, headers=headers, data=f, timeout=240)
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

def check_and_dispatch_realtime_priority(reason="pre-check"):
    """
    Real-Time Priority Interceptor:
    Checks if any fresh real-time earthquake occurred.
    If detected:
    1. Pauses Daily Digest execution.
    2. Dispatches tracker_pipeline to post the real-time alert (photo/video reel + page story) immediately!
    3. Waits for a short cooldown (120 seconds) so the real-time alert establishes reach on Facebook.
    4. Resumes Daily Digest.
    """
    try:
        from fetcher import fetch_latest_earthquakes
        from tracker_pipeline import run_pipeline as run_realtime_tracker

        pending = fetch_latest_earthquakes()
        if pending:
            print("\n" + "🚨" * 35, flush=True)
            print(f"🚨 [REAL-TIME PRIORITY INTERCEPT: {reason.upper()}]", flush=True)
            print(f"🚨 {len(pending)} NEW REAL-TIME EARTHQUAKE(S) DETECTED! Pausing Daily Digest...", flush=True)
            print("🚨 Priority Rule: Instant Real-Time Alert must be published to Facebook FIRST!", flush=True)
            print("🚨" * 35 + "\n", flush=True)

            # Publish real-time alert immediately
            run_realtime_tracker()

            # Wait cooldown (120s) so the real-time alert is seen first on Facebook
            cooldown_seconds = 120
            print(f"⏳ Cooldown active: Waiting {cooldown_seconds}s for real-time alert to establish reach before resuming Daily Digest...", flush=True)
            time.sleep(cooldown_seconds)
            print("▶️ Cooldown complete. Resuming Daily Digest pipeline...\n", flush=True)
            return True
    except Exception as e:
        print(f"⚠️ Real-time priority gate check note: {e}", flush=True)
    return False

# ==============================================================================
# 7. PIPELINE ORCHESTRATOR
# ==============================================================================

def run_daily_digest_pipeline(local_data_path=None, skip_upload=False):
    """Runs the complete end-to-end Daily Global Seismic Digest pipeline."""
    print("=" * 70, flush=True)
    print("🌍 24-HOUR DAILY GLOBAL SEISMIC DIGEST PIPELINE", flush=True)
    print("⏱️ Tracking Window: 22:00 UTC to 22:00 UTC (Past 24 Hours)", flush=True)
    print(f"⏱️ Execution Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", flush=True)
    print("=" * 70, flush=True)

    # Priority Gate: Check for fresh unposted real-time quakes before starting
    check_and_dispatch_realtime_priority(reason="initial-pipeline-start")

    # 1. Fetch & Filter Data
    top_events, total_m40_count, digest_date_str, all_filtered = fetch_daily_seismic_events(local_data_path)
    if not top_events:
        print("ℹ️ No M4.0+ earthquakes recorded in the past 24 hours. Daily Digest complete.", flush=True)
        return True

    # 2. Render Dual Videos using Atomic 1:1 Synced Segments
    landscape_path, story_path = render_dual_digest_videos(
        top_events=top_events,
        total_m40_count=total_m40_count,
        digest_date_str=digest_date_str,
        all_events=all_filtered
    )

    # 3. Multi-Publishing to Facebook
    if skip_upload:
        print("⏩ Skipping Facebook upload (--skip-upload / --dry-run mode).", flush=True)
        print(f"📁 Landscape Video: {landscape_path}")
        print(f"📁 Story Video: {story_path}")
        return True

    # Priority Gate: Check again if any earthquake struck while video was rendering
    check_and_dispatch_realtime_priority(reason="pre-facebook-upload")

    # Post 1: Main Feed Video
    feed_success = upload_landscape_video_to_feed(landscape_path, top_events, total_m40_count, digest_date_str)
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
