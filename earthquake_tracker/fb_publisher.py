import os
import sys
import requests
import re

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config import FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN

LOCAL_EARTHQUAKE_TAGS = {
    "indonesia": "#Gempa #GempaBumi #InfoGempa #BMKG",
    "turkey": "#Deprem #SonDepremler #DepremOldu #Kandilli",
    "türkiye": "#Deprem #SonDepremler #DepremOldu #Kandilli",
    "japan": "#Jishin #地震 #緊急地震速報",
    "philippines": "#Lindol #LindolPH #EarthquakePH #PHIVOLCS",
    "chile": "#Terremoto #Temblor #Sismo #SismoChile",
    "peru": "#Terremoto #Temblor #Sismo #SismoPeru",
    "mexico": "#Terremoto #Temblor #Sismo #SismoCDMX",
    "colombia": "#Terremoto #Temblor #Sismo",
    "ecuador": "#Terremoto #Temblor #Sismo",
    "argentina": "#Terremoto #Temblor #Sismo",
    "guatemala": "#Terremoto #Temblor #Sismo",
    "spain": "#Terremoto #Sismo",
    "italy": "#Terremoto #Sisma #INGV",
    "greece": "#Seismos #Σεισμός",
    "iran": "#Zelzeleh #زلزله",
    "afghanistan": "#Zelzeleh #زلزله",
    "pakistan": "#Zalzala #زلزلہ",
    "india": "#EarthquakeIndia #Bhookamp #भूकंप",
    "bangladesh": "#ভূমিকম্প #EarthquakeBangladesh",
    "taiwan": "#地震 #EarthquakeTaiwan",
    "iceland": "#Jardskjalfti #Skjálfti",
    "new zealand": "#Geonet #NZQuake"
}

def extract_country_and_tags(place_str):
    """Generates country and city specific hashtags along with native viral keywords."""
    parts = [p.strip() for p in place_str.split(",")]
    country = parts[-1] if len(parts) >= 1 else "World"
    
    country_clean = re.sub(r'[^a-zA-Z0-9]', '', country)
    city_clean = re.sub(r'[^a-zA-Z0-9]', '', parts[0].split()[-1]) if len(parts) >= 2 else ""

    country_tags = f"#{country_clean} #{country_clean}Earthquake #{country_clean}News"
    if city_clean and len(city_clean) > 2:
        country_tags += f" #{city_clean}"

    # Append localized native language earthquake hashtags for viral search reach
    place_lower = place_str.lower()
    for k, native_tags in LOCAL_EARTHQUAKE_TAGS.items():
        if k in place_lower:
            country_tags += f" {native_tags}"
            break

    return country, country_tags

def create_post_caption(event):
    """
    Generates an engaging Facebook Post Status with Local Time and Universal Time.
    """
    mag = event["mag"]
    place = event["place"]
    depth = event["depth_km"]
    local_time = event.get("local_time_full") or event.get("local_time_short") or "Recorded locally"
    utc_time = event.get("time_utc") or "Recorded in UTC"
    country, country_tags = extract_country_and_tags(place)

    if mag >= 7.0:
        headline = f"🚨 MAJOR EARTHQUAKE REPORT: Magnitude {mag} in {country.upper()}! 🚨"
    elif mag >= 6.0:
        headline = f"🔴 STRONG SEISMIC REPORT: Magnitude {mag} Strikes {country.upper()}!"
    else:
        headline = f"⚡ BREAKING: Magnitude {mag} Earthquake Strikes {country.upper()}!"

    tsunami = "⚠️ UNDER ASSESSMENT - COASTAL ADVISORY" if event["tsunami_alert"] else "✅ NO IMMEDIATE TSUNAMI THREAT"

    caption = (
        f"{headline}\n\n"
        f"A seismic event of magnitude {mag} has been recorded by official global seismic monitoring networks.\n\n"
        f"📊 Official Seismic Report:\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"📍 Region / Epicenter: {place}\n"
        f"⚡ Magnitude: M {mag:.1f}\n"
        f"📏 Depth: {depth} km below surface\n"
        f"🌐 Coordinates: {event['latitude']}°, {event['longitude']}°\n"
        f"⏱️ Local Time: {local_time}\n"
        f"🌍 Universal Time: {utc_time}\n"
        f"🌊 Tsunami Status: {tsunami}\n"
        f"🏛️ Source: USGS Official Monitoring Network\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"🔔 Follow Earthquake Tracker for 24/7 automated real-time worldwide seismic alerts.\n"
        f"Stay informed and stay safe!\n\n"
        f"#Earthquake #Quake #EarthquakeAlert #SeismicActivity #BreakingNews "
        f"#DisasterAlert #USGS #EarthquakeTracker #LiveAlert #EmergencyUpdate "
        f"#NaturalDisaster {country_tags}"
    )
    return caption

def upload_photo_to_facebook(image_path, event):
    """
    Uploads an Infographic Photo directly to the Facebook Page using Graph API.
    """
    if not FB_PAGE_ACCESS_TOKEN:
        print("⚠️ Facebook Page Access Token is not set. Skipping photo upload.")
        return False

    url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/photos"
    caption = create_post_caption(event)

    print(f"📸 Uploading Infographic Photo to Facebook Page ({FB_PAGE_ID})...")

    with open(image_path, "rb") as img_file:
        payload = {
            "caption": caption,
            "access_token": FB_PAGE_ACCESS_TOKEN
        }
        files = {
            "source": img_file
        }

        try:
            response = requests.post(url, data=payload, files=files, timeout=120)
            res_data = response.json()
            if "id" in res_data:
                photo_id = res_data["id"]
                print(f"✅ Photo successfully published to Facebook! Photo ID: {photo_id}")
                return True
            else:
                print(f"❌ Facebook Photo API Error: {res_data}")
                return False
        except Exception as e:
            print(f"❌ Photo Upload Failed: {e}")
            return False

def upload_video_to_facebook(video_path, event):
    """
    Uploads the generated earthquake video directly to the Facebook Page
    using Meta Graph Video API.
    """
    if not FB_PAGE_ACCESS_TOKEN:
        print("⚠️ Facebook Page Access Token is not set. Skipping Facebook upload.")
        print(f"📁 Video saved locally at: {video_path}")
        return False

    url = f"https://graph-video.facebook.com/v20.0/{FB_PAGE_ID}/videos"
    country, _ = extract_country_and_tags(event["place"])
    title = f"🔴 Magnitude {event['mag']} Earthquake Alert - {country}"
    description = create_post_caption(event)

    print(f"📤 Uploading video to Facebook Page ({FB_PAGE_ID})...")

    with open(video_path, "rb") as video_file:
        payload = {
            "title": title,
            "description": description,
            "published": True,
            "access_token": FB_PAGE_ACCESS_TOKEN
        }
        files = {
            "source": video_file
        }

        try:
            response = requests.post(url, data=payload, files=files, timeout=180)
            res_data = response.json()
            if "id" in res_data:
                video_id = res_data["id"]
                print(f"✅ Video successfully published to Facebook! Video ID: {video_id}")
                return True
            else:
                print(f"❌ Facebook API Error: {res_data}")
                return False
        except Exception as e:
            print(f"❌ Upload Failed: {e}")
            return False
