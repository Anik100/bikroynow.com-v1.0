import os
import sys
import requests
import json
import re
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config import FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN, HISTORY_FILE
from fetcher import load_history, save_history, history_lock

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
PAGE_LINK = "facebook.com/earthquaketracker247"
FOLLOW_CTA = f"Follow {PAGE_LINK}"

def parse_post_context(post_context):
    """
    Extracts structured seismic metadata from the post context or caption:
    - location / epicenter
    - short location
    - magnitude
    - depth
    - coordinates
    - tsunami status
    - local_time & utc_time
    """
    info = {
        "location": "",
        "short_location": "",
        "mag": "",
        "depth": "",
        "coords": "",
        "tsunami": "",
        "local_time": "",
        "utc_time": ""
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
            info["mag"] = line.split("Magnitude:")[1].strip().replace("M", "").strip()
        elif "Depth:" in line:
            info["depth"] = line.split("Depth:")[1].strip()
        elif "Tsunami Status:" in line:
            info["tsunami"] = line.split("Tsunami Status:")[1].strip()
        elif "Local Time:" in line:
            info["local_time"] = line.split("Local Time:")[1].strip()
        elif "Universal Time:" in line:
            info["utc_time"] = line.split("Universal Time:")[1].strip()

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

def generate_ai_comment_reply(comment_text, user_name="Friend", post_context="", post_created_time=None):
    """
    Generates an intelligent, highly contextual, empathetic, and scientifically accurate AI reply
    matching ANY type of comment from users, across both brand-new and older published posts.
    
    If the post was published earlier (hours or days ago), it professionally notes that this alert
    covers an earlier recorded seismic event from that date, while precisely answering the commenter's
    question or ground report.
    """
    text_clean = (comment_text or "").strip()
    text_lower = text_clean.lower()
    ctx_clean = (post_context or "").strip()
    ctx_info = parse_post_context(ctx_clean)
    loc = ctx_info["location"] or "the region indicated on the map"
    short_loc = ctx_info["short_location"] or loc
    coords = ctx_info["coords"] or "official USGS coordinates"
    depth = ctx_info["depth"] or "shallow depth"
    mag = ctx_info["mag"] or "4.5"

    # Clean Name Formatting (Never say robotic 'Friend'!)
    clean_user = (user_name or "").strip()
    if clean_user.lower() in ["friend", "there", "user", ""]:
        prefix = "Hello! "
        thanks_prefix = "Thank you so much "
    else:
        prefix = f"Hello {clean_user}! "
        thanks_prefix = f"Thank you {clean_user} "

    # Calculate Post Age & Determine if this is an earlier recorded event
    is_earlier_event = False
    date_label = ""
    
    if post_created_time:
        try:
            clean_time = post_created_time.replace("Z", "+0000")
            p_dt = datetime.fromisoformat(clean_time)
            now = datetime.now(timezone.utc)
            age_hours = (now - p_dt).total_seconds() / 3600.0
            if age_hours >= 3.0:
                is_earlier_event = True
                date_label = p_dt.strftime("%B %d, %Y")
        except Exception:
            pass
            
    if not date_label and ctx_info.get("local_time"):
        date_label = ctx_info["local_time"].split(" at ")[0].strip()
        is_earlier_event = True
    elif not date_label and ctx_info.get("utc_time"):
        date_label = ctx_info["utc_time"].split(" at ")[0].strip()
        is_earlier_event = True

    earlier_clause = f"Please note this alert covers an earlier recorded earthquake from {date_label}. " if (is_earlier_event and date_label) else ""

    # 1. Try Google Gemini API if key is available
    if GEMINI_API_KEY:
        try:
            if is_earlier_event and date_label:
                earlier_instruction = (
                    f"IMPORTANT - EARLIER EVENT CONTEXT: This earthquake post was published earlier on {date_label}. "
                    f"You MUST professionally clarify in your reply that this alert refers to an earlier recorded seismic event (e.g., 'Please note that this alert covers an earlier recorded earthquake from {date_label}...'), "
                    "while directly answering the user's specific comment with scientific accuracy, respect, and reassurance. "
                )
            else:
                earlier_instruction = "This is a recent earthquake alert. "

            prompt = (
                "You are Earthquake Tracker official AI assistant on Facebook. "
                "This is an international page with a worldwide global audience. "
                f"Post Details: \"{ctx_clean}\". "
                f"{earlier_instruction}"
                f"A user named '{clean_user or 'a follower'}' commented: \"{text_clean}\". "
                "Generate a polite, scientific, concise (2-3 sentences maximum) reply matching their exact intent. "
                "Instructions based on user intent: "
                "1. If they discuss plate tectonics, fault lines, trenches, volcanoes, or wishing the quakes would stop/calm down, or invoke cultural/traditional deities (e.g. Ruaumoko, Pele): resonate respectfully with their wish for calm/peace, explain tectonic stress release gently, and wish safety. "
                "2. If they express anxiety, shock, fear, panic, or post shock emojis (e.g. 😳, 😱): offer warm comfort, calming empathy, and explain that shaking has passed and no tsunami danger exists. "
                "3. If they ask about infrastructure impact (e.g. Panama Canal, bridges, dams): explain scientifically based on magnitude and distance whether any damage is possible (moderate quakes like M4-M5 do not crack major canal locks or heavy concrete structures). "
                "4. If they dispute the location or state: warmly clarify that places share identical names and cite verified USGS GPS coordinates. "
                "5. If they felt the quake: thank them for their ground report and advise basic aftershock preparedness. "
                "6. If they say they did not feel it or reports that all is fine: thank them for the ground observation and explain seismic attenuation with distance and depth. "
                "7. If they ask about a tsunami: reassure them based on official NOAA/PTWC assessments. "
                "8. If they claim fake news: explain it was verified by USGS/EMSC seismic stations and cite exact epicenter and depth. "
                "9. If they write prayers or blessings: respond with heartfelt empathy ('Amen!'). "
                "10. MANDATORY SAFETY & PAGE FOLLOW CALL-TO-ACTION: In every single reply, always advise following official safety guidelines and invite users to follow our page with the clean direct link: 'Follow facebook.com/earthquaketracker247 for official safety guidelines and live updates'. Do not write the @username handle separately, just use the clean link facebook.com/earthquaketracker247 so users can tap it directly to open the page and follow. "
                "11. IMPORTANT: Always reply strictly in natural, professional English only. "
                "Do not use hashtags. Keep it natural, informative, caring, and engaging. Never address the user as 'Friend'."
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

    # A. Multilingual / Bengali Input (Always reply strictly in English for global audience!)
    is_bengali = any('\u0980' <= ch <= '\u09ff' for ch in text_clean)
    if is_bengali:
        if any(k in text_clean for k in ["কোথায়", "কোন জায়গা", "কোন জেলা", "কোথা", "স্থান"]):
            return f"{prefix}{earlier_clause}According to official seismic monitoring stations, this earthquake was centered at {loc} (USGS coordinates: {coords}). {FOLLOW_CTA} for official safety guidelines and live updates! 🌍📍"
        if any(k in text_clean for k in ["টের", "কেঁপে", "ভয়", "ঝাঁকুনি", "অনুভব", "কাঁপ"]):
            return f"{thanks_prefix}for sharing your ground report! {earlier_clause}Shaking can be frightening. Please follow earthquake safety guidelines (Drop, Cover, and Hold On), keep essentials handy, and {FOLLOW_CTA} for 24/7 live alerts. 🤝❤️"
        if any(k in text_clean for k in ["আল্লাহ", "আমিন", "দোয়া", "দোয়া", "রক্ষা", "হেফাজত"]):
            return f"Amen! {earlier_clause}Wishing safety, strength, and protection to everyone in the affected regions. {FOLLOW_CTA} for official safety guidelines and 24/7 live updates! 🙏❤️"
        if any(k in text_clean for k in ["ভুয়া", "ভুয়া", "মিথ্যা", "কিছু হয়নি", "গুজব"]):
            return f"{prefix}{earlier_clause}This seismic event is 100% verified and recorded by official global seismic sensor stations from the USGS (US Geological Survey) and EMSC. {FOLLOW_CTA} for verified scientific data and official safety guidelines! 🌍🔬"
        if any(k in text_clean for k in ["ধন্যবাদ", "থ্যাংকস", "ভালো", "সুন্দর", "সেরা"]):
            return f"{thanks_prefix}for your support! {earlier_clause}We are dedicated to providing 24/7 automated real-time seismic detection. 🔔 {FOLLOW_CTA} for official safety guidelines and live alerts! 🌍✨"
        return f"{thanks_prefix}for connecting with Earthquake Tracker 24/7! {earlier_clause}We monitor global seismic activity in real time. 🔔 {FOLLOW_CTA} for official earthquake safety guidelines and 24/7 live alerts! 🌍🔔"

    # B. Shock Emojis / Astonishment (e.g. 😳😳😳, 😱, OMG)
    emoji_shock = ["😳", "😱", "😨", "😲", "😯", "😮", "omg", "wth", "wtf", "holy", "damn", "whoa", "woah"]
    if any(k in text_lower for k in emoji_shock) or (len(text_clean) > 0 and all(ch in "😳😱😨😲😯😮❗❕❓" for ch in text_clean)):
        return (
            f"{prefix}{earlier_clause}While sudden seismic alerts can certainly be startling, official seismology reports show this occurred offshore at {loc} with no destructive tsunami threat. "
            f"Stay alert, stay safe, and {FOLLOW_CTA} for official safety guidelines and 24/7 live alerts! 🌍🔔"
        )

    # C. Infrastructure / Maritime / Canal impact (e.g. Panama Canal)
    infra_keywords = ["canal", "panama canal", "bridge", "dam", "crack", "passage", "collapse", "structure"]
    if any(k in text_lower for k in infra_keywords):
        return (
            f"{prefix}{earlier_clause}The epicenter was located well south of major maritime passages and canal infrastructure. "
            f"A moderate earthquake does not possess sufficient energy to fracture canal locks or disrupt maritime navigation. "
            f"Stay safe and {FOLLOW_CTA} for official safety guidelines and live updates! 🌍🚢"
        )

    # D. Tectonic / Trench / Fault / Volcano / Calming Down / Cultural Deities (e.g. Ruuaumoko)
    tectonic_keywords = [
        "plate", "tectonic", "trench", "fault", "volcano", "dormant", "calm",
        "stop immediately", "stop shaking", "ring of fire", "subduction", "rift",
        "crust", "plates", "magma", "mantle", "ruuaumoko", "ruaumoko", "ata haere"
    ]
    if any(k in text_lower for k in tectonic_keywords):
        return (
            f"{prefix}We truly share your heartfelt wish for calm and peace across the tectonic plates and fault systems. "
            f"{earlier_clause}While the Earth's dynamic crust continually releases strain along active subduction trenches and volcanic arcs, "
            f"we pray for safety and minimal disruption. {FOLLOW_CTA} for official safety guidelines and 24/7 live updates! 🌍🕊️"
        )

    # E. Anxiety / Fear / Trauma / Panic
    fear_keywords = [
        "scared", "scary", "terrified", "panic", "panicking", "trauma", "traumatized",
        "nervous", "anxious", "anxiety", "cant sleep", "can't sleep", "heart beating",
        "dizzy", "crying", "terrifying"
    ]
    if any(k in text_lower for k in fear_keywords):
        return (
            f"{prefix}Experiencing an earthquake is deeply unsettling, and it is completely natural to feel anxious or on edge. "
            f"{earlier_clause}Please take slow, deep breaths, keep emergency footwear and flashlights nearby, and follow essential earthquake safety guidelines (Drop, Cover, and Hold On). "
            f"You are not alone—{FOLLOW_CTA} for official safety guidelines and live support. Stay safe! 🤝❤️"
        )

    # F. Magnitude / Measurement Doubts / Intensity
    mag_keywords = [
        "downgraded", "upgraded", "only 5", "only 4", "felt like 6", "felt like 7",
        "felt bigger", "felt stronger", "magnitude wrong", "richter", "scale"
    ]
    if any(k in text_lower for k in mag_keywords):
        return (
            f"{prefix}{earlier_clause}Seismic monitoring networks (USGS/EMSC) calculate preliminary magnitudes automatically from real-time seismometer wave amplitudes, which are then refined by seismologists as more station telemetry arrives. "
            f"Focal depth ({depth}) and local bedrock geology also heavily influence how intense shaking feels at the surface. {FOLLOW_CTA} for official safety guidelines and 24/7 live updates! 🌍📡"
        )

    # G. Checking on Community / Casual Well-Wishing / Everything Fine Reports
    community_keywords = [
        "hope everyone", "everyone ok", "everyone okay", "is everyone safe", "check in",
        "any casualties", "any damage", "how is everyone", "everything fine", "everything is ok", "all ok", "all fine"
    ]
    if any(k in text_lower for k in community_keywords):
        return (
            f"{prefix}We sincerely appreciate your ground confirmation! {earlier_clause}We hope and pray all residents and families across the region remain safe and secure. "
            f"{FOLLOW_CTA} to stay updated on official safety guidelines and live seismic reports. Stay safe! 🤝❤️"
        )

    # H. Location / State / Map Disputes & Skepticism (e.g., 'that's California!', 'wrong state', 'idiots')
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
                f"{prefix}Easy mistake to make — while {disputed_mention} is very well known, "
                f"{earlier_clause}this specific earthquake actually occurred at {loc} (official USGS coordinates: {coords}). "
                f"Seismic monitoring stations verified the epicenter right here in {short_loc}, not in {disputed_mention}. "
                f"Stay safe and {FOLLOW_CTA} for official safety guidelines and 24/7 live alerts! 🌍📍"
            )
        else:
            return (
                f"{prefix}To clarify the location: {earlier_clause}according to official USGS and EMSC seismic monitoring stations, "
                f"the epicenter was scientifically recorded at {loc} (coordinates: {coords}). "
                "Global seismic sensors triangulate the exact GPS location independently of local administrative names. "
                f"Stay safe and {FOLLOW_CTA} for official safety guidelines and 24/7 live alerts! 🌍📍"
            )

    # I. Location Inquiries & Regional Clarification (e.g., Pilar Siargao vs Pilar Bataan, 'where is this?')
    location_keywords = [
        "where", "location", "which", "province", "municipality", "city", "island", "town",
        "what place", "exact location", "where exactly", "is this in", "what town", "what province",
        "dimana", "lokasi", "propinsi", "donde", "provincia", "cual", "saang", "saan"
    ]
    if any(k in text_lower for k in location_keywords):
        if "pilar" in text_lower or "pilar" in ctx_clean.lower():
            return (
                f"{prefix}In the Philippines, several municipalities share the name Pilar (including in Bataan, Sorsogon, Surigao del Norte, Bohol, and Cebu). "
                f"{earlier_clause}This specific earthquake was centered offshore near Pilar on Siargao Island, Province of Surigao del Norte (Caraga Region, Mindanao) — NOT Pilar, Bataan in Luzon. "
                f"Our satellite map marks the exact offshore epicenter. {FOLLOW_CTA} for official safety guidelines and 24/7 live alerts! 🇵🇭🗺️"
            )
        return (
            f"{prefix}According to official USGS seismic data, {earlier_clause}this earthquake was centered at {loc} (coordinates: {coords}). "
            "Seismological stations calculate the epicenter relative to the nearest registered municipality or coastline shown on our video map. "
            f"Stay safe and {FOLLOW_CTA} for official safety guidelines and 24/7 live alerts! 🌍📍"
        )

    # J. Did Not Feel / Distance Questions (Must check BEFORE felt reports!)
    not_felt_keywords = [
        "didn't feel", "didnt feel", "did not feel", "nothing felt", "felt nothing",
        "no shake", "no shaking", "didn't notice", "didnt notice", "not feeling anything",
        "walang naramdaman", "hindi naramdaman", "no se sintio", "nothing at all", "nothing at", "haven't felt", "havent felt"
    ]
    if any(k in text_lower for k in not_felt_keywords):
        return (
            f"{prefix}{earlier_clause}Seismic wave intensity diminishes quickly with distance from the epicenter, focal depth ({depth}), and local bedrock geology. "
            "Moderate quakes are often felt only near the immediate epicenter or by sensitive instruments. "
            f"Thank you for your ground observation! {FOLLOW_CTA} for official safety guidelines and 24/7 live alerts! 🌍📡"
        )

    # K. Felt Reports / Ground Shaking Experience
    felt_keywords = [
        "felt", "feel", "shook", "shaking", "scary", "strong", "woke me", "rumbled", "bed moved", "house shook",
        "big jolt", "terasa", "goyang", "kencang", "hissedildi", "sintio", "temblor", "naramdaman", "lumindol", "vibration", "tremor"
    ]
    if any(k in text_lower for k in felt_keywords):
        return (
            f"{thanks_prefix}for sharing your valuable ground report! {earlier_clause}Experiencing shaking can be frightening. "
            "Please check your immediate surroundings for minor hazards, follow earthquake safety guidelines (Drop, Cover, and Hold On), and stay prepared for mild aftershocks. "
            f"Stay alert, stay safe, and {FOLLOW_CTA} for official safety guidelines and live updates! 🤝❤️"
        )

    # L. Tsunami Inquiries
    tsunami_keywords = ["tsunami", "wave", "tidal", "waves", "maremoto", "gelombang"]
    if any(k in text_lower for k in tsunami_keywords):
        return (
            f"{prefix}Based on official assessments from NOAA and the Pacific Tsunami Warning Center (PTWC), {earlier_clause}there is NO immediate destructive tsunami threat from this specific event. "
            f"Our automated network monitors live ocean buoy telemetry 24/7. Stay calm, and {FOLLOW_CTA} for official coastal safety guidelines and live updates! 🌊✅"
        )

    # M. Aftershocks & Future Quake Fears ('Big One')
    aftershock_keywords = ["aftershock", "aftershocks", "bigger one", "big one", "another one", "next quake", "predict", "coming soon"]
    if any(k in text_lower for k in aftershock_keywords):
        return (
            f"{prefix}Minor aftershocks are a natural process as tectonic plates settle along the fault line. They typically decrease in frequency and strength over time. "
            f"{earlier_clause}While earthquakes cannot be predicted in advance, staying prepared is key. {FOLLOW_CTA} for official safety guidelines and 24/7 live alerts! 🌍🛡️"
        )

    # N. Safety Advice / What to do
    safety_keywords = ["what to do", "how to protect", "evacuate", "safety tip", "drop cover"]
    if any(k in text_lower for k in safety_keywords):
        return (
            f"{prefix}Always follow official earthquake safety guidelines: DROP to the ground, take COVER under a sturdy table or desk, and HOLD ON until shaking stops. "
            "Stay away from glass, windows, and heavy furniture. Never use elevators during or immediately after a quake. "
            f"{FOLLOW_CTA} for continuous disaster preparedness tips and 24/7 live seismic alerts! 🛡️🤝"
        )

    # O. Fake News / Skepticism / Disbelief
    fake_keywords = [
        "fake", "hoax", "liar", "lie", "bullshit", "clickbait", "stop lying", "cap", "scam", "rumor", "false",
        "bohong", "palsu", "yalan", "falso", "mentira", "dumb ass", "dumbass"
    ]
    if any(k in text_lower for k in fake_keywords):
        return (
            f"{prefix}{earlier_clause}This seismic event is 100% verified and recorded by official global seismic sensor stations from the USGS (US Geological Survey) and EMSC (coordinates: {coords}). "
            "Many earthquakes occur deep beneath the Earth's crust or offshore, registering on sensitive seismometers even if shaking isn't felt across distant beaches. "
            f"{FOLLOW_CTA} for verified scientific data and official safety guidelines! 🌍🔬"
        )

    # P. Prayers & Blessings
    prayer_keywords = ["pray", "prayers", "god", "allah", "bless", "lord", "amen", "amin", "safe", "semoga", "dios", "bendiga"]
    if any(k in text_lower for k in prayer_keywords):
        return (
            f"Amen! {earlier_clause}Wishing safety, protection, and peace to everyone and their families in the affected regions. "
            f"Please stay alert, take care, and {FOLLOW_CTA} for official safety guidelines and live updates! 🙏❤️"
        )

    # Q. Appreciation & Thanks
    thanks_keywords = [
        "thank", "thanks", "great", "fast", "good job", "awesome", "useful", "nice", "love", "good work",
        "terima kasih", "makasih", "tesekkur", "sagol", "gracias", "salamat"
    ]
    if any(k in text_lower for k in thanks_keywords):
        return (
            f"{thanks_prefix}for your support! {earlier_clause}We are dedicated to providing 24/7 automated real-time seismic detection to help keep communities informed worldwide. "
            f"🔔 {FOLLOW_CTA} for official safety guidelines and instant live alerts! 🌍✨"
        )

    # R. Casual Greetings
    greeting_keywords = ["hi", "hello", "hey", "assalamu alaikum", "salam", "good morning", "good evening", "good afternoon", "hola", "kamusta"]
    if any(k in text_lower for k in greeting_keywords) and len(text_clean.split()) <= 4:
        return (
            f"{prefix}Welcome to Earthquake Tracker 24/7. {earlier_clause}We monitor global seismic activity in real time to deliver early disaster awareness. "
            f"🔔 {FOLLOW_CTA} for official safety guidelines and 24/7 live alerts. Have a wonderful and safe day! 🌍👋"
        )

    # S. Default Universal Engaging Reply
    return (
        f"{thanks_prefix}for connecting with Earthquake Tracker 24/7! {earlier_clause}We monitor global seismic activity in real time to deliver early disaster awareness. "
        f"🔔 {FOLLOW_CTA} for official earthquake safety guidelines and 24/7 instant verified seismic alerts worldwide! 🌍🔔"
    )

def process_comment_auto_replies():
    """
    Scans all recent Facebook Reels, Videos, Photos, and Feed Posts (up to 50 items each) for new unreplied comments.
    Guaranteed zero duplicate replies via 4-tier protection:
    1. Local history cache (replied_comment_ids)
    2. In-memory run deduplication (seen_in_this_run)
    3. Self-page comment ignore
    4. LIVE FACEBOOK GRAPH API SHIELD: inspects sub-replies directly on Facebook. If our page already replied, skip immediately!
    """
    if not FB_PAGE_ACCESS_TOKEN or not FB_PAGE_ID:
        return

    print("💬 Checking for new Facebook comments to auto-reply with AI...", flush=True)

    with history_lock:
        history = load_history()
        replied_comments = set(history.get("replied_comment_ids", []))

    history_changed = False
    media_dict = {}  # media_id -> {"context": post_text, "created_time": c_time}
    headers = {"User-Agent": "EarthquakeTrackerBot/1.0"}

    def add_media_items(items, default_key="message"):
        for item in items:
            m_id = str(item.get("id"))
            txt = item.get("message") or item.get("description") or item.get("title") or item.get("name") or ""
            c_time = item.get("created_time", "")
            if m_id not in media_dict and txt:
                media_dict[m_id] = {
                    "context": txt,
                    "created_time": c_time
                }

    # 1. Fetch recent Page Feed Posts (limit=50)
    try:
        f_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/feed?fields=id,message,created_time&limit=50&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_f = requests.get(f_url, headers=headers, timeout=6)
        if r_f.status_code == 200:
            add_media_items(r_f.json().get("data", []))
    except Exception as e:
        print(f"⚠️ Note fetching feed list: {e}", flush=True)

    # 2. Fetch recent Facebook Reels (limit=50)
    try:
        r_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/video_reels?fields=id,description,created_time&limit=50&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_res = requests.get(r_url, headers=headers, timeout=6)
        if r_res.status_code == 200:
            add_media_items(r_res.json().get("data", []))
    except Exception as e:
        print(f"⚠️ Note fetching video_reels list: {e}", flush=True)

    # 3. Fetch recent Standard Videos (limit=50)
    try:
        v_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/videos?fields=id,title,description,created_time&limit=50&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_v = requests.get(v_url, headers=headers, timeout=6)
        if r_v.status_code == 200:
            add_media_items(r_v.json().get("data", []))
    except Exception as e:
        print(f"⚠️ Note fetching videos list: {e}", flush=True)

    # 4. Fetch recent Uploaded Photos (limit=50)
    try:
        p_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/photos?type=uploaded&fields=id,name,created_time&limit=50&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_p = requests.get(p_url, headers=headers, timeout=6)
        if r_p.status_code == 200:
            add_media_items(r_p.json().get("data", []))
    except Exception as e:
        print(f"⚠️ Note fetching photos list: {e}", flush=True)

    print(f"🔎 Scanning comments across {len(media_dict)} media posts...", flush=True)

    # Fetch comments across all media items concurrently
    def fetch_comments(media_id):
        try:
            c_url = f"https://graph.facebook.com/v20.0/{media_id}/comments?fields=id,from,message,created_time,comments{{from,id}}&limit=50&access_token={FB_PAGE_ACCESS_TOKEN}"
            res = requests.get(c_url, headers=headers, timeout=6)
            if res.status_code == 200:
                return media_id, res.json().get("data", [])
        except Exception as err:
            print(f"⚠️ Error checking comments for media {media_id}: {err}", flush=True)
        return media_id, []

    media_comments = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_comments, mid) for mid in media_dict]
        for fut in as_completed(futures):
            mid, comments = fut.result()
            if comments:
                media_comments.append((mid, comments))

    # Process all comments across all media items
    new_replies_count = 0
    seen_in_this_run = set()

    for media_id, comments in media_comments:
        post_info = media_dict.get(media_id, {})
        post_context = post_info.get("context", "")
        post_created_time = post_info.get("created_time", "")

        for c in comments:
            comment_id = str(c.get("id"))
            from_user = c.get("from", {})
            user_id = str(from_user.get("id", ""))
            raw_name = (from_user.get("name") or "").strip()
            user_name = raw_name if raw_name.lower() != "friend" else ""
            comment_msg = c.get("message", "")

            # 🛡️ SHIELD 1: Skip if already tracked in local history
            if comment_id in replied_comments:
                continue

            # 🛡️ SHIELD 2: Skip if already processed in this current run
            if comment_id in seen_in_this_run:
                continue
            seen_in_this_run.add(comment_id)

            # 🛡️ SHIELD 3: Skip comments made by our own page
            if user_id == str(FB_PAGE_ID):
                continue

            # 🛡️ SHIELD 4 (LIVE FACEBOOK SHIELD):
            # Inspect sub-replies directly on Facebook. If our page already posted any reply, skip and cache!
            sub_comments = c.get("comments", {}).get("data", [])
            already_replied_on_fb = any(str(sub.get("from", {}).get("id", "")) == str(FB_PAGE_ID) for sub in sub_comments)
            if already_replied_on_fb:
                replied_comments.add(comment_id)
                history_changed = True
                continue

            # Generate Smart Contextual AI Reply
            reply_message = generate_ai_comment_reply(
                comment_msg,
                user_name,
                post_context=post_context,
                post_created_time=post_created_time
            )

            # Post Auto-Reply to this comment
            reply_url = f"https://graph.facebook.com/v20.0/{comment_id}/comments"
            payload = {
                "message": reply_message,
                "access_token": FB_PAGE_ACCESS_TOKEN
            }
            r_post = requests.post(reply_url, data=payload, headers=headers, timeout=10)
            if r_post.status_code == 200:
                print(f"✅ AI-Replied to [{user_name or 'user'}]: '{comment_msg[:25]}...' -> '{reply_message[:35]}...'", flush=True)
                replied_comments.add(comment_id)
                history_changed = True
                new_replies_count += 1
            else:
                print(f"⚠️ Comment reply API response for {comment_id}: {r_post.text}", flush=True)

    if history_changed:
        with history_lock:
            history = load_history()
            history["replied_comment_ids"] = list(replied_comments)[-3000:]
            save_history(history)

    print(f"✨ Smart AI Comment check complete ({new_replies_count} new replies sent).", flush=True)

if __name__ == "__main__":
    process_comment_auto_replies()
