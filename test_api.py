import requests

# Step 1: Log in and get token
login_data = {"email": "admin@cf.com", "password": "admin123"}
response = requests.post('http://localhost:3001/api/auth/signin', json=login_data)
token = response.json().get('token')

if not token:
    print("Login failed. Response:", response.text)
    exit(1)

headers = {'Authorization': f'Bearer {token}'}

# Step 2: Test admin fraud analytics endpoint
r2 = requests.get('http://localhost:3001/api/admin/fraud-analytics', headers=headers)
print("Fraud Analytics Response:", r2.status_code, r2.text)

# Step 3: Test admin events endpoint
r3 = requests.get('http://localhost:3001/api/admin/events', headers=headers)
print("Admin Events Response:", r3.status_code, r3.text)

# Step 4: Test analytics endpoint (public)
r4 = requests.get('http://localhost:3001/api/analytics')
print("Analytics Response:", r4.status_code, r4.text)

# Step 5: Test all events endpoint (public)
r5 = requests.get('http://localhost:3001/api/events')
print("Events Response:", r5.status_code, r5.text)
