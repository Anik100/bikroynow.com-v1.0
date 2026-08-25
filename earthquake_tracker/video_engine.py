import os
import sys
import math
import re
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg
import subprocess

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config import VIDEO_WIDTH, VIDEO_HEIGHT, FPS, OUTPUT_DIR
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

def get_current_subtitle(sentences, frame_num, audio_frames):
    if not sentences:
        return ""
    if frame_num >= audio_frames:
        return "🔔 Follow Earthquake Tracker for 24/7 Live Updates"
    num_sentences = len(sentences)
    frames_per_sentence = max(1, audio_frames / num_sentences)
    curr_idx = min(num_sentences - 1, int(frame_num / frames_per_sentence))
    return sentences[curr_idx]

def draw_seismograph_pin(draw, x, y, size=38):
    """
    Draws the iconic red teardrop map pin with white circular seismograph wave badge.
    """
    draw.ellipse([(x - size, y - size * 2), (x + size, y)], fill="#e11d48", outline="#ffffff", width=2)
    draw.polygon([(x - size * 0.75, y - size), (x + size * 0.75, y - size), (x, y + 8)], fill="#e11d48")
    
    in_r = int(size * 0.72)
    center_y = y - size
    draw.ellipse([(x - in_r, center_y - in_r), (x + in_r, center_y + in_r)], fill="#ffffff")

    wave_pts = [
        (x - in_r + 4, center_y),
        (x - in_r + 10, center_y - 2),
        (x - 8, center_y + 8),
        (x - 4, center_y - 12),
        (x, center_y + 12),
        (x + 4, center_y - 10),
        (x + 8, center_y + 6),
        (x + in_r - 10, center_y - 2),
        (x + in_r - 4, center_y)
    ]
    draw.line(wave_pts, fill="#e11d48", width=3)

