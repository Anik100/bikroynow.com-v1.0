import os
import sys
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config import OUTPUT_DIR
from map_engine import generate_reference_satellite_map

def get_font(size, bold=True):
    try:
        font_name = "arialbd.ttf" if bold else "arial.ttf"
        return ImageFont.truetype(font_name, size)
    except Exception:
        try:
            return ImageFont.truetype("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf", size)
        except Exception:
            return ImageFont.load_default()

def parse_country_name(place_str):
    parts = [p.strip() for p in place_str.split(",")]
    if len(parts) >= 2:
        return parts[-1].upper()
    return place_str.upper()

def create_earthquake_infographic_photo(event, output_image_path):
    """
    Creates a 1080x1350 High-Resolution Facebook Infographic Photo Card:
    - High-contrast natural satellite epicenter map
    - Red hazard zone & 3D country badge
    - News bulletin statistics cards (Magnitude, Local Time, Universal Time, Depth, Tsunami Status, Coordinates)
    - Full branding
    """
    width, height = 1080, 1350
    canvas = Image.new("RGB", (width, height), "#080c16")
    draw = ImageDraw.Draw(canvas)

    # 1. Generate Epicenter Satellite Map
    map_temp_path = os.path.join(OUTPUT_DIR, f"infographic_map_{event['id']}.png")
    generate_reference_satellite_map(
        event["latitude"],
        event["longitude"],
        event["place"],
        map_temp_path,
        zoom=6,
        target_w=1080,
        target_h=830
    )
    sat_map = Image.open(map_temp_path)
    canvas.paste(sat_map, (0, 0))

    # Center of map
    cx = width // 2
    cy = 415

    # 2. Draw Epicenter Pin & Hazard Circle
    hazard_r = int(140 + (event["mag"] - 4.0) * 50)
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    ol_draw = ImageDraw.Draw(overlay)

    # Red danger circle
    ol_draw.ellipse(
        [(cx - hazard_r, cy - hazard_r), (cx + hazard_r, cy + hazard_r)],
        fill=(220, 38, 38, 85),
        outline=(239, 68, 68, 240),
        width=5
    )
    # Inner danger core
    core_r = int(hazard_r * 0.45)
    ol_draw.ellipse(
        [(cx - core_r, cy - core_r), (cx + core_r, cy + core_r)],
        fill=(255, 0, 0, 140),
        outline=(255, 255, 255, 220),
        width=3
    )
    canvas.paste(overlay, (0, 0), overlay)
    draw = ImageDraw.Draw(canvas)

    # Pin
    pin_size = 36
    draw.ellipse([(cx - pin_size, cy - pin_size * 2), (cx + pin_size, cy)], fill="#e11d48", outline="#ffffff", width=2)
    draw.polygon([(cx - pin_size * 0.75, cy - pin_size), (cx + pin_size * 0.75, cy - pin_size), (cx, cy + 8)], fill="#e11d48")
    in_r = int(pin_size * 0.72)
    center_y = cy - pin_size
    draw.ellipse([(cx - in_r, center_y - in_r), (cx + in_r, center_y + in_r)], fill="#ffffff")
    draw.line([(cx - in_r + 4, center_y), (cx - 4, center_y - 10), (cx + 4, center_y + 10), (cx + in_r - 4, center_y)], fill="#e11d48", width=3)

    # 3D Elevated Country Badge
    country_name = parse_country_name(event["place"])
    f_country = get_font(34, bold=True)
    draw.rounded_rectangle([(cx - 150, cy - 120), (cx + 150, cy - 60)], radius=18, fill="#090d16fa", outline="#facc15", width=4)
    draw.polygon([(cx - 12, cy - 60), (cx + 12, cy - 60), (cx, cy - 48)], fill="#facc15")
    draw.text((cx, cy - 90), country_name, fill="#facc15", font=f_country, stroke_width=4, stroke_fill="#000000", anchor="mm")

    # 3. Top Header Bar
    draw.rounded_rectangle([(30, 25), (width - 30, 95)], radius=16, fill="#090d16f5", outline="#ef4444", width=3)
    draw.ellipse([(55, 45), (75, 65)], fill="#ef4444")
    f_top_head = get_font(28, bold=True)
    draw.text((width // 2, 60), "EARTHQUAKE TRACKER • OFFICIAL REPORT", fill="#ffffff", font=f_top_head, anchor="mm")

    # 4. Bottom Information Dashboard (830px to 1350px)
    dash_y = 830
    draw.rectangle([(0, dash_y), (width, height)], fill="#070a12")
    draw.line([(0, dash_y), (width, dash_y)], fill="#facc15", width=4)

    # Left Box: Magnitude Card
    mag = event["mag"]
    draw.rounded_rectangle([(40, dash_y + 20), (370, dash_y + 245)], radius=20, fill="#0f172a", outline="#ef4444", width=3)
    f_mag_title = get_font(22, bold=True)
    f_mag_big = get_font(72, bold=True)
    f_mag_sub = get_font(20, bold=False)
    draw.text((205, dash_y + 55), "MAGNITUDE", fill="#94a3b8", font=f_mag_title, anchor="mm")
    draw.text((205, dash_y + 125), f"M {mag:.1f}", fill="#ef4444", font=f_mag_big, anchor="mm")
    draw.text((205, dash_y + 195), "SEISMIC ACTIVITY", fill="#38bdf8", font=f_mag_sub, anchor="mm")

    # Right Box: Depth, Coordinates, and Local/UTC Time Card
    draw.rounded_rectangle([(390, dash_y + 20), (width - 40, dash_y + 245)], radius=20, fill="#0f172a", outline="#334155", width=2)
    f_stat_h = get_font(19, bold=True)
    f_stat_v = get_font(23, bold=True)

    draw.text((415, dash_y + 40), "LOCATION & REGION:", fill="#94a3b8", font=f_stat_h)
    draw.text((415, dash_y + 68), event["place"][:36], fill="#ffffff", font=f_stat_v)

    local_t = event.get("local_time_short", "Local Time")
    utc_t = event.get("utc_short", event.get("time_utc", "UTC"))
    is_utc_same = event.get("is_utc_same", False)
    if is_utc_same or "UTC" in str(local_t) or "GMT" in str(local_t):
        draw.text((415, dash_y + 105), "RECORDED TIME (UTC):", fill="#94a3b8", font=f_stat_h)
        draw.text((415, dash_y + 133), f"RECORDED: {utc_t.upper()}", fill="#facc15", font=f_stat_v)
    else:
        draw.text((415, dash_y + 105), "RECORDED TIME (LOCAL & UTC):", fill="#94a3b8", font=f_stat_h)
        draw.text((415, dash_y + 133), f"LOCAL: {local_t.upper()}  •  UTC: {utc_t.upper()}", fill="#facc15", font=f_stat_v)

    draw.text((415, dash_y + 170), "DEPTH & COORDINATES:", fill="#94a3b8", font=f_stat_h)
    draw.text((415, dash_y + 198), f"{event['depth_km']} km depth  •  {event['latitude']:.2f}°, {event['longitude']:.2f}°", fill="#38bdf8", font=f_stat_v)

    # Full Width Bottom Row: Tsunami & Source
    tsunami_box_y = dash_y + 265
    tsunami_text = "TSUNAMI WARNING: UNDER EVALUATION" if event["tsunami_alert"] else "TSUNAMI STATUS: NO IMMEDIATE THREAT"
    tsunami_bg = "#7f1d1d" if event["tsunami_alert"] else "#064e3b"
    tsunami_border = "#ef4444" if event["tsunami_alert"] else "#10b981"
    draw.rounded_rectangle([(40, tsunami_box_y), (width - 40, tsunami_box_y + 85)], radius=16, fill=tsunami_bg, outline=tsunami_border, width=3)
    f_tsunami = get_font(26, bold=True)
    draw.text((width // 2, tsunami_box_y + 42), tsunami_text, fill="#ffffff", font=f_tsunami, anchor="mm")

    # Footer
    f_foot = get_font(22, bold=True)
    draw.text((width // 2, height - 30), "AUTOMATED REAL-TIME SEISMIC MONITORING • USGS NETWORK", fill="#64748b", font=f_foot, anchor="mm")

    canvas.save(output_image_path, quality=95)
    
    # Cleanup temp
    try:
        if os.path.exists(map_temp_path):
            os.remove(map_temp_path)
    except Exception:
        pass

    return output_image_path
