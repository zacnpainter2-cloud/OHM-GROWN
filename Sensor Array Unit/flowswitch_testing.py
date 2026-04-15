#!/usr/bin/env python3
import time
from gpiozero import DigitalInputDevice

#Choosing GPIO
pin = 16  # Switch between GPIO16 and GND

# Enable internal pull-up resistor
# GPIO reads HIGH when switch is open
# GPIO reads LOW when switch is pressed/closed
in_pin = DigitalInputDevice(pin, pull_up=True)

switch_state = None

try:
    while True:
        # value = 1 when open, 0 when pressed
        state = in_pin.value 

        if state != switch_state:
            print("ON" if state else "OFF")
            switch_state = state

        time.sleep(0.02)

except KeyboardInterrupt:
    pass

finally:
    in_pin.close()
