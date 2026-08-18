import os
import sys
import math
import subprocess

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg
from config import VIDEO_WIDTH, VIDEO_HEIGHT, FPS, OUTPUT_DIR
from map_engine import generate_fullscreen_satellite_map

def get_font(size, bold=False):
    try:
        font_name = "arialbd.ttf" if bold else "arial.ttf"
        return ImageFont.truetype(font_name, size)
    except Exception:
        try:
            return ImageFont.truetype("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf", size)
        except Exception:
            return ImageFont.load_default()

def get_severity_colors(mag):
    if mag >= 7.0:
        return "#dc2626", "#7f1d1d" # Crimson Red
    elif mag >= 6.0:
        return "#ea580c", "#7c2d12" # Vivid Orange
    elif mag >= 5.0:
        return "#d97706", "#78350f" # Amber
    else:
        return "#0284c7", "#0c4a6e"

def get_current_subtitle(sentences, frame_num, total_frames):
    if not sentences:
        return ""
    num_sentences = len(sentences)
    frames_per_sentence = total_frames / num_sentences
    curr_idx = min(num_sentences - 1, int(frame_num / frames_per_sentence))
    return sentences[curr_idx]

def parse_location_details(place_str):
    parts = [p.strip() for p in place_str.split(",")]
    if len(parts) >= 2:
        country = parts[-1].upper()
        city_district = ", ".join(parts[:-1])
    else:
        country = place_str.upper()
        city_district = place_str
    return country, city_district

