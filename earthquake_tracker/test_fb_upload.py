import sys
import os
import requests

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config import FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN
from fb_publisher import upload_video_to_facebook

print(f"🔍 Testing Token for Page ID: {FB_PAGE_ID}")

# 1. Verify token against Graph API
test_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}?fields=id,name,access_token&access_token={FB_PAGE_ACCESS_TOKEN}"
res = requests.get(test_url)
print(f"Response ({res.status_code}): {res.text}")

if res.status_code == 200:
    page_data = res.json()
    print(f"🎉 Page Verified: {page_data.get('name')} (ID: {page_data.get('id')})")
    
    # Check if a dedicated Page token was returned
    page_token = page_data.get("access_token", FB_PAGE_ACCESS_TOKEN)
    
    # 2. Test publishing the latest video
    video_path = r"c:\Users\anikh\Desktop\bikroynow.com v1.0\earthquake_tracker\output\earthquake_us6000tlmt.mp4"
    if os.path.exists(video_path):
        sample_event = {
            "id": "us6000tlmt",
            "mag": 4.7,
            "place": "80 km N of Ruteng, Indonesia",
            "depth_km": 15.0,
            "latitude": -7.89,
            "longitude": 120.45,
            "time_utc": "August 18, 2026 at 10:15 UTC",
            "tsunami_alert": False
        }
        print("\n🚀 Publishing Test Video to Facebook Page...")
        # Update config token if needed
        import config
        config.FB_PAGE_ACCESS_TOKEN = page_token
        import fb_publisher
        fb_publisher.FB_PAGE_ACCESS_TOKEN = page_token
        success = upload_video_to_facebook(video_path, sample_event)
        if success:
            print("\n🌟 SUCCESS: Video is now live on your Facebook Page!")
else:
    print("❌ Token verification failed.")