def draw_prominent_country_badge(draw, cx, cy, country_name):
    """
    Draws an elevated 3D floating badge above the red epicenter mark showing the Country name.
    """
    f_country = get_font(36, bold=True)
    bbox = draw.textbbox((0, 0), country_name, font=f_country)
    text_w = bbox[2] - bbox[0]
    box_w = max(260, text_w + 70)
    box_h = 60
    
    box_x1 = cx - (box_w // 2)
    box_y1 = cy - 120
    box_x2 = box_x1 + box_w
    box_y2 = box_y1 + box_h

    # 3D Drop Shadows
    draw.rounded_rectangle([(box_x1 + 6, box_y1 + 8), (box_x2 + 6, box_y2 + 8)], radius=18, fill="#000000bb")
    
    # 3D Main Pill (Bright Gold border, dark background)
    draw.rounded_rectangle([(box_x1, box_y1), (box_x2, box_y2)], radius=18, fill="#090d16fa", outline="#facc15", width=4)
    draw.rounded_rectangle([(box_x1 + 10, box_y1 + 4), (box_x2 - 10, box_y1 + 8)], radius=3, fill="#ffffff77")

    # Connector pointer triangle
    draw.polygon([(cx - 12, box_y2), (cx + 12, box_y2), (cx, box_y2 + 14)], fill="#facc15")

    # Country Name Text
    draw.text((cx, box_y1 + 30), country_name, fill="#facc15", font=f_country, stroke_width=4, stroke_fill="#000000", anchor="mm")

def estimate_impact_radius_km(mag):
    """
    Estimates realistic seismic shaking impact radius in km based on earthquake magnitude.
    """
    # M4.0 -> ~60km, M5.0 -> ~130km, M6.0 -> ~320km, M7.0 -> ~650km
    raw_r = math.pow(10, 0.42 * mag - 0.55)
    return int(max(50, min(750, round(raw_r / 10.0) * 10)))

def render_reference_style_frame(event, base_map_img, epicenter_coords, sentences, frame_num, total_frames, audio_frames):
    progress = frame_num / max(1, total_frames)
    mag = event["mag"]
    country_name = parse_country_name(event["place"])
    ep_x, ep_y = epicenter_coords
    impact_km = estimate_impact_radius_km(mag)

    # 🚀 ENHANCED SMOOTH & FASTER CINEMATIC GLIDE-ZOOM (1.00x up to 2.25x)
    # Starts with a swift cinematic glide and glides smoothly into the epicenter
    ease_progress = math.pow(progress, 0.82)
    zoom_scale = 1.0 + (ease_progress * 1.25)

    orig_w, orig_h = base_map_img.size
    new_w = int(orig_w / zoom_scale)
    new_h = int(orig_h / zoom_scale)

    crop_left = max(0, min(orig_w - new_w, int(ep_x - (new_w / 2))))
    crop_top = max(0, min(orig_h - new_h, int(ep_y - (new_h / 2))))

    cropped_map = base_map_img.crop((crop_left, crop_top, crop_left + new_w, crop_top + new_h))
    frame = cropped_map.resize((VIDEO_WIDTH, VIDEO_HEIGHT), Image.Resampling.BILINEAR)

    curr_ep_x = (ep_x - crop_left) * (VIDEO_WIDTH / new_w)
    curr_ep_y = (ep_y - crop_top) * (VIDEO_HEIGHT / new_h)

    # Overlays: Red Impact Area Perimeter + Hazard Line + Shockwaves
    overlay = Image.new("RGBA", (VIDEO_WIDTH, VIDEO_HEIGHT), (0, 0, 0, 0))
    ol_draw = ImageDraw.Draw(overlay)

    # 🔴 1. HIGH-PRECISION GLOWING RED EARTHQUAKE IMPACT ZONE & PERIMETER
    # Scaled proportionally to estimated km impact radius and map zoom
    hazard_base_r = int((140 + (mag - 4.0) * 65) * zoom_scale * 0.70)
    
    # Outer Danger Aura Glow
    for glow_i in range(3):
        g_r = hazard_base_r + (glow_i * 12)
        ol_draw.ellipse(
            [(curr_ep_x - g_r, curr_ep_y - g_r - 20),
             (curr_ep_x + g_r, curr_ep_y + g_r - 20)],
            outline=(239, 68, 68, max(25, 90 - glow_i * 25)),
            width=2
        )

    # Primary Semi-Transparent Red Hazard Field Fill
    ol_draw.ellipse(
        [(curr_ep_x - hazard_base_r, curr_ep_y - hazard_base_r - 20),
         (curr_ep_x + hazard_base_r, curr_ep_y + hazard_base_r - 20)],
        fill=(220, 38, 38, 75),
        outline=(239, 68, 68, 255),
        width=5
    )

    # Inner Intense Danger Core
    core_r = int(hazard_base_r * 0.38)
    ol_draw.ellipse(
        [(curr_ep_x - core_r, curr_ep_y - core_r - 20),
         (curr_ep_x + core_r, curr_ep_y + core_r - 20)],
        fill=(255, 0, 0, 140),
        outline=(255, 255, 255, 220),
        width=3
    )

    # 2. Concentric White Seismograph Acoustic Rings
    t = (frame_num % FPS) / FPS
    for ring_i in range(8):
        r_dist = int(25 + (ring_i * 18))
        alpha = max(20, int(220 - (ring_i * 22)))
        ol_draw.ellipse(
            [(curr_ep_x - r_dist, curr_ep_y - r_dist - 20),
             (curr_ep_x + r_dist, curr_ep_y + r_dist - 20)],
            outline=(255, 255, 255, alpha),
            width=1
        )

    # 3. Expanding Red Seismic Shockwave Ripple
    for wave_i in range(2):
        w_phase = (t + (wave_i * 0.5)) % 1.0
        w_radius = int(hazard_base_r + (w_phase * 260))
        w_alpha = int((1.0 - w_phase) * 170)
        ol_draw.ellipse(
            [(curr_ep_x - w_radius, curr_ep_y - w_radius - 20),
             (curr_ep_x + w_radius, curr_ep_y + w_radius - 20)],
            fill=(225, 29, 72, int(w_alpha * 0.22)),
            outline=(225, 29, 72, w_alpha),
            width=4
        )

    frame.paste(overlay, (0, 0), overlay)
    draw = ImageDraw.Draw(frame)

    # 📍 4. PROFESSIONAL IMPACT RADIUS BADGE (attached to the red hazard border)
    f_km = get_font(26, bold=True)
    km_text = f"🔴 IMPACT ZONE: ~{impact_km} KM"
    bbox_km = draw.textbbox((0, 0), km_text, font=f_km)
    km_w = bbox_km[2] - bbox_km[0] + 30
    km_h = 42
    badge_x = int(curr_ep_x)
    badge_y = int(curr_ep_y + hazard_base_r + 5)
    
    # Keep badge inside frame bounds
    if 50 <= badge_y <= VIDEO_HEIGHT - 350:
        draw.rounded_rectangle(
            [(badge_x - (km_w // 2) + 3, badge_y - (km_h // 2) + 3),
             (badge_x + (km_w // 2) + 3, badge_y + (km_h // 2) + 3)],
            radius=12,
            fill="#000000bb"
        )
        draw.rounded_rectangle(
            [(badge_x - (km_w // 2), badge_y - (km_h // 2)),
             (badge_x + (km_w // 2), badge_y + (km_h // 2))],
            radius=12,
            fill="#991b1bfa",
            outline="#fca5a5",
            width=2
        )
        draw.text((badge_x, badge_y), km_text, fill="#ffffff", font=f_km, stroke_width=2, stroke_fill="#000000", anchor="mm")

    # 5. Epicenter Seismograph Pin
    draw_seismograph_pin(draw, curr_ep_x, curr_ep_y)

    # 🌟 6. 3D ELEVATED COUNTRY BADGE RIGHT ABOVE THE RED EPICENTER MARK
    draw_prominent_country_badge(draw, curr_ep_x, curr_ep_y, country_name)

    # 6. TOP HEADER
    f_mag = get_font(88, bold=True)
    draw.text((VIDEO_WIDTH // 2, 140), f"M{mag:.1f}", fill="#eab308", font=f_mag, stroke_width=6, stroke_fill="#000000", anchor="mm")

    f_eq = get_font(46, bold=True)
    draw.text((VIDEO_WIDTH // 2, 215), "EARTHQUAKE", fill="#ffffff", font=f_eq, stroke_width=4, stroke_fill="#000000", anchor="mm")

    place_str = event["place"]
    if " of " in place_str:
        dist_part, region_part = place_str.split(" of ", 1)
        line3 = f"{dist_part} of"
        line4 = region_part
    else:
        line3 = place_str
        line4 = ""

    f_loc = get_font(36, bold=True)
    draw.text((VIDEO_WIDTH // 2, 275), line3, fill="#ffffff", font=f_loc, stroke_width=4, stroke_fill="#000000", anchor="mm")
    if line4:
        draw.text((VIDEO_WIDTH // 2, 325), line4, fill="#ffffff", font=f_loc, stroke_width=4, stroke_fill="#000000", anchor="mm")

    # 7. BOTTOM SUBTITLES
    current_sub = get_current_subtitle(sentences, frame_num, audio_frames)
    if current_sub:
        f_sub = get_font(38, bold=True)
        # Subtitle background bar for ultra readability
        bbox = draw.textbbox((0, 0), current_sub, font=f_sub)
        sub_w = bbox[2] - bbox[0]
        if sub_w > VIDEO_WIDTH - 80:
            f_sub = get_font(30, bold=True)
        draw.text((VIDEO_WIDTH // 2, 1680), current_sub, fill="#ffffff", font=f_sub, stroke_width=4, stroke_fill="#000000", anchor="mm")

    return frame

def create_earthquake_video(event, audio_path, sentences, output_video_path):
    print(f"🎬 Rendering Elevated Country Badge + Red Mark Reel for: M{event['mag']} - {event['place']}")
    
    map_temp_path = os.path.join(OUTPUT_DIR, f"ref_style_map_{event['id']}.png")
    _, epicenter_coords = generate_reference_satellite_map(
        event["latitude"],
        event["longitude"],
        event["place"],
        map_temp_path,
        zoom=8
    )
    base_map_img = Image.open(map_temp_path)

    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    # Accurately extract audio duration in seconds using FFmpeg stderr
    try:
        res = subprocess.run([ffmpeg_exe, "-i", audio_path], capture_output=True, text=True)
        match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", res.stderr)
        if match:
            hours, mins, secs = match.groups()
            audio_duration = int(hours) * 3600 + int(mins) * 60 + float(secs)
        else:
            audio_duration = 28.0
    except Exception as e:
        print(f"⚠️ Error probing audio duration: {e}")
        audio_duration = 28.0

    outro_seconds = 1.5
    total_duration = audio_duration + outro_seconds
    audio_frames = int(audio_duration * FPS)
    total_frames = int(total_duration * FPS)
    print(f"⏱️ Audio duration: {audio_duration:.2f}s | Total video duration: {total_duration:.2f}s ({total_frames} frames)")

    raw_video_path = os.path.join(OUTPUT_DIR, f"raw_country_badge_{event['id']}.mp4")

    render_cmd = [
        ffmpeg_exe, "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{VIDEO_WIDTH}x{VIDEO_HEIGHT}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "-",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-profile:v", "baseline",
        "-level", "4.0",
        "-crf", "23",
        "-b:v", "8000k",
        raw_video_path
    ]

    pipe = subprocess.Popen(render_cmd, stdin=subprocess.PIPE)

    for f in range(total_frames):
        frame = render_reference_style_frame(event, base_map_img, epicenter_coords, sentences, f, total_frames, audio_frames)
        raw_bytes = frame.tobytes()
        pipe.stdin.write(raw_bytes)

    pipe.stdin.close()
    pipe.wait()

    # Merge audio + video and pad audio with apad filter so audio and video match 100% in length
    final_cmd = [
        ffmpeg_exe, "-y",
        "-i", raw_video_path,
        "-i", audio_path,
        "-filter_complex", f"[1:a]apad=whole_dur={total_duration:.2f}[a]",
        "-map", "0:v",
        "-map", "[a]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        output_video_path
    ]
    subprocess.run(final_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    # Cleanup temp files
    try:
        if os.path.exists(map_temp_path):
            os.remove(map_temp_path)
        if os.path.exists(raw_video_path):
            os.remove(raw_video_path)
    except Exception:
        pass

    print(f"🎉 Final Elevated Country Badge Reel successfully generated: {output_video_path}")
    return output_video_path