def render_frame(event, base_map_img, epicenter_coords, sentences, frame_num, total_frames):
    """
    Renders an advance-level colorful video frame with progressive cinematic zoom.
    """
    # 1. DYNAMIC CINEMATIC ZOOM (Progressive zoom from 1.0x to 1.32x into epicenter)
    progress = frame_num / max(1, total_frames)
    # Smooth easing curve for zoom
    ease_zoom = 0.5 * (1 - math.cos(progress * math.pi))
    zoom_scale = 1.0 + (ease_zoom * 0.32)

    orig_w, orig_h = base_map_img.size
    new_w = int(orig_w / zoom_scale)
    new_h = int(orig_h / zoom_scale)

    ep_x, ep_y = epicenter_coords

    crop_left = max(0, min(orig_w - new_w, int(ep_x - (new_w / 2))))
    crop_top = max(0, min(orig_h - new_h, int(ep_y - (new_h / 2))))

    cropped_frame = base_map_img.crop((crop_left, crop_top, crop_left + new_w, crop_top + new_h))
    frame_bg = cropped_frame.resize((VIDEO_WIDTH, VIDEO_HEIGHT), Image.Resampling.BILINEAR)

    # Recalculate epicenter position on current zoomed canvas
    curr_ep_x = (ep_x - crop_left) * (VIDEO_WIDTH / new_w)
    curr_ep_y = (ep_y - crop_top) * (VIDEO_HEIGHT / new_h)

    mag = event["mag"]
    accent_color, bg_dark = get_severity_colors(mag)
    country_name, city_name = parse_location_details(event["place"])

    # 2. MARK THE AFFECTED EARTHQUAKE IMPACT ZONE
    overlay = Image.new("RGBA", (VIDEO_WIDTH, VIDEO_HEIGHT), (0, 0, 0, 0))
    ol_draw = ImageDraw.Draw(overlay)

    zone_radius = int((160 + (mag - 4.0) * 65) * zoom_scale * 0.85)

    # Translucent Red Seismic Danger Perimeter
    ol_draw.ellipse(
        [(curr_ep_x - zone_radius, curr_ep_y - zone_radius),
         (curr_ep_x + zone_radius, curr_ep_y + zone_radius)],
        fill=(220, 38, 38, 85),
        outline=(220, 38, 38, 240),
        width=5
    )

    core_radius = int(zone_radius * 0.45)
    ol_draw.ellipse(
        [(curr_ep_x - core_radius, curr_ep_y - core_radius),
         (curr_ep_x + core_radius, curr_ep_y + core_radius)],
        fill=(239, 68, 68, 130),
        outline=(255, 255, 255, 240),
        width=3
    )

    frame_bg.paste(overlay, (0, 0), overlay)
    draw = ImageDraw.Draw(frame_bg)

    # Animated Shockwaves Radiating from Epicenter
    t = (frame_num % FPS) / FPS
    for ring_i in range(3):
        phase = (t + (ring_i * 0.33)) % 1.0
        radius = int(zone_radius + phase * 240)
        draw.ellipse(
            [(curr_ep_x - radius, curr_ep_y - radius), (curr_ep_x + radius, curr_ep_y + radius)],
            outline="#ef4444",
            width=4
        )

    # Epicenter Bullseye
    draw.ellipse([(curr_ep_x - 22, curr_ep_y - 22), (curr_ep_x + 22, curr_ep_y + 22)], fill="#dc2626", outline="#ffffff", width=4)
    draw.ellipse([(curr_ep_x - 8, curr_ep_y - 8), (curr_ep_x + 8, curr_ep_y + 8)], fill="#ffffff")

    # Impact Zone Top Banner
    f_zone_tag = get_font(24, bold=True)
    draw.rounded_rectangle([(curr_ep_x - 210, curr_ep_y - zone_radius - 52), (curr_ep_x + 210, curr_ep_y - zone_radius - 2)], radius=12, fill="#090d16fa", outline="#dc2626", width=3)
    draw.text((curr_ep_x, curr_ep_y - zone_radius - 27), "SEISMIC IMPACT ZONE", fill="#f87171", font=f_zone_tag, anchor="mm")

    # 3. 3D ELEVATED HERO EPICENTER BADGE (THE BIGGEST & RAISED ABOVE MAP)
    f_country_hero = get_font(44, bold=True)
    f_city_hero = get_font(26, bold=True)
    
    badge_w = 520
    badge_h = 112
    badge_x1 = curr_ep_x - (badge_w // 2)
    badge_y1 = curr_ep_y + 35
    badge_x2 = badge_x1 + badge_w
    badge_y2 = badge_y1 + badge_h

    # 3D Drop Shadows
    draw.rounded_rectangle([(badge_x1 + 6, badge_y1 + 8), (badge_x2 + 6, badge_y2 + 8)], radius=20, fill="#000000aa")
    draw.rounded_rectangle([(badge_x1 + 3, badge_y1 + 4), (badge_x2 + 3, badge_y2 + 4)], radius=20, fill="#000000cc")
    
    # Main 3D Card
    draw.rounded_rectangle([(badge_x1, badge_y1), (badge_x2, badge_y2)], radius=20, fill="#090d16f8", outline="#facc15", width=4)
    draw.rounded_rectangle([(badge_x1 + 10, badge_y1 + 6), (badge_x2 - 10, badge_y1 + 12)], radius=4, fill="#ffffff55")

    # Country & City
    draw.text((curr_ep_x, badge_y1 + 42), country_name, fill="#facc15", font=f_country_hero, anchor="mm")
    draw.text((curr_ep_x, badge_y1 + 84), city_name[:38], fill="#ffffff", font=f_city_hero, anchor="mm")

    # 4. TOP HEADER BAR
    draw.rounded_rectangle([(50, 35), (VIDEO_WIDTH - 50, 115)], radius=18, fill="#090d16fa", outline="#ef4444", width=3)
    
    blink = (frame_num // 12) % 2 == 0
    dot_color = "#ef4444" if blink else "#7f1d1d"
    draw.ellipse([(80, 58), (110, 88)], fill=dot_color)

    f_top = get_font(32, bold=True)
    draw.text((VIDEO_WIDTH // 2 + 15, 75), "LIVE EARTHQUAKE ALERT", fill="#ffffff", font=f_top, anchor="mm")

    # 5. FLOATING HERO MAGNITUDE CARD (Top-Left)
    mag_card_y = 130
    draw.rounded_rectangle([(50, mag_card_y), (480, mag_card_y + 115)], radius=18, fill="#090d16fa", outline=accent_color, width=3)
    
    f_mag_label = get_font(22, bold=True)
    draw.text((75, mag_card_y + 35), "MAGNITUDE", fill="#94a3b8", font=f_mag_label)
    
    f_mag_num = get_font(58, bold=True)
    draw.text((75, mag_card_y + 82), f"M {mag:.1f}", fill=accent_color, font=f_mag_num)

    # Upper Right: Depth & Coordinates
    draw.rounded_rectangle([(510, mag_card_y), (VIDEO_WIDTH - 50, mag_card_y + 115)], radius=18, fill="#090d16fa", outline="#334155", width=2)
    f_stat_label = get_font(20, bold=True)
    f_stat_val = get_font(26, bold=True)
    draw.text((535, mag_card_y + 35), "DEPTH & COORDINATES", fill="#38bdf8", font=f_stat_label)
    draw.text((535, mag_card_y + 80), f"{event['depth_km']} km  •  {event['latitude']:.1f}°, {event['longitude']:.1f}°", fill="#ffffff", font=f_stat_val)

    # 6. DYNAMIC EYE-LEVEL SUBTITLES (Auto-sized, Zero Overflow)
    current_sub = get_current_subtitle(sentences, frame_num, total_frames)
    if current_sub:
        f_sub = get_font(34, bold=True)
        words = current_sub.split()
        lines = []
        curr_l = ""
        for w in words:
            t_l = curr_l + (" " if curr_l else "") + w
            if len(t_l) > 32:
                lines.append(curr_l)
                curr_l = w
            else:
                curr_l = t_l
        if curr_l:
            lines.append(curr_l)

        line_height = 48
        box_h = 75 + (len(lines) * line_height) + 20
        sub_box_y = 1200

        draw.rounded_rectangle([(50, sub_box_y), (VIDEO_WIDTH - 50, sub_box_y + box_h)], radius=22, fill="#000000fa", outline="#fbbf24", width=3)

        draw.rounded_rectangle([(80, sub_box_y + 16), (280, sub_box_y + 54)], radius=8, fill="#fbbf24")
        f_tag = get_font(20, bold=True)
        draw.text((180, sub_box_y + 35), "NEWS UPDATE", fill="#000000", font=f_tag, anchor="mm")

        text_start_y = sub_box_y + 70
        for l_i, line_text in enumerate(lines):
            draw.text((80, text_start_y + (l_i * line_height)), line_text, fill="#ffffff", font=f_sub)

    # 7. BIG BOLD BOTTOM LOCATION & TSUNAMI CARD
    bottom_y = 1610
    draw.rounded_rectangle([(50, bottom_y), (VIDEO_WIDTH - 50, bottom_y + 190)], radius=20, fill="#000000fa", outline="#38bdf8", width=3)

    f_b_title = get_font(22, bold=True)
    f_b_loc = get_font(30, bold=True)
    f_b_sub = get_font(24, bold=True)

    draw.text((80, bottom_y + 20), "LOCATION & REGION", fill="#94a3b8", font=f_b_title)
    draw.text((80, bottom_y + 50), f"{country_name} — {city_name[:36]}", fill="#ffffff", font=f_b_loc)

    tsunami_text = "TSUNAMI RISK UNDER EVALUATION" if event["tsunami_alert"] else "NO IMMEDIATE TSUNAMI RISK"
    tsunami_col = "#ef4444" if event["tsunami_alert"] else "#22c55e"
    draw.text((80, bottom_y + 95), f"Time: {event['time_utc']}", fill="#94a3b8", font=f_b_sub)
    draw.text((80, bottom_y + 135), f"Status: {tsunami_text}", fill=tsunami_col, font=f_b_sub)

    # 8. FOOTER BRANDING
    f_brand = get_font(26, bold=True)
    draw.text((VIDEO_WIDTH // 2, VIDEO_HEIGHT - 50), "EARTHQUAKE TRACKER • 24/7 GLOBAL MONITORING", fill="#94a3b8", font=f_brand, anchor="mm")

    return frame_bg

def create_earthquake_video(event, audio_path, sentences, output_video_path):
    """
    Renders immersive 1080x1920 Reel with progressive zoom and 3D hero badge.
    """
    print(f"🎬 Rendering Progressive Zoom Reel for: M{event['mag']} - {event['place']}")
    
    map_temp_path = os.path.join(OUTPUT_DIR, f"cinematic_map_{event['id']}.png")
    _, epicenter_coords = generate_fullscreen_satellite_map(
        event["latitude"],
        event["longitude"],
        event["place"],
        map_temp_path,
        zoom=7
    )
    base_map_img = Image.open(map_temp_path)

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd_probe = [ffmpeg_exe, "-i", audio_path]
    res = subprocess.run(cmd_probe, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    
    duration_secs = 12.0
    for line in res.stderr.splitlines():
        if "Duration:" in line:
            try:
                time_str = line.split("Duration:")[1].split(",")[0].strip()
                h, m, s = time_str.split(":")
                duration_secs = float(h) * 3600 + float(m) * 60 + float(s) + 0.8
                break
            except Exception:
                pass

    total_frames = int(duration_secs * FPS)
    print(f"⏱️ Video duration: {duration_secs:.1f}s ({total_frames} frames)")

    temp_raw_video = os.path.join(OUTPUT_DIR, f"raw_cinema_{event['id']}.mp4")

    writer_cmd = [
        ffmpeg_exe,
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{VIDEO_WIDTH}x{VIDEO_HEIGHT}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "-",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "ultrafast",
        temp_raw_video
    ]

    proc = subprocess.Popen(writer_cmd, stdin=subprocess.PIPE)

    for f_idx in range(total_frames):
        frame = render_frame(event, base_map_img, epicenter_coords, sentences, f_idx, total_frames)
        proc.stdin.write(frame.tobytes())

    proc.stdin.close()
    proc.wait()

    # Ensure target output path is writable
    if os.path.exists(output_video_path):
        try:
            os.remove(output_video_path)
        except Exception:
            # If file is open in media player, use alternative filename
            name, ext = os.path.splitext(output_video_path)
            output_video_path = f"{name}_new{ext}"

    merge_cmd = [
        ffmpeg_exe,
        "-y",
        "-i", temp_raw_video,
        "-i", audio_path,
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        output_video_path
    ]
    subprocess.run(merge_cmd, check=True)

    for p in [temp_raw_video, map_temp_path]:
        try:
            if os.path.exists(p):
                os.remove(p)
        except Exception:
            pass

    print(f"🎉 Final Progressive Zoom Reel successfully generated: {output_video_path}")
    return output_video_path
