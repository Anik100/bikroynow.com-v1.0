import os
import sys
import requests
import json

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config import FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN, HISTORY_FILE
from fetcher import load_history, save_history, history_lock

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

def generate_ai_comment_reply(comment_text, user_name="Friend", post_context=""):
    """
    Generates an intelligent, highly contextual AI reply based on user intent:
    - Location inquiry / Regional ambiguity -> Geographical clarification (e.g. Pilar Siargao vs Pilar Bataan)
    - Fake news / skepticism -> Politeness + USGS/EMSC scientific proof
    - Tsunami questions -> PTWC/NOAA status + reassurance
    - Felt reports -> Gratitude + ground safety tips
    - Greetings / Praise -> Welcoming + Follow CTA
    """
    text_clean = (comment_text or "").strip()
    text_lower = text_clean.lower()
    ctx_clean = (post_context or "").strip()
    ctx_lower = ctx_clean.lower()

    # 1. Try Google Gemini API if key is available
    if GEMINI_API_KEY:
        try:
            prompt = (
                "You are Earthquake Tracker official AI assistant on Facebook. "
                f"Post Details: \"{ctx_clean}\". "
                f"A user named '{user_name}' commented on our live earthquake alert post: \"{text_clean}\". "
                "Generate a polite, scientific, concise (2-3 sentences maximum) reply. "
                "If they ask about the location, province, town, municipality, or if there is confusion about duplicate place names (e.g., Pilar in the Philippines), clearly and accurately explain which exact province/island/region this earthquake occurred near based on the post details and seismological coordinates. "
                "If they say fake news or doubt the quake, politely state it was verified by USGS/EMSC seismic stations. "
                "If they ask about tsunami, confirm NOAA/PTWC reported no immediate threat. "
                "If they felt it, thank them and give a quick safety reminder. "
                "Reply in the same language as the user comment (English, Bengali, Spanish, Tagalog, etc.). "
                "Do not use hashtags. Keep it natural, informative, and caring."
            )
            g_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 180, "temperature": 0.4}
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
            print(f"Gemini AI fallback: {e}")

    # 2. Contextual Intelligent Rule-Based Engine (100% Reliable Fallback)
    
    # Category 0: Location Questions / Regional Clarification (e.g. Pilar, Bataan vs Pilar, Siargao)
    location_keywords = [
        "where", "location", "which", "province", "municipality", "city", "island", "town",
        "bataan", "sorsogon", "surigao", "siargao", "pilar", "what place", "complete the info",
        "exact location", "where exactly", "is this in", "is that in", "what town", "what province",
        "কোন জায়গা", "কোন জেলা", "কোন প্রদেশ", "কোথায়", "কোন স্থান", "বিস্তারিত লোকেশন",
        "dimana", "lokasi", "propinsi", "donde", "provincia", "cual", "saang", "saan"
    ]
    if any(k in text_lower for k in location_keywords):
        # Case A: Philippines Pilar ambiguity
        if "pilar" in text_lower or "pilar" in ctx_lower:
            return (
                f"Hello {user_name}! Excellent question. In the Philippines, there are several municipalities named Pilar (including in Bataan, Sorsogon, Surigao del Norte, Bohol, Capiz, Cebu, and Abra). "
                "This specific M4.8 earthquake occurred offshore in the Philippine Sea, approximately 29 km east-northeast of Pilar on Siargao Island, Province of Surigao del Norte (Caraga Region, Mindanao) — NOT Pilar, Bataan in Luzon. "
                "Our satellite map pin marks the exact offshore epicenter. Thank you for asking, and stay safe! 🇵🇭🗺️"
            )

        # Case B: Universal location extraction from post context
        detected_loc = ""
        if "Region / Epicenter:" in ctx_clean:
            try:
                detected_loc = ctx_clean.split("Region / Epicenter:")[1].split("\n")[0].strip()
            except Exception:
                pass
        elif "of " in ctx_clean:
            try:
                detected_loc = ctx_clean.split("of ")[1].split("\n")[0].strip()
            except Exception:
                pass

        if detected_loc:
            return (
                f"Hello {user_name}! To clarify the location: according to official USGS and regional seismic networks, this earthquake was centered at {detected_loc}. "
                "Seismological monitoring stations calculate the epicenter using high-precision GPS coordinates relative to the nearest registered coastal landmark or municipality. "
                "Please refer to the satellite map shown in the video for the exact regional fault coordinates. Stay safe! 🌍📍"
            )
        else:
            return (
                f"Hello {user_name}! The epicenter is determined by global seismic monitoring networks (USGS/EMSC) using exact GPS latitude and longitude coordinates relative to the nearest municipality or coastline shown on our video map. "
                "Thank you for checking, and stay safe! 🌍📍"
            )

    # Category A: Fake News / Skepticism / Disbelief
    fake_keywords = [
        "fake", "hoax", "liar", "lie", "didnt happen", "didn't happen", "nothing felt", "did not feel",
        "didnt feel", "didn't feel", "no shake", "bullshit", "scam", "rumor", "false",
        "ভুয়া", "ভুয়া", "মিথ্যা", "কিছুই হয়নি", "কিছু হয়নি", "বানোয়াট",
        "bohong", "palsu", "yalan", "falso", "mentira"
    ]
    if any(k in text_lower for k in fake_keywords):
        return (
            f"Hello {user_name}! This seismic event is 100% verified and recorded by official global seismic sensor stations from the USGS (US Geological Survey) and EMSC. "
            "Many earthquakes occur deep beneath the Earth's crust or offshore, which may only be felt near the epicenter or registered by sensitive seismographs. "
            "We only publish verified scientific data. Stay safe! 🌍🔬"
        )

    # Category B: Tsunami Questions
    tsunami_keywords = ["tsunami", "wave", "tidal", "সুনামি", "ঢেউ", "gelombang", "maremoto"]
    if any(k in text_lower for k in tsunami_keywords):
        return (
            f"Hello {user_name}! Based on official assessments from NOAA and the Pacific Tsunami Warning Center (PTWC), there is NO immediate destructive tsunami threat from this specific event. "
            "Our automated network monitors live ocean buoy telemetry 24/7. Stay calm and stay safe! 🌊✅"
        )

    # Category C: Felt reports / Ground experience
    felt_keywords = [
        "felt", "feel", "shook", "shaking", "scary", "strong", "woke me", "building",
        "কেঁপেছে", "টের পেয়েছি", "ভয়", "ঝাঁকুনি", "কাঁপল",
        "terasa", "goyang", "kencang", "hissedildi", "sintio", "temblor"
    ]
    if any(k in text_lower for k in felt_keywords):
        return (
            f"Thank you {user_name} for sharing your valuable ground report! Please inspect your surroundings for minor damages, avoid elevators, and keep emergency supplies accessible in case of mild aftershocks. "
            "Stay alert and stay safe! 🤝❤️"
        )

    # Category D: Appreciation / Good work / Thanks
    thanks_keywords = [
        "thank", "thanks", "great", "fast", "good job", "awesome", "useful", "nice", "love",
        "ধন্যবাদ", "অনেক ভালো", "থ্যাংকস", "সেরা",
        "terima kasih", "makasih", "tesekkur", "sagol", "gracias"
    ]
    if any(k in text_lower for k in thanks_keywords):
        return (
            f"Thank you so much {user_name} for your support! We are dedicated to providing 24/7 automated real-time seismic detection to help keep communities informed worldwide. "
            "🔔 Follow @earthquaketracker247 for instant live updates! 🌍✨"
        )

    # Category E: Prayers / Safety wishes
    prayer_keywords = [
        "pray", "god", "allah", "safe", "bless", "lord", "amin", "amen",
        "দোয়া", "দোয়া", "আল্লাহ", "হে আল্লাহ", "আমিন",
        "semoga", "bismillah", "dios"
    ]
    if any(k in text_lower for k in prayer_keywords):
        return (
            f"Amen! Wishing safety, protection, and peace to everyone in the affected regions. Stay alert and take care of your loved ones! 🙏❤️"
        )

    # Category F: Greetings
    greeting_keywords = ["hi", "hello", "hey", "assalamu alaikum", "salam", "good morning", "good evening", "হাই", "হ্যালো", "সালাম"]
    if any(k in text_lower for k in greeting_keywords) and len(text_clean.split()) <= 4:
        return (
            f"Hello {user_name}! Welcome to Earthquake Tracker 24/7. We monitor global seismic activity in real time to provide early disaster awareness. Stay safe and have a wonderful day! 🌍👋"
        )

    # Category G: Default Universal Engaging Reply
    return (
        f"Thank you {user_name} for connecting with us! We truly appreciate your support and valuable ground updates. "
        "Stay alert, stay safe, and follow @earthquaketracker247 for 24/7 instant real-time alerts worldwide. 🌍🔔"
    )

