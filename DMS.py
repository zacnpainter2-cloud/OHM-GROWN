import csv
import json
import threading
import time
import socket
from datetime import datetime
from pathlib import Path

# ==========================================================
# Initial User Settings
# ==========================================================


CSV_FILE = Path("/home/frank/Documents/sensor_database.csv")
CSV_FILE.parent.mkdir(parents=True, exist_ok=True)
INTERVAL_SEC = 60   # user-settable logging interval

# Initial limits
limits = {
    "ph_min": 6.9,
    "ph_max": 7.1,
    "ec_min": 0.9,
    "ec_max": 1.1,
}

limits_lock = threading.Lock()

# Transpiration counter
transpiration_count = 0
transpiration_lock = threading.Lock()

# Global UDP Configuration
UDP_HOST = "0.0.0.0"
UDP_PORT = 5001

#Initialize Sensors
sensor_state = {
    "ph": 7.0,
    "ec": 1.0,
    "water_level": 75.0,
    "circulation": True,
    "ph_pump": False,
    "ec_pump": False,
    "transpiration": 0,
}

sensor_lock = threading.Lock()

# ==========================================================
# GPIO
# ==========================================================

def read_ph():
    with sensor_lock:
        return sensor_state["ph"]

def read_ec():
    with sensor_lock:
        return sensor_state["ec"]

def read_water_level():
    with sensor_lock:
        return sensor_state["water_level"]

def read_circulation():
    with sensor_lock:
        return sensor_state["circulation"]

def read_ph_pump_status():
    with sensor_lock:
        return sensor_state["ph_pump"]

def read_ec_pump_status():
    with sensor_lock:
        return sensor_state["ec_pump"]


# ==========================================================
# LoRaWAN interface
# ==========================================================

def lora_send(payload: dict):
    print("[LoRa OUT]", json.dumps(payload))

def lora_receive():
    """
    Blocking receive simulation.
    Replace with serial read / socket read.
    """
    time.sleep(30)
    return {
        "ph_min": 6.8,
        "ph_max": 7.2,
        "ec_min": 0.95,
        "ec_max": 1.2,
    }

# ==========================================================
# UDP Listener
# ==========================================================

def udp_listener_loop():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((UDP_HOST, UDP_PORT))

    print(f"[UDP] Listening on {UDP_HOST}:{UDP_PORT}")

    while True:
        data, addr = sock.recvfrom(2048)

        try:
            msg = json.loads(data.decode())
        except json.JSONDecodeError:
            print("[UDP] Invalid JSON from", addr)
            continue

        msg_type = msg.get("type")
        value = msg.get("value")

        if msg_type is None:
            continue

        # ----------------------------
        # Sensor values
        # ----------------------------
        with sensor_lock:
            if msg_type in sensor_state:
                sensor_state[msg_type] = value
                print(f"[UDP] {msg_type} = {value}")

        # ----------------------------
        # Limit updates
        # ----------------------------
        with limits_lock:
            if msg_type in limits:
                limits[msg_type] = float(value)
                print(f"[UDP] LIMIT {msg_type} = {limits[msg_type]}")

        # ----------------------------
        # Transpiration count
        # ----------------------------
        if msg_type == "transpiration":
            with sensor_lock:
                sensor_state["transpiration"] = int(value)



# ==========================================================
# CSV initialization
# ==========================================================

def init_csv():
    if not CSV_FILE.exists():
        with open(CSV_FILE, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Date", "time", "pH", "EC", "circulation",
                "pH pump", "EC pump", "transpiration",
                "pH min", "pH max", "EC min", "EC max"
            ])

# ==========================================================
# Sampling / logging loop
# ==========================================================

def sampling_loop():
    global transpiration_count

    print("[SAMPLER] Writing CSV row")

    init_csv()

    while True:
        start_time = time.time()
        now = datetime.now()

        ph = read_ph()
        ec = read_ec()
        circulation = read_circulation()

        with limits_lock:
            ph_min = limits["ph_min"]
            ph_max = limits["ph_max"]
            ec_min = limits["ec_min"]
            ec_max = limits["ec_max"]

        # Control logic
        ph_pump_on = ph < ph_min
        ec_pump_on = ec < ec_min

        def set_ph_pump(on: bool):
            with sensor_lock:
                sensor_state["ph_pump"] = on
            print(f"[ACTUATOR] pH pump {'ON' if on else 'OFF'}")

        def set_ec_pump(on: bool):
            with sensor_lock:
                sensor_state["ec_pump"] = on
            print(f"[ACTUATOR] EC pump {'ON' if on else 'OFF'}")    

        # Get transpiration count for this interval
        with sensor_lock:
            interval_transpiration = sensor_state["transpiration"]
            sensor_state["transpiration"] = 0


        # Log to CSV
        with open(CSV_FILE, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                now.date().isoformat(),
                now.time().strftime("%H:%M:%S"),
                ph,
                ec,
                circulation,
                ph_pump_on,
                ec_pump_on,
                interval_transpiration,
                ph_min,
                ph_max,
                ec_min,
                ec_max
            ])

        # Send LoRa JSON
        lora_send({
            "timestamp": now.isoformat(),
            "ph": ph,
            "ec": ec,
            "circulation": circulation,
            "ph_pump": ph_pump_on,
            "ec_pump": ec_pump_on,
            "transpiration": interval_transpiration,
            "limits": {
                "ph_min": ph_min,
                "ph_max": ph_max,
                "ec_min": ec_min,
                "ec_max": ec_max
            }
        })

        # Maintain precise interval timing
        elapsed = time.time() - start_time
        time.sleep(max(0, INTERVAL_SEC - elapsed))

# ==========================================================
# LoRa receive loop (always listening)
# ==========================================================

def lora_listener_loop():
    while True:
        msg = lora_receive()
        if not msg:
            continue

        with limits_lock:
            for key in ("ph_min", "ph_max", "ec_min", "ec_max"):
                if key in msg:
                    limits[key] = float(msg[key])
                    print(f"[LoRa IN] {key} updated to {limits[key]}")

# ==========================================================
# Main
# ==========================================================

def main():
    sampler = threading.Thread(target=sampling_loop, daemon=True)
    lora_rx = threading.Thread(target=lora_listener_loop, daemon=True)
    udp_rx = threading.Thread(target=udp_listener_loop, daemon=True)

    sampler.start()
    lora_rx.start()
    udp_rx.start()

    print("System running. Ctrl+C to exit.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down.")


if __name__ == "__main__":
    main()
