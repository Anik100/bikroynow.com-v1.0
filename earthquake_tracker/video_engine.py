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

def get_current_subtitle_data(sentences_or_timings, current_time_sec, audio_duration):
    """
    Returns (full_sentence_for_box_layout, typed_realtime_text)
    Synchronized down to the exact millisecond with Edge-TTS AI voice.
    """
    if not sentences_or_timings:
        return "", ""
        
    if current_time_sec >= audio_duration:
        cta = "🔔 Follow Earthquake Tracker for 24/7 Live Alerts"
        return cta, cta

    # If list of timing dicts from edge_tts
    if isinstance(sentences_or_timings[0], dict):
        for item in sentences_or_timings:
            st = item.get("start", 0.0)
            en = item.get("end", 0.0)
            dur = max(0.1, item.get("duration", en - st))
            
            if st <= current_time_sec <= en + 0.3:
                full_text = item.get("text", "")
                # Real-time progressive word typing based on exact speech time
                prog = min(1.0, max(0.0, (current_time_sec - st) / dur))
                words = full_text.split()
                # Advance smoothly word-by-word
                vis_count = max(1, min(len(words), int(len(words) * (prog * 1.15))))
                typed_text = " ".join(words[:vis_count])
                return full_text, typed_text

        # In between sentence gaps:
        for i in range(len(sentences_or_timings) - 1):
            if sentences_or_timings[i]["end"] < current_time_sec < sentences_or_timings[i+1]["start"]:
                next_text = sentences_or_timings[i+1]["text"]
                return next_text, next_text.split()[0]
                
        last_item = sentences_or_timings[-1]
        return last_item.get("text", ""), last_item.get("text", "")
    else:
        # Fallback for plain string list
        num_s = len(sentences_or_timings)
        dur_per = max(1.0, audio_duration / num_s)
        curr_idx = min(num_s - 1, int(current_time_sec / dur_per))
        full_text = sentences_or_timings[curr_idx]
        return full_text, full_text

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

def wrap_text_lines(text, font, max_width, draw_obj):
    """
    Wraps text into clean, balanced subtitle lines that never exceed max_width.
    """
    words = text.split()
    lines = []
    current_line = []
    for word in words:
        test_line = " ".join(current_line + [word])
        bbox = draw_obj.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current_line.append(word)
        else:
            if current_line:
                lines.append(" ".join(current_line))
                current_line = [word]
            else:
                lines.append(word)
    if current_line:
        lines.append(" ".join(current_line))
    return lines

