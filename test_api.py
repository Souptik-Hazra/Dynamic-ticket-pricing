import requests

print("Testing Fraud Analytics Endpoint...")
r = requests.get('http://localhost:3001/api/admin/fraud-analytics', 
                 headers={'Authorization': 'Bearer test'})
print(f"Status: {r.status_code}")
if r.status_code == 401:
    print("✓ Endpoint is live and checking authentication (as expected)")
    print("Frontend should send valid JWT token from localStorage")
elif r.status_code == 200:
    print("✓ Fraud analytics data returned successfully")
    print(f"Response keys: {list(r.json().keys())}")
else:
    print(f"Error: {r.text[:200]}")
