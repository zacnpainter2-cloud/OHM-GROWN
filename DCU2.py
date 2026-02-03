#DCU LOGIC
#USED ChatGPT to convert Code from C to Python
#Code is only Good For Demo #3

import time
import random
import RPi.GPIO as GPIO

# GPIO Pin 5 (BCM numbering)
PUMP_ON_PIN = 5

# Dummy Measurement generation range 
# Measurement Can only generate withing 5-7.5
MIN_VALUE = 5.0
MAX_VALUE = 7.5

# Threshold range
# Range that will affect the dosing sequence
LOW_THRESHOLD = 5.0
HIGH_THRESHOLD = 6.0

# GPIO setup
GPIO.setmode(GPIO.BCM)
GPIO.setup(PUMP_ON_PIN, GPIO.OUT)

# Seed random number generator 
random.seed(time.time())

#Program Starting, Ctrl+C to Stop the Loop. 
print("Starting program... (Ctrl+C to stop)")

try:
    while True:
        print(f"Upper Threshold: {HIGH_THRESHOLD:.2f}")
        print(f"Lower Threshold: {LOW_THRESHOLD:.2f}")

        measurement = random.uniform(MIN_VALUE, MAX_VALUE)   #Random Number Generation
        print(f"Random Measurement: {measurement:.2f}")      #Random Number Display

        out_of_range = (measurement < LOW_THRESHOLD or measurement > HIGH_THRESHOLD)   #Out of Range Calculation

        if out_of_range:
            print(" → OUTSIDE RANGE! 'Dosing' for 5 seconds. (PUMP ON)")

            GPIO.output(PUMP_ON_PIN, GPIO.LOW)  # Pump ON
            time.sleep(5)                   # Dosing for 5 seconds

            GPIO.output(PUMP_ON_PIN, GPIO.HIGH)   # Pump OFF
            print("Waiting 10 seconds before next reading... (Circulation)")
            time.sleep(10)                   # Circulation delay (10 Seconds)

        else:
            print(" → Inside range. PUMP OFF.")

            GPIO.output(PUMP_ON_PIN, GPIO.HIGH)   # LED OFF
            print("Waiting 15 seconds before taking next reading...")
            time.sleep(15)                 # Wait before next reading

except KeyboardInterrupt:
    print("\nProgram stopped by user.")

finally:
    GPIO.output(LED_PIN, GPIO.LOW)
    GPIO.cleanup()
    print("GPIO cleaned up.")
