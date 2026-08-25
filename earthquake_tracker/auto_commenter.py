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

AUTO_REPLY_MESSAGE = (
    "Thank you for connecting with us! We truly appreciate your support and valuable ground updates. "
    "Stay alert, stay safe, and follow @earthquaketracker247 for 24/7 instant real-time alerts worldwide. 🌍🔔"
)

def process_comment_auto_replies():
    """
    Scans recent Facebook videos & photos for new comments.
    Sends the official auto-reply ONLY ONCE per user (if a user comments multiple times,
    they will never be spammed with duplicate replies).
    """
    if not FB_PAGE_ACCESS_TOKEN or not FB_PAGE_ID:
        return

    print(" 💬 Checking for new Facebook comments to auto-reply...")

    with history_lock:
        history = load_history()
        replied_users = set(history.get("replied_user_ids", []))
        replied_comments = set(history.get("replied_comment_ids", []))

    history_changed = False
    media_ids = []
    headers = {"User-Agent": "EarthquakeTrackerBot/1.0"}

    # 1. Fetch recent videos
    try:
        v_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/videos?fields=id&limit=8&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_v = requests.get(v_url, headers=headers, timeout=10)
        if r_v.status_code == 200:
            for item in r_v.json().get("data", []):
                media_ids.append(item["id"])
    except Exception as e:
        print(f"⚠ Note fetching video list: {e}")

    # 2. Fetch recent photos
    try:
        p_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}/photos?type=uploaded&fields=id&limit=8&access_token={FB_PAGE_ACCESS_TOKEN}"
        r_p = requests.get(p_url, headers=headers, timeout=10)
        if r_p.status_code == 200:
            for item in r_p.json().get("data", []):
                media_ids.append(item["id"])
    except Exception as e:
        print(f"⚠️ Note fetching photo list: {e}")

    new_replies_count = 0
    for media_id in media_ids:
        try:
            c_url = f"https://graph.facebook.com/v20.0/{media_id}/comments?fields=id,from,message,created_time&limit=20&access_token={FB_PAGE_ACCESS_TOKEN}"
            res = requests.get(c_url, headers=headers, timeout=10)
            if res.status_code != 200:
                continue

            comments = res.json().get("data", [])
            for c in comments:
                comment_id = str(c.get("id"))
                from_user = c.get("from", {})
                user_id = str(from_user.get("id", ""))
                user_name = from_user.get("name", "User")

                # Skip if already replied to this comment
                if comment_id in replied_comments:
                    continue

                # Skip comments made by our own page
                if user_id == str(FB_PAGE_ID):
                    continue

                # Skip if this user has ALREADY received an auto-reply previously
                if user_id and user_id in replied_users:
                    replied_comments.add(comment_id)
                    history_changed = True
                    continue

                # Send Auto Reply to this new commenter
                reply_url = f"https://graph.facebook.com/v20.0/{comment_id}/comments"
                payload = {
                    "message": AUTO_REPLY_MESSAGE,
                    "access_token": FB_PAGE_ACCESS_TOKEN
                }
                r_post = requests.post(reply_url, data=payload, headers=headers, timeout=12)
                if r_post.status_code == 200:
                    print(f"✅ Auto-replied to [{user_name}] on comment ({comment_id})")
                    if user_id:
                        replied_users.add(user_id)
                    replied_comments.add(comment_id)
                    history_changed = True
                    new_replies_count += 1
                else:
                    print(f"⚀ Comment reply API response: {r_post.text}")

        except Exception as err:
            print(f"⚀ Error checking comments for media {media_id}: {err}")

    if history_changed:
        with history_lock:
            history = load_history()
            history["replied_user_ids"] = list(replied_users)[-2000:]
            history["replied_comment_ids"] = list(replied_comments)[-2000:]
            save_history(history)

    print(f"✨ Auto-comment check complete ({new_replies_count} new replies sent).")

if __name__ == "__main__":
    process_comment_auto_replies()
