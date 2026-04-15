This directory is for code used to test and incorporate the Network module into Ohm-Grown's Automated Hydroponic Controller.
# LoRa_run.py — LoRaWAN Data Transmission Script

This script initializes a LoRaWAN connection and transmits sensor data from a computer to a LoRaWAN network using a RAK3272SiP (or similar) LoRaWAN module controlled via AT commands over a serial connection.

## Location
- `Network/LoRa_run.py`

## What it does
- Opens a serial connection to a LoRaWAN modem.
- Sends AT commands to configure LoRaWAN settings (Class A, region, OTAA, confirmed uplinks, ADR, etc.).
- Checks whether the device is already joined to a network.
- (Intended to) encode sensor values into a compact binary payload before uplink.

## Requirements

### Software
- Python 3.x
- `pyserial`
  - Install: `pip install pyserial`

### Hardware
- Raspberry Pi (or any host that can access a serial port)
- LoRaWAN gateway (example referenced: RAK7289V2)
- LoRaWAN RF module (example referenced: RAK3272SiP Breakout Board)

## Key configuration values (edit in script)
Inside `LoRa_run.py`, update as needed:
- `SERIAL_PORT` (currently set to `"COM8"` — Windows-style)
- `BAUD_RATE` (currently `115200`)
- OTAA keys:
  - `DEVEUI`
  - `APPEUI`
  - `APPKEY`
- Uplink config:
  - `TEST_PORT` (FPort)
  - `TX_INTERVAL` (seconds between uplinks)
  - `RX_LISTEN_TIME` (seconds to listen after uplink)

## Typical usage
1. Connect the LoRaWAN module to the host via UART/USB-serial.
2. Confirm the correct serial port name:
   - Windows: `COM8`
   - Linux often looks like: `/dev/ttyUSB0` or `/dev/ttyS0`
3. Run the script:
   ```bash
   python Network/LoRa_run.py
