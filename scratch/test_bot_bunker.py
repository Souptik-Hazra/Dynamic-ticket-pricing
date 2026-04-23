import requests
import time

GATEWAY_URL = "http://localhost:4000/api"
FAKE_BOT_IP = "1.2.3.4"

def test_bot_bunker():
    print(f"[BotBunker] STARTING VALIDATION FOR IP: {FAKE_BOT_IP}")
    headers = {"X-Forwarded-For": FAKE_BOT_IP}

    # 1. Trigger infractions
    print("\n--- Phase 1: Triggering 6 Security Infractions ---")
    for i in range(6):
        # We call the infraction endpoint directly to simulate caught bot behavior
        requests.post(f"{GATEWAY_URL}/security/infraction", json={"ip": FAKE_BOT_IP}, headers=headers)
        print(f"Logged infraction {i+1}...")

    # 2. Test Soft-Ban (Slow Lane)
    print("\n--- Phase 2: Testing Slow Lane Throttling ---")
    start = time.time()
    res = requests.get(f"{GATEWAY_URL}/health", headers=headers)
    duration = time.time() - start
    print(f"Response Code: {res.status_code} | Latency: {duration:.2f}s")
    
    if duration >= 3.0:
        print("SUCCESS: Bot trapped in the 3-second Slow Lane.")
    else:
        print("FAILURE: Throttling not active.")

    # 3. Trigger Hard-Ban
    print("\n--- Phase 3: Escalating to 21 Infractions ---")
    for i in range(6, 21):
        requests.post(f"{GATEWAY_URL}/security/infraction", json={"ip": FAKE_BOT_IP}, headers=headers)
    
    # 4. Test Hard-Ban
    print("\n--- Phase 4: Testing Hard Ban ---")
    res = requests.get(f"{GATEWAY_URL}/health", headers=headers)
    print(f"Response Code: {res.status_code} | Message: {res.json().get('error', 'None')}")

    if res.status_code == 423:
        print("SUCCESS: Hard Ban active. Bot completely neutralized.")
    else:
        print("FAILURE: Hard Ban not triggered.")

if __name__ == "__main__":
    test_bot_bunker()
