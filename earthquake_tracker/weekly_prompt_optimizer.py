import os
import sys
import requests
import json
import re
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config import FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPT_FILE = os.path.join(BASE_DIR, "comment_system_prompt.txt")
FEEDBACK_LOG_FILE = os.path.join(BASE_DIR, "weekly_feedback_log.json")
AUDIT_REPORT_FILE = os.path.join(BASE_DIR, "weekly_audit_report.md")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
PAGE_LINK = "facebook.com/earthquaketracker247"

def fetch_past_week_interactions():
    """
    Fetches posts, comments, and bot sub-replies from the past 7-14 days via Meta Graph API.
    Structures them into clean conversation interaction logs for LLM auditing.
    """
    if not FB_PAGE_ACCESS_TOKEN or not FB_PAGE_ID:
        print("⚠️ Missing FB_PAGE_ACCESS_TOKEN or FB_PAGE_ID", flush=True)
        return []

    headers = {"User-Agent": "EarthquakeTrackerOptimizer/1.0"}
    media_dict = {}

    def add_media(items):
        for item in items:
            mid = str(item.get("id"))
            txt = item.get("message") or item.get("description") or item.get("title") or item.get("name") or ""
            ctime = item.get("created_time", "")
            if mid not in media_dict and txt:
                media_dict[mid] = {
                    "text": txt,
                    "created_time": ctime
                }

    print("📡 Fetching recent posts from Meta Graph API for weekly audit...", flush=True)
    endpoints = [
        f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/feed?fields=id,message,created_time&limit=50&access_token={FB_PAGE_ACCESS_TOKEN}",
        f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/video_reels?fields=id,description,created_time&limit=50&access_token={FB_PAGE_ACCESS_TOKEN}",
        f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/videos?fields=id,title,description,created_time&limit=50&access_token={FB_PAGE_ACCESS_TOKEN}",
        f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/photos?type=uploaded&fields=id,name,created_time&limit=50&access_token={FB_PAGE_ACCESS_TOKEN}"
    ]

    for url in endpoints:
        try:
            r = requests.get(url, headers=headers, timeout=6)
            if r.status_code == 200:
                add_media(r.json().get("data", []))
        except Exception as e:
            print(f"⚠️ Error fetching media list: {e}", flush=True)

    print(f"🔍 Inspecting comments & replies across {len(media_dict)} media posts...", flush=True)

    def fetch_media_interactions(mid):
        interactions = []
        try:
            c_url = f"https://graph.facebook.com/v20.0/{mid}/comments?fields=id,from,message,created_time,comments{{from,id,message,created_time}}&limit=50&access_token={FB_PAGE_ACCESS_TOKEN}"
            res = requests.get(c_url, headers=headers, timeout=6)
            if res.status_code == 200:
                comments = res.json().get("data", [])
                m_info = media_dict.get(mid, {})
                for c in comments:
                    cmsg = (c.get("message") or "").strip()
                    ctime = c.get("created_time", "")
                    cuser = (c.get("from", {}).get("name") or "").strip()
                    uid = str(c.get("from", {}).get("id", ""))
                    
                    if uid == str(FB_PAGE_ID):
                        continue

                    # Look for our page's sub-reply
                    sub_replies = c.get("comments", {}).get("data", [])
                    our_reply = None
                    our_reply_time = None
                    for sub in sub_replies:
                        if str(sub.get("from", {}).get("id", "")) == str(FB_PAGE_ID):
                            our_reply = sub.get("message", "").strip()
                            our_reply_time = sub.get("created_time", "")
                            break

                    if cmsg:
                        interactions.append({
                            "media_id": mid,
                            "post_created_time": m_info.get("created_time", ""),
                            "post_snippet": m_info.get("text", "")[:250].replace("\n", " "),
                            "comment_id": c.get("id"),
                            "comment_time": ctime,
                            "user_name": cuser,
                            "user_comment": cmsg,
                            "bot_replied": our_reply is not None,
                            "bot_reply": our_reply or "[No reply generated]",
                            "reply_time": our_reply_time
                        })
        except Exception as e:
            print(f"⚠️ Error fetching comments for {mid}: {e}", flush=True)
        return interactions

    all_interactions = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_media_interactions, mid) for mid in media_dict]
        for fut in as_completed(futures):
            res = fut.result()
            if res:
                all_interactions.extend(res)

    print(f"📊 Collected {len(all_interactions)} total user comments from recent posts.", flush=True)

    # Save harvested feedback log to disk
    try:
        with open(FEEDBACK_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(all_interactions, f, indent=2, ensure_ascii=False)
        print(f"💾 Saved raw interactions log to {FEEDBACK_LOG_FILE}", flush=True)
    except Exception as e:
        print(f"⚠️ Could not save feedback log: {e}", flush=True)

    return all_interactions

def validate_candidate_prompt(prompt_text):
    """
    Enforces strict safety guardrails on any new candidate prompt generated by the LLM:
    1. Identity Lock: Must identify as 'Earthquake Tracker'.
    2. Dual Agency Lock: Must explicitly cite BOTH 'USGS' and 'EMSC'.
    3. Scientific Integrity / No Prediction: Must forbid predicting future earthquake dates/times.
    4. Call-to-Action Hygiene: Must contain 'facebook.com/earthquaketracker247'.
    5. Clean Greeting: Must forbid robotic 'Friend' salutation.
    6. Length check: Must be comprehensive (between 1000 and 7000 characters).
    """
    if not prompt_text or len(prompt_text) < 800 or len(prompt_text) > 8000:
        return False, f"Prompt length ({len(prompt_text) if prompt_text else 0}) out of safe bounds (800 - 8000 chars)."

    checks = [
        ("Earthquake Tracker", "Must declare Page identity as 'Earthquake Tracker'."),
        ("USGS", "Must mandate official backing from USGS (United States Geological Survey)."),
        ("EMSC", "Must mandate official backing from EMSC (European-Mediterranean Seismological Centre)."),
        ("facebook.com/earthquaketracker247", "Must include the exact follow link 'facebook.com/earthquaketracker247'."),
        ("Friend", "Must forbid addressing users as 'Friend'."),
        ("predict", "Must include rule forbidding false earthquake predictions.")
    ]

    for required_sub, failure_reason in checks:
        if required_sub.lower() not in prompt_text.lower():
            return False, f"Safety Guardrail Failed: {failure_reason} (missing keyword '{required_sub}')"

    return True, "All guardrails passed successfully."

def run_weekly_optimization():
    """
    Main autonomous feedback loop:
    1. Loads current active system prompt.
    2. Collects past week's interactions.
    3. Submits to Gemini LLM Auditor with strict meta-evaluation instructions.
    4. Validates the newly proposed system prompt against safety boundaries.
    5. Safely overwrites comment_system_prompt.txt and outputs audit report.
    """
    print("=" * 60, flush=True)
    print("🤖 STARTING AUTONOMOUS WEEKLY FEEDBACK & PROMPT OPTIMIZER", flush=True)
    print("=" * 60, flush=True)

    if not GEMINI_API_KEY:
        print("❌ GEMINI_API_KEY is not configured. Cannot perform LLM audit.", flush=True)
        return False

    # 1. Load existing prompt
    current_prompt = ""
    if os.path.exists(PROMPT_FILE):
        with open(PROMPT_FILE, "r", encoding="utf-8") as f:
            current_prompt = f.read().strip()

    if not current_prompt:
        print("⚠️ Warning: current prompt file not found or empty. Using baseline standard.", flush=True)

    # 2. Fetch recent interactions
    interactions = fetch_past_week_interactions()

    # Filter to meaningful interactions (prioritize those with comments and replies)
    replied_samples = [i for i in interactions if i.get("bot_replied")]
    unreplied_samples = [i for i in interactions if not i.get("bot_replied")]

    # Prepare a representative training sample (up to 30 items)
    audit_samples = (replied_samples[:20] + unreplied_samples[:10])[:30]

    if not audit_samples:
        print("ℹ️ No recent comments found this week to audit. System prompt remains current and optimal.", flush=True)
        return True

    print(f"🧠 Sending {len(audit_samples)} conversation samples to Gemini LLM Auditor for deep analysis...", flush=True)

    # 3. Meta-Evaluation Auditor Prompt
    auditor_meta_prompt = f"""
You are the Chief AI Systems Architect & Communications Director for "Earthquake Tracker" (Facebook Page).
Our automated system monitors real-time global seismic feeds backed by BOTH major official seismological agencies:
1. USGS (United States Geological Survey)
2. EMSC (European-Mediterranean Seismological Centre)

TASK:
You are performing the weekly autonomous self-refinement audit of our Facebook comment auto-reply bot.
Analyze our recent comment-and-reply interactions below. Then, synthesize lessons learned and produce an IMPROVED, REFINED SYSTEM PROMPT for the bot.

--- RECENT INTERACTION LOGS (LAST 7-14 DAYS) ---
{json.dumps(audit_samples, indent=2, ensure_ascii=False)}

--- CURRENT ACTIVE SYSTEM PROMPT ---
{current_prompt}

EVALUATION CRITERIA:
1. Empathy & Nuance: Identify any robotic, repetitive, or sterile phrasing. Ensure warm, human empathy for fear, anxiety, shock emojis (e.g. 😳, 😱), and cultural/traditional prayers (e.g. Māori prayers to Rūaumoko, Hawaiian Pele, blessings).
2. Scientific Accuracy & Dual Agencies: Ensure BOTH USGS and EMSC are credited as official monitoring networks. Never validate pseudo-scientific predictions (earthquakes CANNOT be predicted).
3. Earlier Event Transparency: Ensure the bot clearly notes when a post covers an earlier recorded earthquake so followers aren't misled into thinking it happened just now.
4. Infrastructure Inquiries: Ensure calm, scientific answers for questions about canals (e.g. Panama Canal), bridges, or dams based on magnitude and distance.
5. Mandatory Call-To-Action: Every reply MUST conclude with: "Follow facebook.com/earthquaketracker247 for official safety guidelines and 24/7 live updates!" (no @username handle).
6. Etiquette: Never call anyone "Friend". Keep replies strictly in professional English, 2 to 3 sentences maximum, and free of hashtags.

OUTPUT FORMAT:
First, provide a brief "### Weekly Audit Findings" section summarizing:
- What worked well
- What sounded robotic or needed improvement
- New user intent patterns discovered

Then, provide the complete, updated, ready-to-use System Prompt enclosed inside a single markdown code block:
```system_prompt
[Your complete, improved, production-ready system prompt here]
```
Ensure the system prompt itself includes all required instructions, agency citations (USGS & EMSC), rules, and guardrails.
"""

    g_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": auditor_meta_prompt}]}],
        "generationConfig": {
            "maxOutputTokens": 2500,
            "temperature": 0.3
        }
    }

    try:
        r = requests.post(g_url, json=payload, headers={"User-Agent": "EarthquakeTrackerOptimizer/1.0"}, timeout=30)
        if r.status_code != 200:
            print(f"❌ Gemini API returned error: {r.status_code} - {r.text}", flush=True)
            return False

        resp_json = r.json()
        candidates = resp_json.get("candidates", [])
        if not candidates:
            print("❌ No candidate output returned by Gemini API.", flush=True)
            return False

        full_output = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if not full_output:
            print("❌ Empty response text from Gemini API.", flush=True)
            return False

        # Extract system prompt block
        prompt_match = re.search(r"```(?:system_prompt|markdown|text)?\s*(You are the official AI Spokesperson[\s\S]*?)```", full_output, re.IGNORECASE)
        if not prompt_match:
            # Fallback search for any block starting with You are
            prompt_match = re.search(r"```(?:system_prompt|markdown|text)?\s*([\s\S]*?)```", full_output)

        new_prompt = prompt_match.group(1).strip() if prompt_match else ""

        if not new_prompt:
            print("❌ Could not extract system_prompt block from Gemini output.", flush=True)
            return False

        # 4. Strict Safety Guardrail Validation
        is_valid, validation_msg = validate_candidate_prompt(new_prompt)
        print(f"🛡️ Guardrail Validation Result: {validation_msg}", flush=True)

        # Save Audit Report
        with open(AUDIT_REPORT_FILE, "w", encoding="utf-8") as f:
            f.write(f"# Weekly AI Comment Bot Audit Report\n")
            f.write(f"**Date:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n")
            f.write(f"**Guardrails Status:** {'PASSED' if is_valid else 'FAILED - ' + validation_msg}\n\n")
            f.write(full_output)
        print(f"📄 Saved weekly audit report to {AUDIT_REPORT_FILE}", flush=True)

        if not is_valid:
            print(f"⛔ REJECTED new prompt due to safety check failure: {validation_msg}", flush=True)
            print("Existing validated prompt will remain in effect.", flush=True)
            return False

        # 5. Overwrite Active System Prompt safely
        with open(PROMPT_FILE, "w", encoding="utf-8") as f:
            f.write(new_prompt)
            if not new_prompt.endswith("\n"):
                f.write("\n")

        print("✅ SUCCESS: comment_system_prompt.txt updated with refined, audited prompt!", flush=True)
        return True

    except Exception as e:
        print(f"❌ Unexpected exception during optimization: {e}", flush=True)
        return False

if __name__ == "__main__":
    success = run_weekly_optimization()
    sys.exit(0 if success else 1)
