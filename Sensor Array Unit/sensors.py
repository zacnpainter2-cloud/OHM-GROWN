#!/usr/bin/env python3
#Elliott Cihlar 
#Sensor Reading Script

import time
from gpiozero import DigitalInputDevice

#Enabling I2C Connection
try:
    from smbus2 import SMBus
except ImportError:
    from smbus import SMBus

#Defining Some Variables
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

THRESHOLD = 540
MM_PER_SECTION = 5
POLL_S = 60

#Initializing GPIO 16
in_pin = None


###Defining Functions###

#Initializing GPIO 16 for the Flow Switch
def init_flow_pin():
    global in_pin
    if in_pin is None:
        in_pin = DigitalInputDevice(FLOW_PIN, pull_up=True)

def get_flow_state():
    global in_pin
    if in_pin is None:
        init_flow_pin()
    return in_pin.value

def read_rtd_temp_c(bus):
    bus.write_i2c_block_data(RTD_ADDR, ord('R'), [0x00])
    time.sleep(RTD_DELAY)
    raw = bus.read_i2c_block_data(RTD_ADDR, 0x00, 32)

    status = raw[0]
    text = "".join(chr(b) for b in raw[1:] if b not in (0, 255)).strip()

    if status != 1:
        raise RuntimeError(f"RTD error (status {status}): {text}")

    try:
        return float(text)
    except ValueError:
        raise RuntimeError(f"RTD non-numeric response: {text!r}")

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

    try:
        return float(text)
    except ValueError:
        raise RuntimeError(f"EC non-numeric response: {text!r}")

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

    try:
        return float(text)
    except ValueError:
        raise RuntimeError(f"pH non-numeric response: {text!r}")

def decode_u16_list(byte_list, little_endian=True):
    if len(byte_list) % 2 != 0:
        raise ValueError(f"Expected even number of bytes, got {len(byte_list)}")

    values = []
    for i in range(0, len(byte_list), 2):
        if little_endian:
            val = byte_list[i] | (byte_list[i + 1] << 8)
        else:
            val = (byte_list[i] << 8) | byte_list[i + 1]
        values.append(val)

    return values

def read_sections(bus):
    # 8 pads * 2 bytes each = 16 bytes
    low_bytes = bus.read_i2c_block_data(ADDR_LOW, 0x00, 16)

    # 12 pads * 2 bytes each = 24 bytes
    high_bytes = bus.read_i2c_block_data(ADDR_HIGH, 0x00, 24)

    low = decode_u16_list(low_bytes, little_endian=True)
    high = decode_u16_list(high_bytes, little_endian=True)

    return low, high

def sections_wet(low, high, threshold=THRESHOLD):
    count = 0

    for val in low:
        if val > threshold:
            count += 1

    for val in high:
        if val > threshold:
            count += 1

    return count

#Function Utilized in DMS script
def read_all_sensors(bus):
    if in_pin is None:
        init_flow_pin()

    temp_c = read_rtd_temp_c(bus)
    ec_uS = read_ec_temp_comp_uScm(bus, temp_c)
    ph_val = read_ph_temp_comp(bus, temp_c)

    low, high = read_sections(bus)
    n = sections_wet(low, high)
    percent = n * 5

    flow_state = in_pin.value

    return {
        "temperature": temp_c,
        "ec": ec_uS,
        "ph": ph_val,
        "water_level": percent,
        "circulation": bool(flow_state),
        "o2": 0.0,
    }

#Leaving Main for Debugging in Case of Errors.
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

                    flow_state = get_flow_state()

                    print(
                        f"\rTemp: {temp_c:6.2f} °C | "
                        f"EC: {ec_uS:8.1f} µS/cm | "
                        f"pH: {ph_val:5.2f} | "
                        f"Water: {n:02d}/20 ~{depth_mm:4.1f} mm {percent:3d}% | "
                        f"Flow: {'ON' if flow_state else 'OFF'} | "
                        f"Low raw: {low} | High raw: {high}",
                        end="",
                        flush=True
                    )

                except Exception as e:
                    print(f"\rSensor error: {e}", end="", flush=True)

                time.sleep(POLL_S)

    except KeyboardInterrupt:
        print("\nExiting")

    finally:
        if in_pin is not None:
            in_pin.close()

if __name__ == "__main__":
    main()
