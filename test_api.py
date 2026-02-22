import requests

# Deployed backend base URL
BASE_URL = 'https://dynamic-ticket-pricing.onrender.com'

# Step 1: Log in and get token
login_data = {"email": "admin@cf.com", "password": "admin123"}
response = requests.post(f'{BASE_URL}/api/auth/signin', json=login_data)
token = response.json().get('token')

if not token:
    print("Login failed. Response:", response.text)
    exit(1)

headers = {'Authorization': f'Bearer {token}'}

# Step 2: Test admin fraud analytics endpoint
r2 = requests.get(f'{BASE_URL}/api/admin/fraud-analytics', headers=headers)
print("Fraud Analytics Response:", r2.status_code, r2.text)

# Step 3: Test admin events endpoint
r3 = requests.get(f'{BASE_URL}/api/admin/events', headers=headers)
print("Admin Events Response:", r3.status_code, r3.text)

# Step 4: Test analytics endpoint (public)
r4 = requests.get(f'{BASE_URL}/api/analytics')
print("Analytics Response:", r4.status_code, r4.text)

# Step 5: Test all events endpoint (public)
r5 = requests.get(f'{BASE_URL}/api/events')
print("Events Response:", r5.status_code, r5.text)
