# Lorar_run.py - LoRaWAN Data Transmission Script 
# Bennett Bucher | ELEC 421 Design | LoRaWAN Data Transmission Script
# This script initializes a LoRaWAN connection and sends sensor data
# via confirmed uplink messages using a LoRa module connected to a Raspberry Pi.
# It encodes sensor readings into a compact binary format before transmission.
# The script also listens for responses from the LoRaWAN network after each uplink.

# Prerequisites:
# - Python 3.x
# - pyserial library (install via pip: pip install pyserial)
# - LoRaWAN module connected to Raspberry Pi via serial interface

# Required Hardware:
# - Raspberry Pi (any model with GPIO pins)or USB-to-Serial adapter to Terminal 
# - LoRaWAN gateway module: RAK7289V2 
# - LoRaWAN RF Module:  RAK3272SiP Breakout Board

import struct
import time
import serial
import binascii
import argparse
import threading

# Control printing of AT command output: set to False to suppress prints
VERBOSE = True

# Constants and Configuration
SERIAL_PORT = "COM8"     
BAUD_RATE = 115200
DEVEUI = "70B3D57ED007545D" # set by manufacturer
APPEUI = "0000000000000000" # 64 bit unique ID
APPKEY = "B2579CA4A849B71844D759B0E8DF5D9D" # 32 hex characters (16 bytes)
TEST_PORT = 2 #FPort for uplink messages
TX_INTERVAL = 30   # Time between uplinks (seconds) - adjust as needed for testing    
RX1DL_DELAY= 1 # Delay before RX1 window opens (seconds)
RX2DL_DELAY = 2 # Delay before RX2 window opens (seconds)
RX_LISTEN_TIME = 20 # Time to listen for responses after uplink (seconds)
JOIN_RETRY_DELAY = 10 # Time to wait before retrying join if it fails (seconds)
JOIN_RETRY_ATTEMPTS = 3 # Number of join attempts before giving up (set to None for infinite retries)
# Serial Initialization
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)

# Parce Response 
def parse_response(resp):
    """
    Filters out empty lines, keeps OK responses
    """
    lines = resp.replace("\r", "").split("\n")
    return [line.strip() for line in lines if line.strip()]

# Send AT Command
def send_at(command, delay=1, print_output=None):
    ser.write((command + "\r\n").encode())
    time.sleep(delay)

    raw = ser.read(ser.in_waiting).decode(errors="ignore")
    lines = parse_response(raw)

    # Determine whether to print output: use explicit arg if provided, else global VERBOSE
    local_print = VERBOSE if print_output is None else print_output
    if local_print:
        print(f">> {command}")
        for line in lines:
            print("<<", line)

    return lines

# LoRaWAN Initialization
def lorawan_init():
    # Check network join Status
    resp = send_at("AT+NJS=?") 
    if any("1" in line for line in resp):
        joined = True
        print("Device already joined")
        return
    
    send_at("AT+NWM=1")            # 1 = LoRaWAN mode
    send_at("AT+CLASS=C")          # Class C Device
    send_at("AT+BAND=5")           # Region 5 = US915
    send_at("AT+NJM=1")            # Set to OTAA
    send_at("AT+CFM=1")            # Confirmed uplinks
    send_at("AT+ADR=1")            # Enable ADR
    send_at("AT+LPM=1")            # Enable Low Power Mode
    #send_at("AT+RX1DL="+str(RX1DL_DELAY)) # Set RX1 delay
    #send_at("AT+RX2DL="+str(RX2DL_DELAY)) # Set RX2 delay

    #Device Identifiers {DEVEUI, APPEUI, APPKEY} 
    send_at("AT+DEVEUI="+DEVEUI)
    send_at("AT+APPEUI="+APPEUI)
    send_at("AT+APPKEY="+APPKEY)
    
    # Attempt join until success
    joined = False
    while not joined:
        resp = send_at(f"AT+JOIN=1:0:{JOIN_RETRY_DELAY}:{JOIN_RETRY_ATTEMPTS}", delay=JOIN_RETRY_DELAY + 2)
        if any("JOINED" in line for line in resp):
            print("LoRaWAN Join Successful")
            joined = True
        elif any("JOIN FAILED" in line for line in resp):
            print(f"Retrying Join in {JOIN_RETRY_DELAY}s...")
            time.sleep(JOIN_RETRY_DELAY - 2)

