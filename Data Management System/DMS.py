# Version 1.0.0
# This is the main DMS script that runs on the Raspberry Pi. It handles:
# - Sensor polling and state management
# - LoRaWAN communication (uplink and downlink)
# - UDP listener for local updates (e.g. from a mobile app)
# - CSV logging of sensor data and limits

import sys
if __name__ == "__main__":
    sys.modules["DMS"] = sys.modules["__main__"]

from gpiozero import LED, Button
import csv
import json
import threading
import time
import socket
import queue
from datetime import datetime
from pathlib import Path
#from bitarray import bitarray
#from bitarray.util import int2ba
import sensors
import LoRa_run
import os
import calibration

# ==========================================================
# Initialization
# ==========================================================

#Initializing I2C bus
try:
    from smbus2 import SMBus
except ImportError:
    from smbus import SMBus
    
I2C_BUS = 1


#Initializing LoRa Downlink Queue
downlink_queue = queue.Queue()
LoRa_run.set_downlink_queue(downlink_queue)


CSV_FILE = Path("/home/ohm/Documents/sensor_database.csv")
CSV_FILE.parent.mkdir(parents=True, exist_ok=True)
INTERVAL_SEC = 300   # user-settable logging interval


# Initial Default limits
limits = {
    "ph_min": 0,
    "ph_max": 7.0,
    "ec_min": 0,
    "ec_max": 660,
    "ec_set": 600,
    "ph_set": 6.8
}

def _load_limits_from_csv():
    """Restore limits from the last row of the CSV if it exists."""
    if not CSV_FILE.exists():
        print("[DMS] No CSV found — using default limits.")
        return
    try:
        with open(CSV_FILE, "r") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            if header is None:
                return
            last_row = None
            for row in reader:
                last_row = row
            if last_row is None:
                print("[DMS] CSV has header only — using default limits.")
                return
            # CSV columns: Date(0) Time(1) pH(2) ec(3) Circulation(4)
            #   pH_pump(5) EC_pump(6) Temperature(7) Water_Level(8)
            #   pH_min(9) pH_max(10) EC_min(11) EC_max(12) EC_set(13) pH_set(14)
            limits["ph_min"] = float(last_row[9])
            limits["ph_max"] = float(last_row[10])
            limits["ec_min"] = float(last_row[11])
            limits["ec_max"] = float(last_row[12])
            limits["ec_set"] = float(last_row[13])
            limits["ph_set"] = float(last_row[14])
            print(f"[DMS] Limits restored from CSV: {limits}")
    except Exception as e:
        print(f"[DMS] Could not load limits from CSV: {e} — using defaults.")

_load_limits_from_csv()

limits_lock = threading.Lock()

# Transpiration counter
transpiration_count = 0
transpiration_lock = threading.Lock()

# Global UDP Configuration
UDP_HOST = "0.0.0.0"
UDP_PORT = 5001

#Initialize Sensors
# (flow pin init moved into main() — GPIO may not be ready at import time)

sensor_state = {
    "ph": 0.1,
    "ec": 0.1,
    "water_level": 0,
    "circulation": False,
    "ph_pump": False,
    "ec_pump": False,
    "temperature": 0.0,
    "o2": 0.0,
    "transpiration": 0,
}

sensor_lock = threading.Lock()

#Backlight Control
def backlight_off():
    os.system("pinctrl set 18 op dl")
    
#Calibration

ENTRY_HOLD_SECONDS = 3.0

BTN_BACK = calibration.BTN_BACK
BTN_UP   = calibration.BTN_UP

pause_event = threading.Event()
pause_event.set()

shutdown_event = threading.Event()
calibration_lock = threading.Lock()


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
        
def read_ec_set():
    with limits_lock:
        return limits["ec_set"]
        
def read_ph_set():
    with limits_lock:
        return limits["ph_set"]

def set_ec_pump(active: bool):
    with sensor_lock:
        sensor_state["ec_pump"] = active

def set_ph_pump(active: bool):
    with sensor_lock:
        sensor_state["ph_pump"] = active

