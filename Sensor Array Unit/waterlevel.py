#!/usr/bin/env python3
import time
from smbus2 import SMBus

BUS_NUM = 1
ADDR_LOW  = 0x77   # 8 sections
ADDR_HIGH = 0x78   # 12 sections

THRESHOLD = 100          # tune if needed
CM_PER_SECTION = 1.0     # adjust if your probe's effective spacing differs
POLL_S = 0.25

def read_sections(bus):
    low  = bus.read_i2c_block_data(ADDR_LOW,  0x00, 8)
    high = bus.read_i2c_block_data(ADDR_HIGH, 0x00, 12)
    return low, high

def sections_wet(low, high, threshold=THRESHOLD):
    """
    Seeed method: threshold each of the 20 section values, build a mask,
    then count consecutive 1s from the bottom.
    """
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

    return n  # 0..20

def main():
    with SMBus(BUS_NUM) as bus:
        print("Water level live readout (Ctrl+C to exit)")
        try:
            while True:
                low, high = read_sections(bus)
                n = sections_wet(low, high)

                depth_cm = n * CM_PER_SECTION
                percent = n * 5  # 20 sections -> 5% each

                # One-line update (carriage return)
                print(
                    f"\rPads touching: {n:02d}/20 | Depth est: ~{depth_cm:4.1f} cm | {percent:3d}%",
                    end="",
                    flush=True
                )

                time.sleep(POLL_S)

        except KeyboardInterrupt:
            print("\nStopped.")

if __name__ == "__main__":
    main()