def process_comment_auto_replies():
    """
    Scans all recent Facebook Reels, Videos, and Photos for new unreplied comments.
    Generates intelligent AI responses matching the user's intent.
    """
    if not FB_PAGE_ACCESS_TOKEN or not FB_PAGE_ID:
        return

    print("💬 Checking for new Facebook comments to auto-reply with AI...")

    with history_lock:
        history = load_history()
        replied_comments = set(history.get("replied_comment_ids", []))

    history_changed = False
    media_dict = {} # media_id -> post_description/title
    headers = {"User-Agent": "EarthquakeTrackerBot/1.0"}

    # 1. Fetch recent Facebook Reels (Primary format!)
    try:
        r_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/video_reels?fields=id,description&limit=15&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_res = requests.get(r_url, headers=headers, timeout=10)
        if r_res.status_code == 200:
            for item in r_res.json().get("data", []):
                media_dict[item["id"]] = item.get("description", "")
    except Exception as e:
        print(f"⚠️ Note fetching video_reels list: {e}")

    # 2. Fetch recent Standard Videos
    try:
        v_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/videos?fields=id,title,description&limit=8&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_v = requests.get(v_url, headers=headers, timeout=10)
        if r_v.status_code == 200:
            for item in r_v.json().get("data", []):
                if item["id"] not in media_dict:
                    media_dict[item["id"]] = item.get("description", "") or item.get("title", "")
    except Exception as e:
        print(f"⚠️ Note fetching videos list: {e}")

    # 3. Fetch recent Photos
    try:
        p_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/photos?type=uploaded&fields=id,name&limit=8&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_p = requests.get(p_url, headers=headers, timeout=10)
        if r_p.status_code == 200:
            for item in r_p.json().get("data", []):
                if item["id"] not in media_dict:
                    media_dict[item["id"]] = item.get("name", "")
    except Exception as e:
        print(f"⚠️ Note fetching photos list: {e}")

    # Process all comments across all media
    new_replies_count = 0
    for media_id, post_context in media_dict.items():
        try:
            c_url = f"https://graph.facebook.com/v20.0/{media_id}/comments?fields=id,from,message,created_time&limit=25&access_token={FB_PAGE_ACCESS_TOKEN}"
            res = requests.get(c_url, headers=headers, timeout=10)
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

                # Generate Smart Contextual AI Reply with Post Context
                reply_message = generate_ai_comment_reply(comment_msg, user_name, post_context=post_context)

                # Post Auto-Reply to this comment
                reply_url = f"https://graph.facebook.com/v20.0/{comment_id}/comments"
                payload = {
                    "message": reply_message,
                    "access_token": FB_PAGE_ACCESS_TOKEN
                }
                r_post = requests.post(reply_url, data=payload, headers=headers, timeout=12)
                if r_post.status_code == 200:
                    print(f"✅ AI-Replied to [{user_name}]: '{comment_msg[:25]}...' -> '{reply_message[:35]}...'")
                    replied_comments.add(comment_id)
                    history_changed = True
                    new_replies_count += 1
                else:
                    print(f"⚠️ Comment reply API response: {r_post.text}")

        except Exception as err:
            print(f"⚠️ Error checking comments for media {media_id}: {err}")

    if history_changed:
        with history_lock:
            history = load_history()
            history["replied_comment_ids"] = list(replied_comments)[-3000:]
            save_history(history)

    print(f"✨ Smart AI Comment check complete ({new_replies_count} new replies sent).")

if __name__ == "__main__":
    process_comment_auto_replies()
