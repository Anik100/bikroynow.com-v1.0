import sys
import os
import requests

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

from config import FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN
from fb_publisher import upload_video_to_facebook

print(f"🔍 Testing Token for Page ID: {FB_PAGE_ID}")

# 1. Verify Page Info
test_url = f"https://graph.facebook.com/v20.0/{FB_PAGE_ID}?fields=id,name&access_token={FB_PAGE_ACCESS_TOKEN}"
res = requests.get(test_url)
print(f"Page Verification ({res.status_code}): {res.text}")

if res.status_code == 200:
    page_data = res.json()
    print(f"🎉 Page Verified: {page_data.get('name')} (ID: {page_data.get('id')})")
    
    # 2. Test publishing the latest cinematic video
    video_path = r"c:\Users\anikh\Desktop\bikroynow.com v1.0\earthquake_tracker\output\earthquake_us6000tlmt.mp4"
    if not os.path.exists(video_path):
        video_path = r"c:\Users\anikh\Desktop\bikroynow.com v1.0\earthquake_tracker\output\earthquake_us6000tlm6.mp4"
        
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
        print(f"\n🚀 Publishing Test Video ({os.path.basename(video_path)}) to Facebook Page...")
        success = upload_video_to_facebook(video_path, sample_event)
        if success:
            print("\n🌟 SUCCESS: Video is now live on your Facebook Page!")
    else:
        print("❌ Video file not found to upload.")
else:
    print("❌ Token verification failed.")
