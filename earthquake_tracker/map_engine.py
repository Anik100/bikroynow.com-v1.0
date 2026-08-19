import math
import io
import os
import requests
from PIL import Image, ImageDraw, ImageFont

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)

def fetch_satellite_hybrid_tile(x, y, z):
    """
    Fetches genuine ESRI Satellite Imagery with ESRI reference boundary labels.
    """
    url_sat = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    url_ref = f"https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

    sat_img = None
    ref_img = None

    try:
        r1 = requests.get(url_sat, headers=headers, timeout=8)
        if r1.status_code == 200:
            sat_img = Image.open(io.BytesIO(r1.content)).convert("RGBA")
    except Exception:
        pass

    try:
        r2 = requests.get(url_ref, headers=headers, timeout=8)
        if r2.status_code == 200:
            ref_img = Image.open(io.BytesIO(r2.content)).convert("RGBA")
    except Exception:
        pass

    if sat_img and ref_img:
        composite = Image.alpha_composite(sat_img, ref_img)
        return composite.convert("RGB")
    elif sat_img:
        return sat_img.convert("RGB")
    return Image.new("RGB", (256, 256), "#0b1528")

def get_font(size, bold=True):
    try:
        font_name = "arialbd.ttf" if bold else "arial.ttf"
        return ImageFont.truetype(font_name, size)
    except Exception:
        try:
            return ImageFont.truetype("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf", size)
        except Exception:
            return ImageFont.load_default()

def draw_text_with_heavy_stroke(draw, xy, text, font, fill="#ffffff", stroke_fill="#000000", stroke_width=3, anchor="mm"):
    x, y = xy
    draw.text((x, y), text, fill=fill, font=font, stroke_width=stroke_width, stroke_fill=stroke_fill, anchor=anchor)

def get_nearby_places(lat, lon):
    """Returns local regional town labels and sea names."""
    if -15 <= lat <= 5 and 110 <= lon <= 135: # Indonesia / Flores
        return [
            (-8.6, 120.4, "Labuanbajo", "city"),
            (-8.6, 120.5, "Ruteng", "city"),
            (-8.8, 121.6, "Ende", "city"),
            (-8.6, 122.2, "Maumere", "city"),
            (-9.6, 120.2, "Waingapu", "city"),
            (-10.1, 123.6, "Kupang", "city"),
            (-7.8, 121.0, "Flores Sea", "sea"),
            (-9.8, 121.5, "Savu Sea", "sea"),
            (-5.1, 119.4, "Makassar", "city"),
            (-4.0, 119.6, "Parepare", "city"),
            (-8.7, 121.0, "Nusa Tenggara Timur", "province")
        ]
    elif 10 <= lat <= 20 and 118 <= lon <= 126: # Philippines
        return [
            (18.2, 121.6, "Aparri", "city"),
            (18.5, 121.3, "Namuac", "city"),
            (17.6, 121.7, "Tuguegarao", "city"),
            (16.4, 120.6, "Baguio", "city"),
            (14.6, 121.0, "Manila", "city"),
            (19.0, 120.0, "Luzon Strait", "sea"),
            (16.0, 119.0, "West Philippine Sea", "sea")
        ]
    elif -25 <= lat <= -12 and (lon >= 170 or lon <= -170): # Tonga / Fiji
        return [
            (-21.2, -175.2, "Nuku'alofa", "city"),
            (-15.9, -173.8, "Hihifo", "city"),
            (-18.1, 178.4, "Suva", "city"),
            (-20.0, -175.0, "Tonga Trench", "sea"),
            (-17.5, 179.0, "Koro Sea", "sea")
        ]
    elif 30 <= lat <= 45 and -15 <= lon <= 10: # Spain / Portugal
        return [
            (40.4, -3.7, "Madrid", "city"),
            (37.4, -6.0, "Seville", "city"),
            (36.7, -4.4, "Malaga", "city"),
            (38.7, -9.1, "Lisbon", "city"),
            (36.0, -5.0, "Alboran Sea", "sea")
        ]
    else:
        return [
            (lat + 0.8, lon - 0.8, "North District", "city"),
            (lat - 0.8, lon + 0.8, "South District", "city"),
            (lat, lon + 1.2, "Coastal Waters", "sea")
        ]

def generate_reference_satellite_map(lat, lon, place_name, output_path, zoom=8, target_w=1080, target_h=1920):
    """
    Stitches clean high-resolution natural ESRI satellite tiles with crystal-clear typography.
    """
    center_x, center_y = deg2num(lat, lon, zoom)
    cols, rows = 8, 12
    stitched = Image.new("RGB", (cols * 256, rows * 256))
    x_start, y_start = center_x - (cols // 2), center_y - (rows // 2)

    for i in range(cols):
        for j in range(rows):
            tile = fetch_satellite_hybrid_tile(x_start + i, y_start + j, zoom)
            stitched.paste(tile, (i * 256, j * 256))

    n = 2.0 ** zoom
    lat_rad = math.radians(lat)
    exact_x = ((lon + 180.0) / 360.0 * n - x_start) * 256.0
    exact_y = ((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n - y_start) * 256.0

    crop_w = min(stitched.width, int(stitched.height * (1080 / 1920)))
    crop_h = stitched.height
    left = max(0, min(stitched.width - crop_w, exact_x - (crop_w / 2)))
    top = max(0, min(stitched.height - crop_h, exact_y - (crop_h / 2)))

    cropped = stitched.crop((left, top, left + crop_w, top + crop_h))
    cropped = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)

    final_x = (exact_x - left) * (target_w / crop_w)
    final_y = (exact_y - top) * (target_h / crop_h)

    # Draw local place labels with clean drop shadow
    draw = ImageDraw.Draw(cropped)
    f_city = get_font(24, bold=True)
    f_sea = get_font(22, bold=False)
    f_province = get_font(22, bold=True)

    places = get_nearby_places(lat, lon)
    for p_lat, p_lon, p_name, p_type in places:
        p_lat_rad = math.radians(p_lat)
        p_exact_x = ((p_lon + 180.0) / 360.0 * n - x_start) * 256.0
        p_exact_y = ((1.0 - math.asinh(math.tan(p_lat_rad)) / math.pi) / 2.0 * n - y_start) * 256.0

        px = (p_exact_x - left) * (target_w / crop_w)
        py = (p_exact_y - top) * (target_h / crop_h)

        dist = math.hypot(px - final_x, py - final_y)
        if 40 <= px <= target_w - 40 and 150 <= py <= target_h - 150 and dist > 90:
            if p_type == "city":
                draw.ellipse([(px - 4, py - 4), (px + 4, py + 4)], fill="#ffffff", outline="#000000", width=1)
                draw_text_with_heavy_stroke(draw, (px, py - 16), p_name, f_city, fill="#ffffff", stroke_fill="#000000", stroke_width=3, anchor="mm")
            elif p_type == "sea":
                draw_text_with_heavy_stroke(draw, (px, py), p_name, f_sea, fill="#67e8f9", stroke_fill="#082f49", stroke_width=2, anchor="mm")
            elif p_type == "province":
                draw_text_with_heavy_stroke(draw, (px, py), p_name, f_province, fill="#fef08a", stroke_fill="#000000", stroke_width=2, anchor="mm")

    cropped.save(output_path, quality=95)
    return output_path, (final_x, final_y)