def sensor_polling_loop():
    print("[SENSORS] Polling started")

    while True:
        pause_event.wait()   # blocks here while calibration is active

        try:
            with SMBus(sensors.I2C_BUS) as bus:
                data = sensors.read_all_sensors(bus)

            with sensor_lock:
                sensor_state["ph"] = data["ph"]
                sensor_state["ec"] = data["ec"]
                sensor_state["temperature"] = data["temperature"]
                sensor_state["water_level"] = data["water_level"]
                sensor_state["circulation"] = data["circulation"]
                sensor_state["o2"] = data["o2"]

            print_data = data.copy()
            print_data.pop("o2", None)
            print("[SENSORS]", print_data)

        except Exception as e:
            print("[SENSORS ERROR]", e)

        # Wait ~2 s between polls, but allow calibration to interrupt the wait
        end_wait = time.time() + 2
        while time.time() < end_wait:
            if not pause_event.is_set():
                break
            time.sleep(0.1)
            
# ==========================================================
# LoRaWAN interface
# ==========================================================

def lora_send(payload_hex):
    LoRa_run.send_uplink(payload_hex)
    print("[LoRa TX]", payload_hex)


# ==========================================================
# CSV initialization
# ==========================================================

def init_csv():
    if not CSV_FILE.exists():
        with open(CSV_FILE, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Date", "Time", "pH", "ec", "Circulation",
                "pH pump", "EC pump", "Temperature", "Water Level",
                "pH min", "pH max", "EC min", "EC max", "EC Setpoint", "pH Setpoint"
            ])

# ==========================================================
# Calibration Function
# ==========================================================
def calibration_monitor_loop():
    start = None

    while True:
        if BTN_BACK.is_pressed and BTN_UP.is_pressed:
            if start is None:
                start = time.monotonic()

            if time.monotonic() - start >= ENTRY_HOLD_SECONDS:
                trigger_calibration()
                start = None

                # wait for release so it does not immediately retrigger
                while BTN_BACK.is_pressed or BTN_UP.is_pressed:
                    time.sleep(0.05)
        else:
            start = None

        time.sleep(0.05)
        
        
def trigger_calibration():


    if not calibration_lock.acquire(blocking=False):
        return  # already calibrating

    try:
        print("[DMS] Pausing system for calibration...")
        pause_event.clear()

        # give active loops a moment to stop touching hardware
        time.sleep(0.5)

        calibration.launch_calibration_ui()

        print("[DMS] Calibration finished. Resuming system...")
    except Exception as e:
        print(f"[DMS] Calibration error: {e}")
    finally:
        pause_event.set()
        calibration_lock.release()
        
# ==========================================================
# Sampling / logging loop
# ==========================================================

def clamp(value, min_val, max_val):
    return max(min_val, min(value, max_val))


def build_lora_payload(ec, ph, temperature, o2, water_level,
                       transpiration_count, ec_pump, ph_pump, circ_pump):

    # Scale values to integer
    ec16   = clamp(int(round(ec)), 0, 65535)
    ph8    = clamp(int(round(ph * 10)), 0, 255)
    temp16 = clamp(int(round(temperature * 10)), 0, 65535)
    o216   = clamp(int(round(o2 * 10)), 0, 65535)
    lvl8   = clamp(int(round(water_level)), 0, 255)
    trans8 = clamp(int(transpiration_count), 0, 255)

    ecd  = 1 if ec_pump else 0
    phd  = 1 if ph_pump else 0
    flow = 1 if circ_pump else 0

    bitstream = ""
    bitstream += format(ec16,   "016b")
    bitstream += format(ph8,    "08b")
    bitstream += format(temp16, "016b")
    bitstream += format(o216,   "016b")
    bitstream += format(lvl8,   "08b")
    bitstream += format(trans8, "08b")

    bitstream += str(ecd)
    bitstream += str(phd)
    bitstream += str(flow)

    # Pad to full byte
    padding = (8 - len(bitstream) % 8) % 8
    bitstream += "0" * padding

    payload_bytes = int(bitstream, 2).to_bytes(len(bitstream) // 8, byteorder='big')
    payload_hex = payload_bytes.hex().upper()

    return bitstream, payload_hex


def sampling_loop():
    global transpiration_count

    print("[SAMPLER] Writing CSV row")
    init_csv()

    while True:
        pause_event.wait()   # block here while calibration is active

        start_time = time.time()
        now = datetime.now()

        ph = read_ph()
        ec = read_ec()
        circulation = read_circulation()
        temperature = read_temperature()
        water_level = read_water_level()
        o2 = read_o2()

        ph_min = read_ph_min()
        ph_max = read_ph_max()
        ec_min = read_ec_min()
        ec_max = read_ec_max()
        ec_set = read_ec_set()
        ph_set = read_ph_set()

        # Read actual DCU pump state (set by DCU.control_loop)
        ph_pump_on = read_ph_pump_status()
        ec_pump_on = read_ec_pump_status()

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
                water_level,
                ph_min,
                ph_max,
                ec_min,
                ec_max,
                ec_set,
                ph_set
            ])

        # -------- BUILD LORA PAYLOAD (KEEP THIS EXACTLY HERE) --------
        bitstream, payload_hex = build_lora_payload(
            ec=ec,
            ph=ph,
            temperature=temperature,
            o2=o2,
            water_level=water_level,
            transpiration_count=interval_transpiration,
            ec_pump=ec_pump_on,
            ph_pump=ph_pump_on,
            circ_pump=circulation
        )

        

        lora_send(payload_hex)

        # Maintain precise interval timing, but allow pause to interrupt sleep
        elapsed = time.time() - start_time
        remaining = max(0, INTERVAL_SEC - elapsed)

        end_sleep = time.time() + remaining
        while time.time() < end_sleep:
            if not pause_event.is_set():
                break
            time.sleep(0.1)
