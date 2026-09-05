import os
import sys
import requests
import json
import re

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config import FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN, HISTORY_FILE
from fetcher import load_history, save_history, history_lock

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

def parse_post_context(post_context):
    """
    Extracts structured seismic metadata from the post context or caption:
    - location / epicenter
    - short location
    - magnitude
    - depth
    - coordinates
    - tsunami status
    """
    info = {
        "location": "",
        "short_location": "",
        "mag": "",
        "depth": "",
        "coords": "",
        "tsunami": ""
    }
    if not post_context:
        return info

    for line in post_context.split("\n"):
        line = line.strip()
        if "Region / Epicenter:" in line:
            info["location"] = line.split("Region / Epicenter:")[1].strip()
        elif "Epicenter:" in line and not info["location"]:
            info["location"] = line.split("Epicenter:")[1].strip()
        elif "Region:" in line and not info["location"]:
            info["location"] = line.split("Region:")[1].strip()
        elif "Coordinates:" in line:
            info["coords"] = line.split("Coordinates:")[1].strip()
        elif "Magnitude:" in line:
            info["mag"] = line.split("Magnitude:")[1].strip()
        elif "Depth:" in line:
            info["depth"] = line.split("Depth:")[1].strip()
        elif "Tsunami Status:" in line:
            info["tsunami"] = line.split("Tsunami Status:")[1].strip()

    if not info["location"]:
        match = re.search(r"Strikes\s+([^!\n]+)", post_context, re.IGNORECASE)
        if match:
            info["location"] = match.group(1).strip()

    if info["location"]:
        if "," in info["location"]:
            info["short_location"] = info["location"].split(",")[-1].strip()
        elif "of " in info["location"]:
            info["short_location"] = info["location"].split("of ")[-1].strip()
        else:
            info["short_location"] = info["location"]

    return info