def render_reference_style_frame(event, base_map_img, epicenter_coords, places_list, sentences, frame_num, total_frames, audio_frames):
    progress = frame_num / max(1, total_frames)
    mag = event["mag"]
    country_name = parse_country_name(event["place"])
    ep_x, ep_y = epicenter_coords
    impact_km = estimate_impact_radius_km(mag)

    # 🚀 HIGH-SPEED BROADCAST PLUNGE ZOOM (1.00x up to 4.85x)
    # Rapidly dives from continental view right to the epicenter in the first 3.5-4 seconds!
    zoom_progress = 1.0 - math.exp(-progress * 7.5) # Reaches ~85% zoom depth in the first 4 seconds!
    zoom_scale = 1.0 + (zoom_progress * 3.85)

    orig_w, orig_h = base_map_img.size
    new_w = int(orig_w / zoom_scale)
    new_h = int(orig_h / zoom_scale)

    crop_left = max(0, min(orig_w - new_w, int(ep_x - (new_w / 2))))
    crop_top = max(0, min(orig_h - new_h, int(ep_y - (new_h / 2))))

    cropped_map = base_map_img.crop((crop_left, crop_top, crop_left + new_w, crop_top + new_h))
    frame = cropped_map.resize((VIDEO_WIDTH, VIDEO_HEIGHT), Image.Resampling.BILINEAR)

    curr_ep_x = (ep_x - crop_left) * (VIDEO_WIDTH / new_w)
    curr_ep_y = (ep_y - crop_top) * (VIDEO_HEIGHT / new_h)

    # Overlays: 3D Elevated Pop-up Red Terrain + Hazard Bevel + Shockwaves
    overlay = Image.new("RGBA", (VIDEO_WIDTH, VIDEO_HEIGHT), (0, 0, 0, 0))
    ol_draw = ImageDraw.Draw(overlay)

    # 🔴 1. TRUE 3D ELEVATED RED EPICENTER PEDESTAL (ম্যাপের স্থানটি থ্রিডি আকারে নিচ থেকে উঁচু হয়ে উঠবে)
    # Smooth dynamic elevation pop-up as camera reaches epicenter
    elev_anim = math.sin(min(1.0, progress * 4.0) * (math.pi / 2))
    elev_px = int(48 * elev_anim) # 48px dramatic 3D elevation height
    disc_rx = int(115 + (mag - 4.0) * 40) # Horizontal radius of the affected zone
    disc_ry = int(disc_rx * 0.58) # Perspective 3D isometric tilt

    # A. Deep Realistic 3D Ground Shadow beneath the raised land
    ol_draw.ellipse(
        [(curr_ep_x - disc_rx - 15, curr_ep_y - disc_ry + 20),
         (curr_ep_x + disc_rx + 15, curr_ep_y + disc_ry + 45)],
        fill=(0, 0, 0, 185)
    )

    # B. 3D Extruded Cylinder Wall / Bevel (উঁচু হওয়া লাল সাইডওয়াল)
    for wall_y in range(elev_px, 0, -2):
        shade_alpha = int(160 + (wall_y / max(1, elev_px)) * 95)
        ol_draw.ellipse(
            [(curr_ep_x - disc_rx, curr_ep_y - disc_ry - wall_y),
             (curr_ep_x + disc_rx, curr_ep_y + disc_ry - wall_y)],
            fill=(136, 19, 55, shade_alpha),
            outline=(225, 29, 72, 210),
            width=2
        )

    # C. Top Elevated 3D Red Platform Surface
    top_cy = curr_ep_y - elev_px
    # Glowing Outer Rim Contour
    ol_draw.ellipse(
        [(curr_ep_x - disc_rx - 6, top_cy - disc_ry - 6),
         (curr_ep_x + disc_rx + 6, top_cy + disc_ry + 6)],
        outline=(254, 202, 202, 230),
        width=3
    )
    # Top Glowing Red Platform
    ol_draw.ellipse(
        [(curr_ep_x - disc_rx, top_cy - disc_ry),
         (curr_ep_x + disc_rx, top_cy + disc_ry)],
        fill=(225, 29, 72, 215),
        outline=(255, 255, 255, 255),
        width=4
    )
    # Inner Intense Danger Core
    core_rx = int(disc_rx * 0.45)
    core_ry = int(disc_ry * 0.45)
    ol_draw.ellipse(
        [(curr_ep_x - core_rx, top_cy - core_ry),
         (curr_ep_x + core_rx, top_cy + core_ry)],
        fill=(255, 0, 0, 240),
        outline=(255, 255, 255, 250),
        width=3
    )

    # 2. Concentric White Seismograph Acoustic Wave Rings
    t = (frame_num % FPS) / FPS
    for ring_i in range(6):
        r_dist_x = int(disc_rx + (ring_i * 24))
        r_dist_y = int(r_dist_x * 0.58)
        alpha = max(15, int(190 - (ring_i * 30)))
        ol_draw.ellipse(
            [(curr_ep_x - r_dist_x, top_cy - r_dist_y),
             (curr_ep_x + r_dist_x, top_cy + r_dist_y)],
            outline=(255, 255, 255, alpha),
            width=2
        )

    # 3. Expanding Red Seismic Shockwave Ripple
    for wave_i in range(2):
        w_phase = (t + (wave_i * 0.5)) % 1.0
        w_radius_x = int(disc_rx + (w_phase * 280))
        w_radius_y = int(w_radius_x * 0.58)
        w_alpha = int((1.0 - w_phase) * 190)
        ol_draw.ellipse(
            [(curr_ep_x - w_radius_x, top_cy - w_radius_y),
             (curr_ep_x + w_radius_x, top_cy + w_radius_y)],
            fill=(225, 29, 72, int(w_alpha * 0.22)),
            outline=(239, 68, 68, w_alpha),
            width=4
        )

    frame.paste(overlay, (0, 0), overlay)
    draw = ImageDraw.Draw(frame)

    # 🏙️ 4. DYNAMIC CRYSTAL-CLEAR VECTOR LABELS FOR SURROUNDING CITIES & PROVINCES
    # Rendered freshly on the final 1080x1920 frame at ANY zoom level so they NEVER blur!
    f_city = get_font(28, bold=True)
    f_prov = get_font(30, bold=True)
    
    drawn_label_positions = []
    if places_list:
        for orig_px, orig_py, p_name, p_type in places_list:
            curr_px = (orig_px - crop_left) * (VIDEO_WIDTH / new_w)
            curr_py = (orig_py - crop_top) * (VIDEO_HEIGHT / new_h)
            
            # Check if visible on screen within safe margins
            if 50 <= curr_px <= VIDEO_WIDTH - 50 and 260 <= curr_py <= VIDEO_HEIGHT - 320:
                # Check clearance from epicenter 3D pedestal
                dist_to_epicenter = math.hypot(curr_px - curr_ep_x, curr_py - top_cy)
                if dist_to_epicenter < (disc_rx + 65):
                    continue
                    
                # Avoid overlapping adjacent labels
                overlap = False
                for lx, ly in drawn_label_positions:
                    if math.hypot(curr_px - lx, curr_py - ly) < 70:
                        overlap = True
                        break
                if overlap:
                    continue
                    
                drawn_label_positions.append((curr_px, curr_py))
                
                # City Dot Marker
                dot_color = "#facc15" if p_type in ["city", "town", "municipality"] else "#38bdf8"
                draw.ellipse(
                    [(curr_px - 7, curr_py - 7), (curr_px + 7, curr_py + 7)],
                    fill=dot_color,
                    outline="#000000",
                    width=2
                )
                draw.ellipse(
                    [(curr_px - 3, curr_py - 3), (curr_px + 3, curr_py + 3)],
                    fill="#ffffff"
                )
                
                # Dynamic Clean Text Label with Dark Pill Outline
                label_font = f_prov if p_type in ["county", "state", "province", "region"] else f_city
                label_color = "#fef08a" if p_type in ["county", "state", "province"] else "#ffffff"
                
                bbox = draw.textbbox((0, 0), p_name, font=label_font)
                bw = bbox[2] - bbox[0] + 20
                bh = bbox[3] - bbox[1] + 12
                by = curr_py - 26
                
                draw.rounded_rectangle(
                    [(curr_px - (bw // 2), by - (bh // 2)),
                     (curr_px + (bw // 2), by + (bh // 2))],
                    radius=8,
                    fill="#000000aa",
                    outline="#ffffff44",
                    width=1
                )
                
                draw.text(
                    (curr_px, by),
                    p_name,
                    fill=label_color,
                    font=label_font,
                    stroke_width=3,
                    stroke_fill="#000000",
                    anchor="mm"
                )

    # 5. Epicenter Seismograph Pin (sitting right on top of the elevated 3D red pedestal)
    draw_seismograph_pin(draw, curr_ep_x, top_cy)

    # 🌟 6. 3D ELEVATED COUNTRY BADGE RIGHT ABOVE THE PIN
    draw_prominent_country_badge(draw, curr_ep_x, top_cy, country_name)

    # 7. TOP HEADER WITH DATE & TIME BADGE
    f_mag = get_font(90, bold=True)
    draw.text((VIDEO_WIDTH // 2, 130), f"M{mag:.1f}", fill="#facc15", font=f_mag, stroke_width=6, stroke_fill="#000000", anchor="mm")

    f_eq = get_font(42, bold=True)
    draw.text((VIDEO_WIDTH // 2, 195), "EARTHQUAKE ALERT", fill="#ffffff", font=f_eq, stroke_width=4, stroke_fill="#000000", anchor="mm")

    place_str = event["place"]
    if " of " in place_str:
        dist_part, region_part = place_str.split(" of ", 1)
        line3 = f"{dist_part} of"
        line4 = region_part
    else:
        line3 = place_str
        line4 = ""

    f_loc = get_font(34, bold=True)
    loc_y = 250
    draw.text((VIDEO_WIDTH // 2, loc_y), line3, fill="#ffffff", font=f_loc, stroke_width=4, stroke_fill="#000000", anchor="mm")
    if line4:
        loc_y += 40
        draw.text((VIDEO_WIDTH // 2, loc_y), line4, fill="#ffffff", font=f_loc, stroke_width=4, stroke_fill="#000000", anchor="mm")

    # 📅 🕒 DATE & TIME PROMINENT BROADCAST BADGE
    time_badge_y = loc_y + 44
    date_str = ""
    if event.get("time_utc") and "at" in str(event["time_utc"]):
        date_str = event["time_utc"].split("at")[0].strip()
    elif event.get("epoch_ms"):
        import datetime
        date_str = datetime.datetime.fromtimestamp(event["epoch_ms"] / 1000.0, tz=datetime.timezone.utc).strftime("%B %d, %Y")
    else:
        date_str = "Verified Report"

    is_utc_same = event.get("is_utc_same", False)
    local_t = event.get("local_time_short", "")
    utc_t = event.get("utc_short", event.get("time_utc", ""))
    
    if is_utc_same or not local_t or "UTC" in local_t:
        time_line_str = f"📅 {date_str}   •   ⏱️ {utc_t}"
    else:
        time_line_str = f"📅 {date_str}   •   ⏱️ {local_t} ({utc_t})"

    f_time_badge = get_font(25, bold=True)
    tb_box = draw.textbbox((0, 0), time_line_str, font=f_time_badge)
    tb_w = tb_box[2] - tb_box[0] + 36
    tb_h = tb_box[3] - tb_box[1] + 16

    draw.rounded_rectangle(
        [(VIDEO_WIDTH // 2 - tb_w // 2, time_badge_y - tb_h // 2),
         (VIDEO_WIDTH // 2 + tb_w // 2, time_badge_y + tb_h // 2)],
        radius=12,
        fill="#070d1cf0",
        outline="#38bdf8",
        width=2
    )
    draw.text(
        (VIDEO_WIDTH // 2, time_badge_y),
        time_line_str,
        fill="#38bdf8",
        font=f_time_badge,
        stroke_width=3,
        stroke_fill="#000000",
        anchor="mm"
    )

    # 8. BOTTOM SUBTITLES (Millisecond-Synchronized Real-Time Word Typing)
    current_time_sec = frame_num / float(FPS)
    audio_dur = audio_frames / float(FPS)
    full_sub, typed_sub = get_current_subtitle_data(sentences, current_time_sec, audio_dur)
    
    if full_sub and typed_sub:
        f_sub = get_font(44, bold=True)
        wrapped_full = wrap_text_lines(full_sub, f_sub, VIDEO_WIDTH - 140, draw)
        wrapped_typed = wrap_text_lines(typed_sub, f_sub, VIDEO_WIDTH - 140, draw)
        
        line_height = 54
        total_sub_h = len(wrapped_full) * line_height
        start_sub_y = 1680 - (total_sub_h // 2)

        max_lw = 0
        for l in wrapped_full:
            bbox = draw.textbbox((0, 0), l, font=f_sub)
            lw = bbox[2] - bbox[0]
            if lw > max_lw:
                max_lw = lw

        pad_x = 34
        pad_y = 16
        draw.rounded_rectangle(
            [(VIDEO_WIDTH // 2 - max_lw // 2 - pad_x, start_sub_y - pad_y - 20),
             (VIDEO_WIDTH // 2 + max_lw // 2 + pad_x, start_sub_y + total_sub_h + pad_y - 20)],
            radius=16,
            fill="#050811e6",
            outline="#facc15cc",
            width=2
        )

        for idx, line in enumerate(wrapped_typed):
            ly = start_sub_y + idx * line_height
            draw.text(
                (VIDEO_WIDTH // 2, ly),
                line,
                fill="#ffffff",
                font=f_sub,
                stroke_width=5,
                stroke_fill="#000000",
                anchor="mm"
            )

    return frame

def create_earthquake_video(event, audio_path, sentences, output_video_path):
    print(f"🎬 Rendering Elevated Country Badge + Red Mark Reel for: M{event['mag']} - {event['place']}")
    
    map_temp_path = os.path.join(OUTPUT_DIR, f"ref_style_map_{event['id']}.png")
    _, epicenter_coords, places_list = generate_reference_satellite_map(
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
        frame = render_reference_style_frame(event, base_map_img, epicenter_coords, places_list, sentences, f, total_frames, audio_frames)
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
