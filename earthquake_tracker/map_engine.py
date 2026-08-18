import math
import io
import os
import requests
from PIL import Image, ImageDraw, ImageFont

def deg2num(lat_deg, lon_deg, zoom):
    """Convert lat/lon to tile coordinates."""
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)

def fetch_tile(x, y, z):
    """
    Fetch vibrant, colorful geographic map tiles (CartoDB Voyager).
    """
    headers = {"User-Agent": "EarthquakeTrackerBot/9.0 (UltraVibrant)"}
    url_carto = f"https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
    try:
        r = requests.get(url_carto, headers=headers, timeout=8)
        if r.status_code == 200:
            return Image.open(io.BytesIO(r.content)).convert("RGB")
    except Exception:
        pass

    try:
        url_osm = f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        r = requests.get(url_osm, headers=headers, timeout=8)
        if r.status_code == 200:
            return Image.open(io.BytesIO(r.content)).convert("RGB")
    except Exception:
        pass

    return Image.new("RGB", (256, 256), "#dbeafe")

def get_font(size, bold=True):
    try:
        font_name = "arialbd.ttf" if bold else "arial.ttf"
        return ImageFont.truetype(font_name, size)
    except Exception:
        try:
            return ImageFont.truetype("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf", size)
        except Exception:
            return ImageFont.load_default()

def draw_text_with_shadow(draw, xy, text, font, fill="#0f172a", halo="#ffffff", shadow_color="#00000044", anchor="mm"):
    x, y = xy
    draw.text((x + 2, y + 2), text, fill=shadow_color, font=font, anchor=anchor)
    for dx in [-2, -1, 0, 1, 2]:
        for dy in [-2, -1, 0, 1, 2]:
            if dx != 0 or dy != 0:
                draw.text((x + dx, y + dy), text, fill=halo, font=font, anchor=anchor)
    draw.text((x, y), text, fill=fill, font=font, anchor=anchor)

def get_surrounding_landmarks(lat, lon):
    """Returns surrounding regional geography and countries."""
    if 30 <= lat <= 45 and -15 <= lon <= 10:
        return [
            (40.4, -3.7, "SPAIN", "country"),
            (39.5, -8.0, "PORTUGAL", "country"),
            (44.5, 2.0, "FRANCE", "country"),
            (33.5, -5.5, "MOROCCO", "country"),
            (35.5, 3.0, "ALGERIA", "country"),
            (38.0, 1.5, "BALEARIC SEA", "water"),
            (36.0, -3.0, "ALBORAN SEA", "water"),
            (41.4, 2.1, "BARCELONA", "city"),
            (40.4, -3.7, "MADRID", "city"),
            (37.4, -6.0, "SEVILLE", "city"),
            (36.7, -4.4, "MALAGA", "city")
        ]
    elif -12 <= lat <= 10 and 95 <= lon <= 145:
        return [
            (-6.2, 106.8, "INDONESIA", "country"),
            (14.6, 121.0, "PHILIPPINES", "country"),
            (4.2, 101.9, "MALAYSIA", "country"),
            (-8.5, 125.5, "TIMOR-LESTE", "country"),
            (-9.5, 120.0, "SAVU SEA", "water"),
            (-8.0, 115.0, "BALI SEA", "water"),
            (-8.6, 120.5, "FLORES", "region"),
            (-8.5, 116.0, "LOMBOK", "region")
        ]
    elif -30 <= lat <= -10 and (170 <= lon or lon <= -170):
        return [
            (-17.7, 178.0, "FIJI ISLANDS", "country"),
            (-21.2, -175.2, "TONGA", "country"),
            (-15.4, 166.9, "VANUATU", "country"),
            (-20.0, 175.0, "PACIFIC OCEAN", "water"),
            (-18.1, 178.4, "SUVA", "city"),
            (-17.8, 177.4, "NADI", "city")
        ]
    elif 25 <= lat <= 46 and 125 <= lon <= 150:
        return [
            (36.2, 138.2, "JAPAN", "country"),
            (35.9, 127.7, "SOUTH KOREA", "country"),
            (35.7, 139.7, "TOKYO", "city"),
            (34.7, 135.5, "OSAKA", "city"),
            (38.0, 135.0, "SEA OF JAPAN", "water")
        ]
    else:
        return [
            (lat + 2.0, lon - 2.0, "NORTH REGION", "region"),
            (lat - 2.0, lon + 2.0, "SOUTH REGION", "region"),
            (lat, lon + 2.5, "OCEAN / SEA", "water")
        ]

def generate_fullscreen_satellite_map(lat, lon, place_name, output_path, zoom=7, target_w=1080, target_h=1920):
    """
    Creates a high-res, colorful base map stitched across 8x12 tiles.
    """
    center_x, center_y = deg2num(lat, lon, zoom)

    cols = 8
    rows = 12
    stitched = Image.new("RGB", (cols * 256, rows * 256))
    
    x_start = center_x - (cols // 2)
    y_start = center_y - (rows // 2)

    for i in range(cols):
        for j in range(rows):
            tile_x = x_start + i
            tile_y = y_start + j
            tile_img = fetch_tile(tile_x, tile_y, zoom)
            stitched.paste(tile_img, (i * 256, j * 256))

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

    # Draw surrounding countries & landmarks
    draw = ImageDraw.Draw(cropped)
    landmarks = get_surrounding_landmarks(lat, lon)
    f_country = get_font(34, bold=True)
    f_city = get_font(24, bold=True)
    f_water = get_font(26, bold=True)

    for l_lat, l_lon, l_name, l_type in landmarks:
        l_lat_rad = math.radians(l_lat)
        l_exact_x = ((l_lon + 180.0) / 360.0 * n - x_start) * 256.0
        l_exact_y = ((1.0 - math.asinh(math.tan(l_lat_rad)) / math.pi) / 2.0 * n - y_start) * 256.0

        px = (l_exact_x - left) * (target_w / crop_w)
        py = (l_exact_y - top) * (target_h / crop_h)

        dist_to_center = math.hypot(px - final_x, py - final_y)
        if 40 <= px <= target_w - 40 and 140 <= py <= target_h - 180 and dist_to_center > 130:
            if l_type == "country":
                draw_text_with_shadow(draw, (px, py), l_name, f_country, fill="#0f172a", halo="#ffffff", anchor="mm")
            elif l_type == "water":
                draw_text_with_shadow(draw, (px, py), l_name, f_water, fill="#0284c7", halo="#ffffff", anchor="mm")
            elif l_type == "city":
                draw.ellipse([(px - 4, py - 4), (px + 4, py + 4)], fill="#ef4444", outline="#ffffff", width=1)
                draw_text_with_shadow(draw, (px, py - 16), l_name, f_city, fill="#1e293b", halo="#ffffff", anchor="mm")

    cropped.save(output_path, quality=95)
    return output_path, (final_x, final_y)
