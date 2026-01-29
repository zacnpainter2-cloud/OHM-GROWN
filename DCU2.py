#DCU LOGIC
#USED ChatGPT to convert Code from C to Python


import time
import random
import RPi.GPIO as GPIO

# GPIO Pin 9 (BCM numbering)
PUMP_ON_PIN = 5

# Dummy Measurement generation range
MIN_VALUE = 5.0
MAX_VALUE = 7.5

# Threshold range
LOW_THRESHOLD = 5.0
HIGH_THRESHOLD = 6.0

# GPIO setup
GPIO.setmode(GPIO.BCM)
GPIO.setup(LED_PIN, GPIO.OUT)

# Seed random number generator (similar intent to time_us_32)
random.seed(time.time())

print("Starting program... (Ctrl+C to stop)")

try:
    while True:
        print(f"Upper Threshold: {HIGH_THRESHOLD:.2f}")
        print(f"Lower Threshold: {LOW_THRESHOLD:.2f}")

        measurement = random.uniform(MIN_VALUE, MAX_VALUE)   #Random Number Generation
        print(f"Random Measurement: {measurement:.2f}")      #Random Number Display

        out_of_range = (measurement < LOW_THRESHOLD or measurement > HIGH_THRESHOLD)   #Out of Range Calculation

        if out_of_range:
            print(" → OUTSIDE RANGE! 'Dosing' for 5 seconds. (LED ON)")

            GPIO.output(LED_PIN, GPIO.HIGH)  # Pump ON
            time.sleep(5)                   # Dosing for 5 seconds

            GPIO.output(LED_PIN, GPIO.LOW)   # Pump OFF
            print("Waiting 5 seconds before next reading... (Circulation)")
            time.sleep(5)                   # Circulation delay

        else:
            print(" → Inside range. LED OFF.")

            GPIO.output(LED_PIN, GPIO.LOW)   # LED OFF
            print("Waiting 10 seconds before next reading...")
            time.sleep(10)                 # Wait before next reading

except KeyboardInterrupt:
    print("\nProgram stopped by user.")

finally:
    GPIO.output(LED_PIN, GPIO.LOW)
    GPIO.cleanup()
    print("GPIO cleaned up.")