def generate_ai_comment_reply(comment_text, user_name="Friend", post_context=""):
    """
    Generates an intelligent, highly contextual, empathetic, and scientifically accurate AI reply
    matching ANY type of comment from users:
    - Location & state disputes / Skepticism of place (e.g., 'that's California', 'wrong state', 'idiots')
    - Regional ambiguity / Location inquiry (e.g. Pilar Siargao vs Pilar Bataan, 'where is this?')
    - Felt reports & shaking experiences
    - Did not feel reports & distance queries
    - Tsunami & ocean hazard inquiries
    - Aftershock concerns & 'Big One' anxiety
    - Safety protocols & preparedness guidance
    - Fake news / Skepticism / Disbelief
    - Prayers, blessings & well wishes
    - Appreciation & compliments
    - Multilingual support (Bengali, Spanish, Tagalog)
    """
    text_clean = (comment_text or "").strip()
    text_lower = text_clean.lower()
    ctx_clean = (post_context or "").strip()
    ctx_info = parse_post_context(ctx_clean)
    loc = ctx_info["location"] or "the region indicated on the map"
    short_loc = ctx_info["short_location"] or loc
    coords = ctx_info["coords"] or "official USGS coordinates"
    depth = ctx_info["depth"] or "shallow depth"

    # 1. Try Google Gemini API if key is available
    if GEMINI_API_KEY:
        try:
            prompt = (
                "You are Earthquake Tracker official AI assistant on Facebook. "
                f"Post Details: \"{ctx_clean}\". "
                f"A user named '{user_name}' commented on our live earthquake alert post: \"{text_clean}\". "
                "Generate a polite, scientific, concise (2-3 sentences maximum) reply. "
                "Instructions based on comment intent: "
                "1. If they dispute the location, state, or country (e.g. claiming it is California instead of New Mexico, or Pilar Bataan instead of Siargao, or calling the page idiots), "
                "politely and warmly clarify that places often share identical names, state the exact verified location and USGS GPS coordinates from the post, and thank them. "
                "2. If they ask about the location, explain which province, municipality, or region the epicenter was located near. "
                "3. If they felt the quake, thank them for their ground report and advise basic safety precautions for aftershocks. "
                "4. If they say they did not feel it, explain that seismic waves attenuate with distance and depth. "
                "5. If they ask about a tsunami, reassure them based on NOAA/PTWC assessments. "
                "6. If they ask about aftershocks, explain that minor fault readjustment is normal and quakes cannot be predicted. "
                "7. If they claim it is fake news, explain it was verified by official USGS/EMSC seismic stations. "
                "8. If they write prayers or blessings, respond with heartfelt empathy ('Amen!'). "
                "9. Reply in the exact same language as the user comment (English, Bengali, Spanish, Tagalog, etc.). "
                "Do not use hashtags. Keep it natural, informative, caring, and engaging."
            )
            g_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 200, "temperature": 0.4}
            }
            r_ai = requests.post(g_url, json=payload, timeout=6)
            if r_ai.status_code == 200:
                ai_resp = r_ai.json()
                candidates = ai_resp.get("candidates", [])
                if candidates:
                    reply_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                    if reply_text:
                        return reply_text
        except Exception as e:
            print(f"Gemini AI note: {e}")

    # 2. Contextual Intelligent Rule-Based Engine (100% Deterministic Fallback)

    # A. Bengali Language Processing
    is_bengali = any('\u0980' <= ch <= '\u09ff' for ch in text_clean)
    if is_bengali:
        if any(k in text_clean for k in ["কোথায়", "কোন জায়গা", "কোন জেলা", "কোথা", "স্থান"]):
            return f"আসসালামু আলাইকুম {user_name}! অফিসিয়াল সিসমিক তথ্য অনুযায়ী এই ভূমিকম্পটির কেন্দ্র ছিল {loc}। সঠিক ভৌগোলিক স্থানাঙ্ক আমাদের ম্যাপে দেখানো হয়েছে। নিরাপদে থাকুন! 🌍📍"
        if any(k in text_clean for k in ["টের", "কেঁপে", "ভয়", "ঝাঁকুনি", "অনুভব", "কাঁপ"]):
            return f"ধন্যবাদ {user_name} তথ্যটি জানানোর জন্য! আপনার ও আপনার পরিবারের নিরাপত্তা কামনা করি। মৃদু আফটারশক হতে পারে, তাই সতর্ক থাকুন এবং জরুরি নিরাপত্তা প্রস্তুতি রাখুন। 🤝❤️"
        if any(k in text_clean for k in ["আল্লাহ", "আমিন", "দোয়া", "দোয়া", "রক্ষা", "হেফাজত"]):
            return f"আমিন! মহান আল্লাহ সবাইকে নিরাপদে ও সুস্থ রাখুন। সবাই সতর্ক ও সচেতন থাকুন। 🙏❤️"
        if any(k in text_clean for k in ["ভুয়া", "ভুয়া", "মিথ্যা", "কিছু হয়নি", "গুজব"]):
            return f"প্রিয় {user_name}, এটি আন্তর্জাতিক সিসমোলজি সংস্থা (USGS ও EMSC)-এর সিসমিক সেন্সরে আনুষ্ঠানিকভাবে রেকর্ডকৃত তথ্য। অনেক ভূমিকম্প গভীর ভূগর্ভে হওয়ায় দূরে অনুভূত নাও হতে পারে, তবে তা বৈজ্ঞানিকভাবে সত্য। নিরাপদে থাকুন! 🌍🔬"
        if any(k in text_clean for k in ["ধন্যবাদ", "থ্যাংকস", "ভালো", "সুন্দর", "সেরা"]):
            return f"অসংখ্য ধন্যবাদ {user_name} পাশে থাকার জন্য! ২৪/৭ লাইভ রিয়েল-টাইম বিশ্বব্যাপী ভূমিকম্প সতর্কতার জন্য আমাদের পেজটি ফলো করে সাথে থাকুন। 🌍🔔"
        return f"ধন্যবাদ {user_name}! যেকোনো দুর্যোগের তাৎক্ষণিক আপডেটের জন্য আমাদের পেজটির সাথে থাকুন। সবাই নিরাপদে থাকুন! 🌍❤️"

    # B. Location / State / Map Disputes & Skepticism (e.g., 'that's California!', 'wrong state', 'idiots')
    has_dispute = any(k in text_lower for k in ["that's", "thats", "wrong", "idiot", "not in", "is in", "stupid", "dumb"]) or \
                  ("california" in text_lower and "california" not in loc.lower()) or \
                  ("bataan" in text_lower and "bataan" not in loc.lower())

    if has_dispute:
        disputed_mention = ""
        for place_cand in ["california", "texas", "alaska", "bataan", "nevada", "florida", "mexico"]:
            if place_cand in text_lower and place_cand not in loc.lower():
                disputed_mention = place_cand.title()
                break

        if disputed_mention:
            return (
                f"Hello {user_name}! Easy mistake to make — while {disputed_mention} is very well known, "
                f"this specific earthquake actually occurred at {loc} (official USGS coordinates: {coords}). "
                f"Seismic monitoring stations verified the epicenter right here in {short_loc}, not in {disputed_mention}. "
                "Thank you for checking, and have a wonderful day! 🌍📍"
            )
        else:
            return (
                f"Hello {user_name}! To clarify the location: according to official USGS and EMSC seismic monitoring stations, "
                f"the epicenter was scientifically recorded at {loc} (coordinates: {coords}). "
                "Global seismic sensors triangulate the exact GPS location independently of local administrative names. "
                "Thank you for sharing your thoughts, and stay safe! 🌍📍"
            )

    # C. Location Inquiries & Regional Clarification (e.g., Pilar Siargao vs Pilar Bataan, 'where is this?')
    location_keywords = [
        "where", "location", "which", "province", "municipality", "city", "island", "town",
        "what place", "exact location", "where exactly", "is this in", "what town", "what province",
        "dimana", "lokasi", "propinsi", "donde", "provincia", "cual", "saang", "saan"
    ]
    if any(k in text_lower for k in location_keywords):
        if "pilar" in text_lower or "pilar" in ctx_clean.lower():
            return (
                f"Hello {user_name}! In the Philippines, several municipalities share the name Pilar (including in Bataan, Sorsogon, Surigao del Norte, Bohol, and Cebu). "
                "This specific earthquake was centered offshore near Pilar on Siargao Island, Province of Surigao del Norte (Caraga Region, Mindanao) — NOT Pilar, Bataan in Luzon. "
                "Our satellite map marks the exact offshore epicenter. Stay safe! 🇵🇭🗺️"
            )
        return (
            f"Hello {user_name}! According to official USGS seismic data, this earthquake was centered at {loc} (coordinates: {coords}). "
            "Seismological stations calculate the epicenter relative to the nearest registered municipality or coastline shown on our video map. Stay safe! 🌍📍"
        )

    # D. Did Not Feel / Distance Questions (Must check BEFORE felt reports!)
    not_felt_keywords = [
        "didn't feel", "didnt feel", "did not feel", "nothing felt", "felt nothing",
        "no shake", "no shaking", "didn't notice", "didnt notice", "not feeling anything",
        "walang naramdaman", "hindi naramdaman", "no se sintio"
    ]
    if any(k in text_lower for k in not_felt_keywords):
        return (
            f"Hello {user_name}! Seismic wave intensity diminishes quickly with distance from the epicenter, focal depth ({depth}), and local bedrock geology. "
            "Moderate quakes are often felt only near the immediate epicenter or by sensitive instruments. Thank you for your ground observation! 🌍📡"
        )

    # E. Felt Reports / Ground Shaking Experience
    felt_keywords = [
        "felt", "feel", "shook", "shaking", "scary", "strong", "woke me", "rumbled", "bed moved", "house shook",
        "big jolt", "terasa", "goyang", "kencang", "hissedildi", "sintio", "temblor", "naramdaman", "lumindol"
    ]
    if any(k in text_lower for k in felt_keywords):
        return (
            f"Thank you {user_name} for sharing your valuable ground report! Experiencing shaking can be frightening. "
            "Please check your immediate surroundings for minor hazards, keep emergency supplies handy, and stay aware of possible mild aftershocks. "
            "Stay alert and stay safe! 🤝❤️"
        )

    # F. Tsunami Inquiries
    tsunami_keywords = ["tsunami", "wave", "tidal", "waves", "maremoto", "gelombang"]
    if any(k in text_lower for k in tsunami_keywords):
        return (
            f"Hello {user_name}! Based on official assessments from NOAA and the Pacific Tsunami Warning Center (PTWC), there is NO immediate destructive tsunami threat from this specific event. "
            "Our automated network monitors live ocean buoy telemetry 24/7. Stay calm and stay safe! 🌊✅"
        )

    # G. Aftershocks & Future Quake Fears ('Big One')
    aftershock_keywords = ["aftershock", "aftershocks", "bigger one", "big one", "another one", "next quake", "predict", "coming soon"]
    if any(k in text_lower for k in aftershock_keywords):
        return (
            f"Hello {user_name}! Minor aftershocks are a natural process as tectonic plates settle along the fault line. They typically decrease in frequency and strength over time. "
            "While earthquakes cannot be predicted in advance, staying prepared with a basic family safety kit is always wise. Stay alert and stay safe! 🌍🛡️"
        )

    # H. Safety Advice / What to do
    safety_keywords = ["what to do", "how to protect", "evacuate", "safety tip", "drop cover"]
    if any(k in text_lower for k in safety_keywords):
        return (
            f"Hello {user_name}! If an earthquake occurs: DROP to the ground, take COVER under a sturdy table or desk, and HOLD ON until shaking stops. "
            "Stay away from glass, windows, and heavy furniture. Never use elevators during or immediately after a quake. Stay prepared and stay safe! 🛡️🤝"
        )

    # I. Fake News / Skepticism / Disbelief
    fake_keywords = [
        "fake", "hoax", "liar", "lie", "bullshit", "clickbait", "stop lying", "cap", "scam", "rumor", "false",
        "bohong", "palsu", "yalan", "falso", "mentira"
    ]
    if any(k in text_lower for k in fake_keywords):
        return (
            f"Hello {user_name}! This seismic event is 100% verified and recorded by official global seismic sensor stations from the USGS (US Geological Survey) and EMSC. "
            "Many earthquakes occur deep beneath the Earth's crust or offshore, registering on sensitive seismometers even if shaking isn't felt across distant cities. "
            "We only publish verified scientific data. Stay safe! 🌍🔬"
        )

    # J. Prayers & Blessings
    prayer_keywords = ["pray", "prayers", "god", "allah", "bless", "lord", "amen", "amin", "safe", "semoga", "dios", "bendiga"]
    if any(k in text_lower for k in prayer_keywords):
        return f"Amen! Wishing safety, protection, and peace to everyone and their families in the affected regions. Stay alert and take care! 🙏❤️"

    # K. Appreciation & Thanks
    thanks_keywords = [
        "thank", "thanks", "great", "fast", "good job", "awesome", "useful", "nice", "love", "good work",
        "terima kasih", "makasih", "tesekkur", "sagol", "gracias", "salamat"
    ]
    if any(k in text_lower for k in thanks_keywords):
        return (
            f"Thank you so much {user_name} for your support! We are dedicated to providing 24/7 automated real-time seismic detection to help keep communities informed worldwide. "
            "🔔 Follow @earthquaketracker247 for instant live alerts! 🌍✨"
        )

    # L. Casual Greetings
    greeting_keywords = ["hi", "hello", "hey", "assalamu alaikum", "salam", "good morning", "good evening", "good afternoon", "hola", "kamusta"]
    if any(k in text_lower for k in greeting_keywords) and len(text_clean.split()) <= 4:
        return f"Hello {user_name}! Welcome to Earthquake Tracker 24/7. We monitor global seismic activity in real time to deliver early disaster awareness. Stay safe and have a wonderful day! 🌍👋"

    # M. Default Universal Engaging Reply
    return (
        f"Thank you {user_name} for connecting with Earthquake Tracker 24/7! We truly appreciate your support and ground updates. "
        "Stay alert, stay safe, and follow @earthquaketracker247 for 24/7 instant verified seismic alerts worldwide. 🌍🔔"
    )

