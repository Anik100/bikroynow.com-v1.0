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

    is_utc_same = event.get("is_utc_same", False)
    if is_utc_same or "UTC" in str(local_time) or "GMT" in str(local_time) or str(event.get("tz_name", "")).upper() in ["UTC", "GMT"]:
        time_section = f"⏱️ Recorded Time (UTC): {utc_time}\n"
    else:
        time_section = (
            f"⏱️ Local Time: {local_time}\n"
            f"🌍 Universal Time: {utc_time}\n"
        )

    caption = (
        f"{headline}\n\n"
        f"📢 DID YOU FEEL THIS EARTHQUAKE? 📢\n"
        f"👉 Drop a comment with your CITY and describe the shaking! Every ground report helps our real-time community track safety.\n\n"
        f"A seismic event of magnitude {mag} has been recorded by official global seismic monitoring networks.\n\n"
        f"📊 Official Seismic Report:\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"📍 Region / Epicenter: {place}\n"
        f"⚡ Magnitude: M {mag:.1f}\n"
        f"📏 Depth: {depth} km below surface\n"
        f"🌐 Coordinates: {event['latitude']}°, {event['longitude']}°\n"
        f"{time_section}"
        f"🌊 Tsunami Status: {tsunami}\n"
        f"🏛️ Source: USGS Official Monitoring Network\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"🔔 Follow @earthquaketracker247 for 24/7 automated real-time worldwide seismic alerts.\n"
        f"Stay informed, stay alert, and stay safe!\n\n"
        f"#Earthquake #Quake #EarthquakeAlert #SeismicActivity #BreakingNews "
        f"#DisasterAlert #USGS #EarthquakeTracker #LiveAlert #EmergencyUpdate "
        f"#DidYouFeelIt #NaturalDisaster {country_tags}"
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


def upload_photo_story_to_page(image_path):
    """
    Publishes an image directly to Facebook Page Stories via Meta Graph API:
    Step 1: Upload photo as unpublished (published=false) to /{PAGE_ID}/photos
    Step 2: Publish photo to page stories via /{PAGE_ID}/photo_stories
    """
    if not FB_PAGE_ACCESS_TOKEN or not FB_PAGE_ID:
        print("⚠️ Facebook Page Access Token or Page ID missing. Skipping Photo Story.", flush=True)
        return False

    print(f"📲 Publishing Photo to Facebook Page Story ({FB_PAGE_ID})...", flush=True)
    try:
        # Step 1: Upload photo as unpublished asset
        upload_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/photos"
        with open(image_path, "rb") as img_file:
            payload = {
                "published": False,
                "access_token": FB_PAGE_ACCESS_TOKEN
            }
            files = {
                "source": img_file
            }
            res_upload = requests.post(upload_url, data=payload, files=files, timeout=60).json()

        if "id" not in res_upload:
            print(f"❌ Photo Story Step 1 failed (upload asset): {res_upload}", flush=True)
            return False

        photo_id = res_upload["id"]
        print(f"  ↳ Photo asset uploaded! Photo ID: {photo_id}", flush=True)

        # Step 2: Publish to photo_stories
        story_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/photo_stories"
        story_payload = {
            "photo_id": photo_id,
            "access_token": FB_PAGE_ACCESS_TOKEN
        }
        res_story = requests.post(story_url, data=story_payload, timeout=30).json()

        if res_story.get("success") or "post_id" in res_story or "id" in res_story:
            print(f"✅ Photo Story published successfully! Response: {res_story}", flush=True)
            return True
        else:
            print(f"❌ Photo Story Step 2 failed: {res_story}", flush=True)
            return False
    except Exception as e:
        print(f"❌ Photo Story exception: {e}", flush=True)
        return False

def upload_story_video_to_page(video_path):
    """
    Uploads a vertical 9:16 video directly to Facebook Page Stories
    using Meta's 3-step Page Video Stories API.
    """
    if not FB_PAGE_ACCESS_TOKEN or not FB_PAGE_ID:
        print("⚠️ Facebook Access Token or Page ID not configured. Skipping Story Video.", flush=True)
        return False

    print(f"📲 Publishing 9:16 Video to Facebook Page Stories ({FB_PAGE_ID})...", flush=True)
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
            print(f"❌ Video Story start session failed: {init_res}", flush=True)
            return False

        upload_url = init_res["upload_url"]
        video_id = init_res["video_id"]
        print(f"  ↳ Video Story session created! Video ID: {video_id}", flush=True)

        # Step 2: Upload video binary to upload_url
        file_size = os.path.getsize(video_path)
        headers = {
            "Authorization": f"OAuth {FB_PAGE_ACCESS_TOKEN}",
            "offset": "0",
            "file_size": str(file_size)
        }
        with open(video_path, "rb") as f:
            r_up = requests.post(upload_url, headers=headers, data=f, timeout=180)
            if r_up.status_code != 200:
                print(f"❌ Video Story binary upload failed: {r_up.status_code} {r_up.text}", flush=True)
                return False

        print("  ↳ Video Story binary uploaded successfully.", flush=True)

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
            print(f"✅ Facebook Page Video Story published successfully! Response: {fin_res}", flush=True)
            return True
        else:
            print(f"⚠️ Story finish response: {fin_res}", flush=True)
            return True
    except Exception as e:
        print(f"❌ Story Video upload exception: {e}", flush=True)
        return False