def encode_payload(ec, ph, temp, o2, level, trans, flags):
    """
    Encode sensor data into a LoRaWAN payload
    ec    : uint16 (in μS/cm, scaled by /10 to fit 0-655,350 μS/cm range)
    ph    : uint8 (scaled by *10, e.g., 7.1 → 71)
    temp  : uint16 (scaled by *10, e.g., 26.5°C → 265, range 0-6553.5°C)
    o2    : uint16 (% saturation scaled by *10, e.g., 95.5% → 955, range 0-100.0%)
    level : uint8 (water level count)
    trans : uint8 (transpiration rate)
    flags : uint8 (alert flags - binary)
    10 bytes total
    """
    payload = struct.pack(
        ">HBHHBBB",              # Format: uint16, uint8, uint16, uint16, uint8, uint8, uint8
        int(ec) & 0xFFFF,        # uint16 - EC in μS/cm 
        int(ph * 10) & 0xFF,     # uint8 - pH scaled by 10 (7.1 → 71)
        int(temp * 10) & 0xFFFF, # uint16 - Temperature scaled by 10 (26.5 → 265)
        int(o2 * 10) & 0xFFFF,   # uint16 - O2 % saturation scaled by 10 (95.5 → 955)
        int(level) & 0xFF,       # uint8 - Water level count
        int(trans) & 0xFF,       # uint8 - Transpiration rate
        int(flags) & 0xFF        # uint8 Total payload size: 10 bytes
          )
    return binascii.hexlify(payload).decode().upper()

#Send Uplink Function
def send_uplink(payload_hex, port=2):
    cmd = f"AT+SEND={port}:{payload_hex}"
    send_at(cmd, delay=0.5)

def process_serial_events(print_downlink_banner=False):
    """
    Read and print any pending serial lines.
    Returns True if a downlink line was detected.
    """
    downlink_received = False
    if ser.in_waiting > 0:
        raw = ser.read(ser.in_waiting).decode(errors="ignore")
        lines = parse_response(raw)

        for line in lines:
            if VERBOSE:
                print("<<", line)
            if "+EVT:RECV" in line:
                downlink_received = True
                if print_downlink_banner:
                    print("\n*** DOWNLINK DATA RECEIVED ***\n")

    return downlink_received

#Listen for Serial Responses
def listen_for_responses(timeout=5):
    """
    Listen for serial responses after uplink (events, confirmations, etc.)
    Displays responses exactly as they appear on AT command monitor.
    Highlights downlink messages if received.
    """
    start_time = time.time()
    downlink_received = False
    
    while (time.time() - start_time) < timeout:
        if process_serial_events(print_downlink_banner=not downlink_received):
            downlink_received = True
        
        time.sleep(0.5)

#Main Program 
if __name__ == "__main__":
    # Accept a simple --silent flag to suppress AT command prints (keeps return values)
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--silent", action="store_true", help="Suppress printing of AT command output")
    args, _ = parser.parse_known_args()
    VERBOSE = not args.silent

    print("Starting LoRaWAN Initialization...")
    lorawan_init()
    print("LoRaWAN Initialization Complete. Ready to send.")
    print("\n=== UPLINK TEST MODE ===")
    print("Uplinks will be sent continuously every", TX_INTERVAL, "seconds")
    print("Press Enter at any time to stop the test\n")
    input("Press Enter to start...") # Pause before starting
    
    # Flag to control loop
    stop_flag = threading.Event()
    
    # Thread to monitor for Enter key press
    def wait_for_enter():
        input()
        stop_flag.set()
        print("\n\n=== STOP REQUESTED ===")
    
    monitor_thread = threading.Thread(target=wait_for_enter, daemon=True)
    monitor_thread.start()
    
    count = 0
    while not stop_flag.is_set():
        count += 1
        
        # Static sensor values
        ec = 1999          # EC value in μS/cm
        ph = 6.5           # pH value
        temp = 21.4        # Temperature in Celsius
        o2 = 92.6          # O2 % saturation
        level = 10          # Water level height
        trans = 150        # Transpiration rate
        flags = 0b00000000 # Alert flags (binary)
        
        print(f"\n--- Uplink #{count} ---")
        print(f"EC={ec} μS/cm, pH={ph}, Temp={temp}°C, O2={o2}%, Level Count={level}, Trans={trans}, Flags=0b{flags:08b}")
        
        payload = encode_payload(ec, ph, temp, o2, level, trans, flags)
        send_uplink(payload, TEST_PORT)

        # Listen for uplink confirmation and downlink messages (5 sec for RX1+RX2 windows)
        listen_for_responses(timeout=5)
        
        # Check signal parameters after uplink
        send_at("AT+DR=?")    # Check current data rate 
        send_at("AT+SNR=?")   # Check SNR 
        send_at("AT+RSSI=?")  # Check RSSI 
     
        if not stop_flag.is_set():
            print(f"\n[Waiting {TX_INTERVAL}s...]\n")
            # Wait in small chunks: stay responsive to stop signal and listen for downlinks
            for _ in range(TX_INTERVAL * 2):
                if stop_flag.is_set():
                    break
                process_serial_events(print_downlink_banner=True)
                time.sleep(0.5)
    
    print(f"\nTest completed. Total uplinks sent: {count}")
    print("Closing serial connection...")
    ser.close()
    