# ==========================================================
# LoRa receive loop (always listening)
# ==========================================================

def lora_listener_loop():
    print("[LoRa Rx] Downlink listener started — waiting for messages.")
    while True:
        pause_event.wait()

        try:
            hex_data = downlink_queue.get(timeout=0.5)
        except queue.Empty:
            continue

        if not pause_event.is_set():
            continue

        try:
            print(f"[LoRa Rx] Raw hex received: {hex_data}")

            raw = bytes.fromhex(hex_data)

            # Downlink format (9 bytes, big-endian):
            #   [ec_max:2][ec_min:2][ec_set:2][ph_max:1][ph_min:1][ph_set:1]
            #   pH bytes are value * 10 (e.g. 70 = 7.0)
            if len(raw) < 9:
                print(f"[LoRa Rx] Downlink too short ({len(raw)} bytes), skipping.")
                continue

            decoded = {
                "ec_max": int.from_bytes(raw[0:2], "big"),
                "ec_min": int.from_bytes(raw[2:4], "big"),
                "ec_set": int.from_bytes(raw[4:6], "big"),
                "ph_max": int.from_bytes(raw[6:7], "big") / 10,
                "ph_min": int.from_bytes(raw[7:8], "big") / 10,
                "ph_set": int.from_bytes(raw[8:9], "big") / 10,
            }

            updated = []
            with limits_lock:
                for key, val in decoded.items():
                    limits[key] = float(val)
                    updated.append(f"{key}={val}")

            print(f"[LoRa Rx] Limits updated: {', '.join(updated)}")

        except ValueError as e:
            print(f"[LoRa Rx] Could not decode hex '{hex_data}': {e}")
        except Exception as e:
            print(f"[LoRa Rx ERROR] Unexpected error: {e}")

# ==========================================================
# Main
# ==========================================================

def main():
    import DCU  # imported here to avoid circular import (DCU imports DMS)

    # Init GPIO — retry if pin isn't reeased yet at boot
    for attempt in range(5):
        try:
            sensors.init_flow_pin()
            break
        except Exception as e:
            print(f"[DMS] GPIO init attempt {attempt+1}/5 failed: {e}")
            time.sleep(2)

    # turning off backlight
    backlight_off()

    sensors_thread = threading.Thread(target=sensor_polling_loop,        daemon=True)
    sampler        = threading.Thread(target=sampling_loop,              daemon=True)
    lora_serial_rx = threading.Thread(target=LoRa_run.downlink_listener, daemon=True)
    lora_rx        = threading.Thread(target=lora_listener_loop,         daemon=True)
    lora_join      = threading.Thread(target=LoRa_run.lorawan_init,      daemon=True)
    dcu = threading.Thread(target=DCU.control_loop, args=(pause_event,), daemon=True)
    cal_monitor = threading.Thread(target=calibration_monitor_loop, daemon=True)
    
    
    
    cal_monitor.start()
    sensors_thread.start()
    sampler.start()
    lora_rx.start()
    lora_join.start()       # opens serial port — must start before downlink listener
    time.sleep(3)           # allow serial port to open before listener reads it
    lora_serial_rx.start()
    dcu.start()

    print("System running. Ctrl+C to exit.")
    

    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Shutting down.")


if __name__ == "__main__":
    main()
