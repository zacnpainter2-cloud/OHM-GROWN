# LoRa_run.py — LoRaWAN Service Entry Point
# Version 1.0.0
# Bennett Bucher | ELEC 421 Design
# ─────────────────────────────────────────────────────────────────────
# Responsibilities:
#   1. On startup, configure the RAK3272 and join the LoRaWAN network (OTAA).
#   2. Every 5 minutes, pull the latest encoded payload from DMS and send
#      a confirmed uplink.
#   3. Continuously monitor the serial port for downlink events and forward
#      decoded payloads to DMS via downlink_queue.
#   4. Verify network status before every uplink and rejoin if needed.
#      An uplink_busy flag pauses the downlink listener during transmission
#      to prevent RX/TX collisions on the shared serial port.
# ─────────────────────────────────────────────────────────────────────

import json
import threading
import time
import serial

# ─────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────

SERIAL_PORT     = "/dev/ttyAMA0"                # UART0 on Raspberry Pi
BAUD_RATE       = 115200
DEVEUI          = "70B3D57ED007545D"
APPEUI          = "0000000000000000"
APPKEY          = "B2579CA4A849B71844D759B0E8DF5D9D"
UPLINK_PORT     = 2                             # LoRaWAN FPort for uplinks
UPLINK_INTERVAL = 60                           # Seconds between uplinks (1 min)
JOIN_POLL_DELAY = 10                            # Seconds between join-status polls
JOIN_POLL_MAX   = 12                            # Max polls per join attempt (~2 min window)
STARTUP_DELAY   = 10                             # Seconds to let DMS threads settle



#Initializing Queue
downlink_queue_ref = None

def set_downlink_queue(q):
    global downlink_queue_ref
    downlink_queue_ref = q


# ─────────────────────────────────────────────────────────────────────
# Serial port and concurrency primitives
# ─────────────────────────────────────────────────────────────────────

ser          = None
serial_lock  = threading.Lock()
uplink_busy  = threading.Event()    # Set during TX; pauses the downlink listener


def _open_serial():
    """Open the serial port with retries. Blocks until the port is available.
    Called once from lorawan_init() so the port is never opened at import time.
    """
    global ser
    while True:
        try:
            ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
            print(f"[LoRa] Serial port {SERIAL_PORT} opened.")
            return
        except serial.SerialException as e:
            print(f"[LoRa] Serial port not ready ({e}) — retrying in 5s...")
            time.sleep(5)

# ─────────────────────────────────────────────────────────────────────
# Serial helpers
# ─────────────────────────────────────────────────────────────────────

def _parse_lines(raw):
    """Return non-empty, stripped lines from a raw serial response."""
    return [line.strip() for line in raw.replace("\r", "").split("\n") if line.strip()]


def send_at(command, delay=1.0):
    """Write an AT command, wait `delay` seconds, and return parsed response lines.

    Any downlink events present in the response are forwarded to DMS
    before this function returns.
    """
    if ser is None:
        print(f"[LoRa] Serial not ready — cannot send: {command}")
        return []
    with serial_lock:
        ser.write((command + "\r\n").encode())
        time.sleep(delay)
        raw = ser.read(ser.in_waiting).decode(errors="ignore")
    lines = _parse_lines(raw)
    for line in lines:
        _handle_downlink_line(line)
    return lines

# ─────────────────────────────────────────────────────────────────────
# Network join
# ─────────────────────────────────────────────────────────────────────

def _is_joined():
    """Return True if the RAK3272 reports an active network session."""
    lines = send_at("AT+NJS=?")
    return any(line.strip() == "AT+NJS=1" for line in lines)


def lorawan_init():
    """Open the serial port, configure the RAK3272 and join via OTAA.

    Writes all required parameters on first call, then starts the join
    procedure. Blocks and retries until the join succeeds. Exits
    immediately if the device is already joined.
    """
    _open_serial()
    if _is_joined():
        print("[LoRa] Already joined.")
        return

    # Write LoRaWAN parameters
    send_at("AT+NWM=1")                     # LoRaWAN network mode
    send_at("AT+CLASS=C")                   # Class C (always-on RX window)
    send_at("AT+BAND=5")                    # US915 band
    send_at("AT+NJM=1")                     # OTAA join mode
    send_at("AT+CFM=1")                     # Confirmed uplinks
    send_at("AT+ADR=1")                     # Adaptive data rate
    send_at("AT+LPM=1")                     # Low power mode
    send_at("AT+DEVEUI=" + DEVEUI)
    send_at("AT+APPEUI=" + APPEUI)
    send_at("AT+APPKEY=" + APPKEY)

    # Join loop — keeps trying until the network accepts the device
    attempt = 0
    while not _is_joined():
        attempt += 1
        print(f"[LoRa] Join attempt {attempt} — starting OTAA procedure...")
        send_at(f"AT+JOIN=1:0:{JOIN_POLL_DELAY}:{JOIN_POLL_MAX}")
        for _ in range(JOIN_POLL_MAX):
            time.sleep(JOIN_POLL_DELAY)
            if _is_joined():
                break

    print("[LoRa] Network join successful.")


def ensure_joined():
    """Verify the device is still joined; rejoin silently if the link was lost."""
    if not _is_joined():
        print("[LoRa] Connection lost — rejoining...")
        lorawan_init()

# ─────────────────────────────────────────────────────────────────────
# Downlink handling
# ─────────────────────────────────────────────────────────────────────

def _handle_downlink_line(line):
    """Extract raw hex from a downlink event and forward it to DMS."""
    if not line.startswith("+EVT:RX_"):
        return

    parts = line.split(":")
    if len(parts) < 6:
        return

    hex_data = parts[-1].strip()
    if not hex_data:
        return

    if downlink_queue_ref is not None:
        downlink_queue_ref.put(hex_data)
        print(f"[LoRa RX] Downlink forwarded: {hex_data}")
    else:
        print(f"[LoRa RX] Downlink received but no queue registered: {hex_data}")


def downlink_listener():
    """Background thread — drains the serial buffer between uplink cycles.

    Reads unsolicited RAK3272 events and forwards any downlinks to DMS.
    Pauses while uplink_busy is set so the TX/ACK window is never
    interrupted by a concurrent serial read.
    """
    while True:
        if ser is None:
            time.sleep(0.5)
            continue
        if not uplink_busy.is_set():
            with serial_lock:
                if ser.in_waiting:
                    raw = ser.read(ser.in_waiting).decode(errors="ignore")
                    for line in _parse_lines(raw):
                        _handle_downlink_line(line)
        time.sleep(0.1)

# ─────────────────────────────────────────────────────────────────────
# Uplink
# ─────────────────────────────────────────────────────────────────────


def send_uplink(payload_hex, port=UPLINK_PORT):
    """Verify the network connection and send a confirmed LoRaWAN uplink.

    Sets uplink_busy for the duration of the send so the downlink listener
    does not contend with the active TX/ACK window.
    """

    if ser is None:
        print("[LoRa TX] Serial port not ready — skipping uplink.")
        return
    ensure_joined()
    uplink_busy.set()
    try:
        resp = send_at(f"AT+SEND={port}:{payload_hex}", delay=2.0)
        if not any("OK" in line for line in resp):
            print("[LoRa TX] Warning: module did not return OK for SEND command.")
    finally:
        uplink_busy.clear()


if __name__ == "__main__":
    pass