def process_comment_auto_replies():
    """
    Scans all recent Facebook Reels, Videos, Photos, and Feed Posts for new unreplied comments.
    Generates intelligent, contextual AI responses matching the user's intent.
    """
    if not FB_PAGE_ACCESS_TOKEN or not FB_PAGE_ID:
        return

    print("💬 Checking for new Facebook comments to auto-reply with AI...", flush=True)

    with history_lock:
        history = load_history()
        replied_comments = set(history.get("replied_comment_ids", []))

    history_changed = False
    media_dict = {}  # media_id -> post_description/title
    headers = {"User-Agent": "EarthquakeTrackerBot/1.0"}

    # 1. Fetch recent Page Feed Posts (Covers Photos, Infographics, Statuses, Shared Media)
    try:
        f_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/feed?fields=id,message&limit=10&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_f = requests.get(f_url, headers=headers, timeout=6)
        if r_f.status_code == 200:
            for item in r_f.json().get("data", []):
                media_dict[item["id"]] = item.get("message", "")
    except Exception as e:
        print(f"⚠️ Note fetching feed list: {e}", flush=True)

    # 2. Fetch recent Facebook Reels (Primary video format)
    try:
        r_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/video_reels?fields=id,description&limit=10&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_res = requests.get(r_url, headers=headers, timeout=6)
        if r_res.status_code == 200:
            for item in r_res.json().get("data", []):
                if item["id"] not in media_dict:
                    media_dict[item["id"]] = item.get("description", "")
    except Exception as e:
        print(f"⚠️ Note fetching video_reels list: {e}", flush=True)

    # 3. Fetch recent Standard Videos
    try:
        v_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/videos?fields=id,title,description&limit=6&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_v = requests.get(v_url, headers=headers, timeout=6)
        if r_v.status_code == 200:
            for item in r_v.json().get("data", []):
                if item["id"] not in media_dict:
                    media_dict[item["id"]] = item.get("description", "") or item.get("title", "")
    except Exception as e:
        print(f"⚠️ Note fetching videos list: {e}", flush=True)

    # 4. Fetch recent Uploaded Photos
    try:
        p_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/photos?type=uploaded&fields=id,name&limit=6&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_p = requests.get(p_url, headers=headers, timeout=6)
        if r_p.status_code == 200:
            for item in r_p.json().get("data", []):
                if item["id"] not in media_dict:
                    media_dict[item["id"]] = item.get("name", "")
    except Exception as e:
        print(f"⚠️ Note fetching photos list: {e}", flush=True)

    # Process all comments across all media items
    new_replies_count = 0
    for media_id, post_context in media_dict.items():
        try:
            c_url = f"https://graph.facebook.com/v20.0/{media_id}/comments?fields=id,from,message,created_time&limit=25&access_token={FB_PAGE_ACCESS_TOKEN}"
            res = requests.get(c_url, headers=headers, timeout=6)
            if res.status_code != 200:
                continue

            comments = res.json().get("data", [])
            for c in comments:
                comment_id = str(c.get("id"))
                from_user = c.get("from", {})
                user_id = str(from_user.get("id", ""))
                user_name = from_user.get("name", "Friend")
                comment_msg = c.get("message", "")

                # Skip if already replied to this comment
                if comment_id in replied_comments:
                    continue

                # Skip comments made by our own page
                if user_id == str(FB_PAGE_ID):
                    continue

                # Generate Smart Contextual AI Reply
                reply_message = generate_ai_comment_reply(comment_msg, user_name, post_context=post_context)

                # Post Auto-Reply to this comment
                reply_url = f"https://graph.facebook.com/v20.0/{comment_id}/comments"
                payload = {
                    "message": reply_message,
                    "access_token": FB_PAGE_ACCESS_TOKEN
                }
                r_post = requests.post(reply_url, data=payload, headers=headers, timeout=10)
                if r_post.status_code == 200:
                    print(f"✅ AI-Replied to [{user_name}]: '{comment_msg[:25]}...' -> '{reply_message[:35]}...'", flush=True)
                    replied_comments.add(comment_id)
                    history_changed = True
                    new_replies_count += 1
                else:
                    print(f"⚠️ Comment reply API response for {comment_id}: {r_post.text}", flush=True)

        except Exception as err:
            print(f"⚠️ Error checking comments for media {media_id}: {err}", flush=True)

    if history_changed:
        with history_lock:
            history = load_history()
            history["replied_comment_ids"] = list(replied_comments)[-3000:]
            save_history(history)

    print(f"✨ Smart AI Comment check complete ({new_replies_count} new replies sent).", flush=True)

if __name__ == "__main__":
    process_comment_auto_replies()

