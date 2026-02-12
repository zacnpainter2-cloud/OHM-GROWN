import csv
import json
import threading
import time
import socket
from datetime import datetime
from pathlib import Path
from bitarray import bitarray
from bitarray.util import int2ba

# ==========================================================
# Initial User Settings
# ==========================================================


CSV_FILE = Path("/home/frank/Documents/sensor_database.csv")
CSV_FILE.parent.mkdir(parents=True, exist_ok=True)
INTERVAL_SEC = 60   # user-settable logging interval

# Default limits
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
    "temperature": 26.0,
    "o2": 10.0,
    "transpiration": 0,
}

sensor_lock = threading.Lock()

# ==========================================================
# GPIO (Sort of - Receives individual Sensor values from Sensor Array Unit)
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
    
def read_temperature():
    with sensor_lock:
        return sensor_state["temperature"]
    
def read_o2():
    with sensor_lock:
        return sensor_state["o2"]

def read_ph_min():
    with limits_lock:
        return limits["ph_min"]

def read_ph_max():
    with limits_lock:
        return limits["ph_max"]

def read_ec_min():
    with limits_lock:
        return limits["ec_min"]

def read_ec_max():
    with limits_lock:
        return limits["ec_max"]


# ==========================================================
# LoRaWAN interface
# ==========================================================

def lora_send(payload: dict):
    print("[LoRa OUT]", json.dumps(payload))


def lora_receive():

    """
    Temporary placeholder until actual lora module is connected. Right now the setpoints are being simulated in the UDP section.
    ph_min = read_ph_min()
    ph_max = read_ph_max()
    ec_min = read_ec_min()
    ec_max = read_ec_max()

    """
    time.sleep(30)
    return None

    """
    This will be the return statement when the LoRa is integrated.
        {
        "ph_min": ph_min,
        "ph_max": ph_max,
        "ec_min": ec_min,
        "ec_max": ec_max,
    }
    """

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
            #    ph_min = read_ph_min()
            #    ph_max = read_ph_max()
            #    ec_min = read_ec_min()
            #    ec_max = read_ec_max()

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
                "pH pump", "EC pump", "temperature", "o2", "transpiration",
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
        temperature = read_temperature()
        o2 = read_o2()

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
                temperature,
                o2,
                interval_transpiration,
                ph_min,
                ph_max,
                ec_min,
                ec_max
            ])

        # Prepare LoRa Payload

        def clamp(value, min_val, max_val):
            return max(min_val, min(value, max_val))


        def build_lora_payload(ec, ph, temp, o2, lvl, trans, ecd, phd, flow):
            """
            Convert sensor values and pack into a bit-accurate LoRa payload.
            Final three values are sent as individual bits.
            """
            ec8 = clamp(int(round(ec * 100)), 0, 255)
            ph8 = clamp(int(round(ph * 10)), 0, 255)
            temp16 = clamp(int(round(temp * 10)), 0, 65535)
            o28 = clamp(int(round(o2 * 10)), 0, 255)
            lvl8 = clamp(int(round(lvl * 10)), 0, 255)
            trans8 = clamp(int(trans), 0, 255)

            ecd = 1 if ecd else 0
            phd = 1 if phd else 0
            flow = 1 if flow else 0

            # Build bitstream
            bits = bitarray(endian="big")
            bits += int2ba(ec8, length=8)
            bits += int2ba(ph8, length=8)
            bits += int2ba(temp16, length=16)
            bits += int2ba(o28, length=8)
            bits += int2ba(lvl8, length=8)
            bits += int2ba(trans8, length=8)
            bits.append(ecd)
            bits.append(phd)
            bits.append(flow)

            # Pad remaining 5 bits
            bits += bitarray("00000")

            return bits.tobytes()

        # Send LoRa JSON

        payload_bytes = build_lora_payload(
            ec=ec,
            ph=ph,
            temp=temperature,
            o2=o2,
            lvl=read_water_level(),
            trans=interval_transpiration,
            ecd=ec_pump_on,
            phd=ph_pump_on,
            flow=circulation
        )

        # Convert bytes to list of uint8 for JSON serialization (old)
        #payload_uint8 = list(payload_bytes)
        #payload_compact = "".join(str(b) for b in payload_uint8)

        #lora_send({
        #    "payload": payload_compact
        #})

        # Convert payload bytes to hex string
        payload_hex = payload_bytes.hex()

        lora_send({
            "payload_hex": payload_hex
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
