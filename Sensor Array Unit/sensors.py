#!/usr/bin/env python3

import time
from gpiozero import DigitalInputDevice

try:
    from smbus2 import SMBus
except ImportError:
    from smbus import SMBus

I2C_BUS = 1
RTD_ADDR = 0x66
EC_ADDR  = 0x64
PH_ADDR  = 0x63

ADDR_LOW  = 0x77
ADDR_HIGH = 0x78

FLOW_PIN = 16

RTD_DELAY     = 0.9
EC_TEMP_DELAY = 0.3
EC_MEAS_DELAY = 0.9
PH_TEMP_DELAY = 0.3
PH_MEAS_DELAY = 0.9

THRESHOLD = 100
MM_PER_SECTION = 5
POLL_S = 6

in_pin = DigitalInputDevice(FLOW_PIN, pull_up=True)

def read_rtd_temp_c(bus):
    bus.write_i2c_block_data(RTD_ADDR, ord('R'), [0x00])
    time.sleep(RTD_DELAY)
    raw = bus.read_i2c_block_data(RTD_ADDR, 0x00, 32)

    status = raw[0]
    text = "".join(chr(b) for b in raw[1:] if b not in (0, 255)).strip()

    if status != 1:
        raise RuntimeError(f"RTD error (status {status}): {text}")

    return float(text)

def read_ec_temp_comp_uScm(bus, temp_c):
    cmd = f"T,{temp_c:.2f}"
    data = [ord(c) for c in cmd] + [0x00]
    bus.write_i2c_block_data(EC_ADDR, data[0], data[1:])
    time.sleep(EC_TEMP_DELAY)

    bus.write_i2c_block_data(EC_ADDR, ord('R'), [0x00])
    time.sleep(EC_MEAS_DELAY)

    raw = bus.read_i2c_block_data(EC_ADDR, 0x00, 32)

    status = raw[0]
    text = "".join(chr(b) for b in raw[1:] if b not in (0, 255)).strip()

    if status != 1:
        raise RuntimeError(f"EC error (status {status}): {text}")

    return float(text)

def read_ph_temp_comp(bus, temp_c):
    cmd = f"T,{temp_c:.2f}"
    data = [ord(c) for c in cmd] + [0x00]
    bus.write_i2c_block_data(PH_ADDR, data[0], data[1:])
    time.sleep(PH_TEMP_DELAY)

    bus.write_i2c_block_data(PH_ADDR, ord('R'), [0x00])
    time.sleep(PH_MEAS_DELAY)

    raw = bus.read_i2c_block_data(PH_ADDR, 0x00, 32)

    status = raw[0]
    text = "".join(chr(b) for b in raw[1:] if b not in (0, 255)).strip()

    if status != 1:
        raise RuntimeError(f"pH error (status {status}): {text}")

    return float(text)

def read_sections(bus):
    low = bus.read_i2c_block_data(ADDR_LOW, 0x00, 8)
    high = bus.read_i2c_block_data(ADDR_HIGH, 0x00, 12)
    return low, high

def sections_wet(low, high, threshold=THRESHOLD):
    touch_val = 0

    for i in range(8):
        if low[i] > threshold:
            touch_val |= (1 << i)

    for i in range(12):
        if high[i] > threshold:
            touch_val |= (1 << (8 + i))

    n = 0
    while touch_val & 0x01:
        n += 1
        touch_val >>= 1

    return n

def main():
    print("SAU Sensor Monitor")
    print("Press Ctrl+C to exit\n")

    try:
        with SMBus(I2C_BUS) as bus:
            while True:
                try:
                    temp_c = read_rtd_temp_c(bus)
                    ec_uS = read_ec_temp_comp_uScm(bus, temp_c)
                    ph_val = read_ph_temp_comp(bus, temp_c)

                    low, high = read_sections(bus)
                    n = sections_wet(low, high)
                    depth_mm = n * MM_PER_SECTION
                    percent = n * 5

                    flow_state = in_pin.value

                    print(
                        f"\rTemp: {temp_c:6.2f} °C | "
                        f"EC: {ec_uS:8.1f} µS/cm | "
                        f"pH: {ph_val:5.2f} | "
                        f"Water: {n:02d}/20 ~{depth_mm:4.1f} mm {percent:3d}% | "
                        f"Flow: {'ON' if flow_state else 'OFF'}",
                        end="",
                        flush=True
              

                except Exception as e:
                    print(f"\rSensor error: {e}", end="", flush=True)

                time.sleep(POLL_S)

    except KeyboardInterrupt:
        print("\nExiting")

    finally:
        in_pin.close()

if __name__ == "__main__":
    main()