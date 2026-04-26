
================================================================================
LoRaWAN Data Transmission System
OHM-GROWN
Bennett Bucher | ELEC 421 Design
================================================================================

PROJECT OVERVIEW
----------------
This project implements a LoRaWAN communication system for transmitting sensor
data from a Raspberry Pi Zero to a LoRaWAN gateway using the RAK3272SiP module.
The system includes LED status indicators on the LoRa module for visual feedback
of network connection and data transmission events.

HARDWARE REQUIREMENTS
---------------------
- Raspberry Pi Zero (with GPIO)
- RAK3272SiP Breakout Board (LoRaWAN RF Module)
- RAK7289V2 (LoRaWAN Gateway)
- RAK3272SiP custom carrier Board
- USB cable for serial communication

SOFTWARE REQUIREMENTS
---------------------
- Python 3.x
- pyserial library (install via: pip install pyserial)
- Arduino IDE with RAKwireless STM32 Boards support
- LoRaWAN-RAK3172.h library

PROJECT FILES
-------------
1. LoRa_run.py          - Python script for LoRaWAN uplink transmission
2. [Arduino_LED.ino]    - Arduino firmware for LED status indicators (TBD)

================================================================================
PYTHON SCRIPT: LoRa_run.py
================================================================================

DESCRIPTION
-----------
Initializes LoRaWAN connection and continuously sends sensor data via confirmed
uplink messages. Displays AT command communication in real-time.

CONFIGURATION
-------------
Edit the following parameters in LoRa_run.py:

    SERIAL_PORT = "COM8"              # Serial port (Windows: COMx, Pi: /dev/ttyUSB0)
    BAUD_RATE = 115200                # Serial baud rate
    DEVEUI = "70B3D57ED007545D"       # Device EUI (set by manufacturer)
    APPEUI = "0000000000000000"       # Application EUI
    APPKEY = "B2579CA4A849B71844D759B0E8DF5D9D"  # Application Key
    TEST_PORT = 2                     # LoRaWAN FPort
    TX_INTERVAL = 30                  # Seconds between uplinks
    RX_LISTEN_TIME = 8                # Time to listen for responses

USAGE
-----
1. Connect RAK3272SiP to computer/Pi via USB
2. Configure LoRaWAN credentials in script
3. Run the script:
   
   python LoRa_run.py

4. Press Enter to start sending uplinks
5. Press Enter again to stop the test

OUTPUT FORMAT
-------------
The script displays AT commands and responses exactly as they appear in an
AT command monitor:

    >> AT+SEND=2:96070090010501       (Command sent)
    << +EVT:SEND_CONFIRMED_OK          (Response received)
    << +EVT:RXC:-45:-8:0:0             (Signal info)

PAYLOAD FORMAT
--------------
8-byte binary payload (big-endian):
    - EC (uint8)       - Electrical conductivity
    - pH (uint8)       - pH level
    - Temp (uint16)    - Temperature
    - O2 (uint8)       - Oxygen level
    - Level (uint8)    - Water level
    - Trans (uint8)    - Transmission status
    - Flags (uint8)    - Status flags

================================================================================
ARDUINO FIRMWARE: [Filename TBD]
================================================================================

DESCRIPTION
-----------
Provides visual feedback using LEDs for LoRaWAN network status and data activity.
The firmware monitors the LoRaWAN stack and triggers LED indicators based on
network events.

LED BEHAVIOR
------------
LED1 (PA6) - Network Connection Status:
    - Blinking (200ms): Not connected to LoRaWAN network
    - Solid ON: Successfully joined to network

LED2 (PA5) - Data Activity:
    - 3 quick blinks (100ms): Uplink transmission completed
    - 5 slow blinks (200ms): Downlink message received

INSTALLATION
------------
1. Install RAKwireless Arduino BSP:
   - Add URL to Board Manager: 
     https://raw.githubusercontent.com/RAKWireless/RAKwireless-Arduino-BSP-Index/main/package_rakwireless_index.json
   - Install "RAKwireless STM32 Boards"

2. Select Board:
   Tools → Board → RAKwireless STM32 Boards → WisDuo RAK3172 Evaluation Board

3. Upload firmware to RAK3272SiP

CALLBACKS USED
--------------
- registerJoinCallback()  - Monitors join events
- registerSendCallback()  - Triggers on uplink completion
- registerRecvCallback()  - Triggers on downlink reception

================================================================================
RASPBERRY PI SETUP (Optional - for deployment)
================================================================================

SSH ACCESS
----------
The Pi is configured for remote SSH over USB ethernet gadget mode:

    Command: ssh bbucher@LoRaPi.local
    Password: greenhouse
    Address: 192.168.137.4/24

PYTHON VIRTUAL ENVIRONMENT
---------------------------
1. Create virtual environment:
   python3 -m venv venv

2. Activate:
   source venv/bin/activate

3. Install dependencies:
   pip install pyserial

4. Deactivate:
   deactivate

LORAWAN CONFIGURATION
---------------------
Network Mode: LoRaWAN (AT+NWM=1)
Device Class: Class A
Region: US915 (AT+BAND=5)
Join Method: OTAA (AT+NJM=1)
Confirmed Uplinks: Enabled (AT+CFM=1)
Adaptive Data Rate: Enabled (AT+ADR=1)

================================================================================
TROUBLESHOOTING
================================================================================

"No legal application detected" error:
- Device stuck in bootloader mode
- Upload any valid Arduino sketch to exit bootloader

Serial port not found:
- Check USB connection
- Verify correct COM port in Device Manager (Windows) or ls /dev/tty* (Linux)

Join fails:
- Verify DEVEUI, APPEUI, APPKEY credentials
- Check gateway is online and in range
- Ensure correct region/band setting

No LED activity:
- Verify LED connections to PA6 and PA5
- Check Arduino firmware is uploaded correctly
- Ensure pins are configured as OUTPUT

================================================================================
NOTES
================================================================================
- LoRaWAN Class A devices only receive downlinks after uplink transmission
- RX windows open automatically at ~1s and ~2s after each uplink
- Callbacks may not trigger for AT command-initiated events (join callback)
- Polling api.lorawan.njs.get() is more reliable for join status monitoring

================================================================================
