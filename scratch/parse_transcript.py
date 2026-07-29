import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')

try:
    response = urllib.request.urlopen('http://localhost:3000', timeout=5)
    html = response.read().decode('utf-8')
    print("STATUS:", response.status)
    print("HTML Length:", len(html))
    print("HTML Preview:")
    print(html[:500])
except Exception as e:
    print("Error connecting to dev server:", e)
