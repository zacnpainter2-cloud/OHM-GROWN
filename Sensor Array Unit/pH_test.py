#!/usr/bin/env python3

import time

# Trying smbus2 first, falling back to smbus if needed
try:
    from smbus2 import SMBus
except ImportError:
    from smbus import SMBus

# ---------------- I2C Configuration ----------------
I2C_BUS = 1          # Standard Raspberry Pi I2C bus
RTD_ADDR = 0x66      # Atlas EZO-RTD default address
PH_ADDR  = 0x63      # Atlas EZO-pH default address

# Adding delays to assist readings going through
RTD_DELAY      = 0.9
PH_TEMP_DELAY  = 0.3
PH_MEAS_DELAY  = 0.9

# ---------------- Sensor Read Functions ----------------

def read_rtd_temp_c():
    """Reading temperature in Celsius from Atlas EZO-RTD."""
    with SMBus(I2C_BUS) as bus:
        bus.write_i2c_block_data(RTD_ADDR, ord('R'), [0x00])  # R is the read command given by Atlas
        time.sleep(RTD_DELAY)
        raw = bus.read_i2c_block_data(RTD_ADDR, 0x00, 32)

    status = raw[0]
    text = "".join(chr(b) for b in raw[1:] if b not in (0, 255)).strip()

    if status != 1:
        raise RuntimeError(f"RTD error (status {status}): {text}")

    return float(text)


def read_ph_temp_comp(temp_c):
    """Read temperature-compensated pH from Atlas EZO-pH."""
    with SMBus(I2C_BUS) as bus:
        # Send temperature compensation (optional but recommended)
        cmd = f"T,{temp_c:.2f}"
        data = [ord(c) for c in cmd] + [0x00]  # 0x00 marks the end of the command string
        bus.write_i2c_block_data(PH_ADDR, data[0], data[1:])
        time.sleep(PH_TEMP_DELAY)

        # Request pH reading
        bus.write_i2c_block_data(PH_ADDR, ord('R'), [0x00])
        time.sleep(PH_MEAS_DELAY)

        raw = bus.read_i2c_block_data(PH_ADDR, 0x00, 32)

    status = raw[0]
    text = "".join(chr(b) for b in raw[1:] if b not in (0, 255)).strip()

    if status != 1:
        raise RuntimeError(f"pH error (status {status}): {text}")

    return float(text)

# ---------------- Main Loop ----------------

def main():
    print("SAU Console Monitor (RTD + pH)")
    print("Press Ctrl+C to exit\n")

    try:
        while True:
            try:
                temp_c = read_rtd_temp_c()
                ph_val = read_ph_temp_comp(temp_c)

                # Carriage return keeps output on one line
                print(
                    f"\rTemp: {temp_c:6.2f} °C | pH: {ph_val:5.2f}",
                    end="",
                    flush=True,  # prints to terminal immediately
                )

            except Exception as e:
                print(f"\rSensor error: {e}", end="", flush=True)

            time.sleep(1.0)

    except KeyboardInterrupt:
        print("\nExiting")

if __name__ == "__main__":
    main()
