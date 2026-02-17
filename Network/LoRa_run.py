# Lorar_run.py - LoRaWAN Data Transmission Script 
# Bennett Bucher | ELEC 421 Design | LoRaWAN Data Transmission Script
# This script initializes a LoRaWAN connection and sends sensor data
# via confirmed uplink messages using a LoRa module connected to a Raspberry Pi.
# It encodes sensor readings into a compact binary format before transmission.

# Prerequisites:
# - Python 3.x
# - pyserial library (install via pip: pip install pyserial)
# - LoRaWAN module connected to Raspberry Pi via serial interface

# Required Hardware:
# - Raspberry Pi (any model with GPIO pins)
# - LoRaWAN gateway module: RAK7289V2 
# - LoRaWAN RF Module:  RAK3272SiP Breakout Board

import struct
import time
import serial
import binascii
import argparse

# Control printing of AT command output: set to False to suppress prints
VERBOSE = True

# Defines
SERIAL_PORT = "COM8"     
BAUD_RATE = 115200
DEVEUI = "70B3D57ED007545D" # set by manufacturer
APPEUI = "0000000000000000" # 64 bit unique ID
APPKEY = "B2579CA4A849B71844D759B0E8DF5D9D" # 32 hex characters (16 bytes)
TEST_PORT = 2 #FPort for uplink messages
TX_INTERVAL = 30   # Time between uplinks (seconds) - adjust as needed for testing    
RX_LISTEN_TIME = 3 # Time to listen for responses after uplink (seconds)    

# Serial Initialization
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)

# Parce Response 
def parse_response(resp):
    """
    Filters out OK and empty lines
    """
    lines = resp.replace("\r", "").split("\n")
    return [line.strip() for line in lines
            if line.strip() and line.strip() != "OK"]

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
    send_at("AT+CLASS=A")          # Class A Device
    send_at("AT+BAND=5")           # Region 5 = US915
    send_at("AT+NJM=1")            # Set to OTAA
    send_at("AT+CFM=1")            # Confirmed uplinks
    send_at("AT+ADR=1")            # Enable ADR
    send_at("AT+LPM=1")            # Disable Low Power Mode

    #Device Identifiers {DEVEUI, APPEUI, APPKEY} 
    #send_at("AT+DEVEUI="+DEVEUI)
    #send_at("AT+APPEUI="+APPEUI)
    #send_at("AT+APPKEY="+APPKEY)
    
    # Attempt join until success
    joined = False
    while not joined:
        resp = send_at("AT+JOIN=1:0:10:3")
        if any("JOINED" in line for line in resp):
            print("LoRaWAN Join Successful")
            joined = True
        else:
            print("Retrying Join in 10s...")
            time.sleep(8)

def encode_payload(ec, ph, temp, o2, level, trans, flags):
    """
    Encode sensor data into a LoRaWAN payload
    ec    : uint8 (ec / 1000)
    ph    : uint8 
    temp  : uint16
    o2    : uint8
    level : uint8
    trans : uint8
    flags : uint8
    8 bytes total
    """
    payload = struct.pack(
        ">BBHBBBB",              # Format string: big-endian, 7 unsigned bytes (1 uint16 = 2 bytes)
        int(ec) & 0xFF,          # uint8
        int(ph) & 0xFF,          # uint8
        int(temp) & 0xFFFF,      # uint16
        int(o2) & 0xFF,          # uint8
        int(level) & 0xFF,       # uint8
        int(trans) & 0xFF,       # uint8
        int(flags) & 0xFF        # uint8
          )
    return binascii.hexlify(payload).decode().upper()

#Send Uplink Function
def send_uplink(payload_hex, port=2):
    cmd = f"AT+SEND={port}:{payload_hex}"
    send_at(cmd, delay=0.5)

#Listen for Serial Responses
def listen_for_responses(timeout=RX_LISTEN_TIME):
    """
    Listen for serial responses after uplink (events, confirmations, etc.)
    Displays responses exactly as they appear on AT command monitor.
    """
    start_time = time.time()
    
    while (time.time() - start_time) < timeout:
        if ser.in_waiting > 0:
            raw = ser.read(ser.in_waiting).decode(errors="ignore")
            lines = parse_response(raw)
            
            for line in lines:
                if VERBOSE:
                    print("<<", line)
        
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
    import threading
    stop_flag = threading.Event()
    
    # Thread to monitor for Enter key press
    def wait_for_enter():
        input()
        stop_flag.set()
        print("\n\n=== STOP REQUESTED ===")
    
    monitor_thread = threading.Thread(target=wait_for_enter, daemon=True)
    monitor_thread.start()
    
    # Infinite loop until Enter is pressed
    count = 0
    while not stop_flag.is_set():
        count += 1
        ec = 10          #Example EC value in uS/cm
        ph = 7.0          #Example pH value
        temp = 26         #Example temperature in Celsius
        o2 = 9.0          #Example oxygen level 
        level = 5         #Example water level
        trans = 1         #Example transmission status
        flags = 1         #Example flags

        payload = encode_payload(ec, ph, temp, o2, level, trans, flags)
        print(f"\n--- Uplink #{count} ---")
        send_uplink(payload, TEST_PORT)

        # Listen for responses (events, confirmations)
        listen_for_responses(timeout=RX_LISTEN_TIME)
        print(f"Listened for {RX_LISTEN_TIME}s after uplink #{count}")
        
        if not stop_flag.is_set():
            print(f"\n[Waiting {TX_INTERVAL}s...]\n")
            # Sleep in small chunks to be responsive to stop signal
            for _ in range(TX_INTERVAL * 2):
                if stop_flag.is_set():
                    break
                time.sleep(0.5)
    
    print(f"\nTest completed. Total uplinks sent: {count}")
    print("Closing serial connection...")
    ser.close()
    