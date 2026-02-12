import json
import random
import socket
import time
from datetime import datetime

# ==========================================================
# Tester Configuration
# ==========================================================

DB_HOST = "127.0.0.1"
DB_PORT = 5001          # Database app listens here
INTERVAL_SEC = 60       # MUST match database app interval

# Initial limits (will be updated every 3rd interval)
ph_min = 6.9
ph_max = 7.1
ec_min = 0.9
ec_max = 1.1

# ==========================================================
# UDP Sender
# ==========================================================

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

def send_json(payload: dict):
    msg = json.dumps(payload).encode("utf-8")
    sock.sendto(msg, (DB_HOST, DB_PORT))
    print("[SEND]", json.dumps(payload))

# ==========================================================
# Main Test Loop
# ==========================================================

def main():
    global ph_min, ph_max, ec_min, ec_max

    interval_count = 0

    print("DMS Tester running. Ctrl+C to stop.")

    try:
        while True:
            start_time = time.time()
            interval_count += 1
            now = datetime.now().isoformat()

            # ----------------------------------------------
            # Generate random sensor values
            # ----------------------------------------------

            ph = round(random.uniform(6.5, 7.2), 2)
            ec = round(random.uniform(0.6, 1.2), 2)
            water_level = round(random.uniform(5.5, 7.0), 2)
            circulation = random.choice([True, False])
            temperature = round(random.uniform(90.0, 101.0), 2)
            o2 = round(random.uniform(5.0, 8.0), 2)

            ph_pump = ph < ph_min
            ec_pump = ec < ec_min

            transpiration = random.randint(0, 20)

            # ----------------------------------------------
            # Send sensor values (independently)
            # ----------------------------------------------

            send_json({"type": "ph", "timestamp": now, "value": ph})
            send_json({"type": "ec", "timestamp": now, "value": ec})
            send_json({"type": "water_level", "timestamp": now, "value": water_level})
            send_json({"type": "circulation", "timestamp": now, "value": circulation})
            send_json({"type": "temperature", "timestamp": now, "value": temperature})
            send_json({"type": "o2", "timestamp": now, "value": o2})
            send_json({"type": "ph_pump", "timestamp": now, "value": ph_pump})
            send_json({"type": "ec_pump", "timestamp": now, "value": ec_pump})
            send_json({"type": "transpiration", "timestamp": now, "value": transpiration})

            # ----------------------------------------------
            # Every 3rd interval: generate & send new limits
            # ----------------------------------------------

            if interval_count % 3 == 0:
                ph_min = round(random.uniform(6.6, 7.0), 2)
                ph_max = round(random.uniform(7.1, 7.3), 2)
                ec_min = round(random.uniform(0.7, 0.9), 2)
                ec_max = round(random.uniform(1.1, 1.3), 2)

                send_json({"type": "ph_min", "timestamp": now, "value": ph_min})
                send_json({"type": "ph_max", "timestamp": now, "value": ph_max})
                send_json({"type": "ec_min", "timestamp": now, "value": ec_min})
                send_json({"type": "ec_max", "timestamp": now, "value": ec_max})

            # ----------------------------------------------
            # Maintain interval timing
            # ----------------------------------------------

            elapsed = time.time() - start_time
            time.sleep(max(0, INTERVAL_SEC - elapsed))

    except KeyboardInterrupt:
        print("\nDMS Tester stopped.")

if __name__ == "__main__":
    main()
