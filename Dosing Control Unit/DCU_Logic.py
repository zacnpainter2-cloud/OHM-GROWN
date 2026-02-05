#DCU LOGIC
#USED ChatGPT to convert Code from C to Python
#Code will operate both peristaltic metering pumps in order to maintain a range 

import time
import random
import RPi.GPIO as GPIO

# GPIO Pin 5 (BCM numbering)(PH output pin)
PH_PUMP_ON_PIN = 5

# GPIO Pin 6 (BCM numbering)(EC Output Pin)
EC_PUMP_ON_PIN = 6

# PH Dummy Measurement generation range 
# Measurement Can only generate withing 5-7.5
PH_MIN_VALUE = 5.0
PH_MAX_VALUE = 7.5

# EC Dummy Measurement generation range 
# Measurement Can only generate withing 0.8-1.0
EC_MIN_VALUE = 0.8
EC_MAX_VALUE = 1.0

# PH Threshold Range
# Range that will affect the dosing sequence
PH_LOW_THRESHOLD = 5.0
PH_HIGH_THRESHOLD = 6.0

# EC Threshold Range
# Range that will affect the dosing sequence
EC_LOW_THRESHOLD = 0.9
EC_HIGH_THRESHOLD = 1.0

# GPIO setup
GPIO.setmode(GPIO.BCM)
GPIO.setup(PH_PUMP_ON_PIN, GPIO.OUT)
GPIO.setup(EC_PUMP_ON_PIN, GPIO.OUT)

#INITIAL GPIO PIN CONDITIONS
GPIO.output(PH_PUMP_ON_PIN, GPIO.HIGH)
GPIO.output(EC_PUMP_ON_PIN, GPIO.HIGH)

# random number generator 
random.seed(time.time())
#PH_measurement = input("Enter desired pH value:")
#EC_measurement = input("Enter desired EC value:")
#Program Starting, Ctrl+C to Stop the Loop. 


print("Starting program... (Ctrl+C to stop)")

try:
    while True:
        print(f"PH Upper Threshold: {PH_HIGH_THRESHOLD:.2f}")
        print(f"PH Lower Threshold: {PH_LOW_THRESHOLD:.2f}")
        print(f"EC Upper Threshold: {EC_HIGH_THRESHOLD:.2f}")
        print(f"EC Lower Threshold: {EC_LOW_THRESHOLD:.2f}")

        PH_measurement = random.uniform(PH_MIN_VALUE, PH_MAX_VALUE)   #Random Number Generation
        print(f"Random Measurement: {PH_measurement:.2f}")      #Random Number Display

        PH_out_of_range = (PH_measurement < PH_LOW_THRESHOLD or PH_measurement > PH_HIGH_THRESHOLD)   # PH Out of Range Calculation
        EC_out_of_range = (EC_measurement < EC_LOW_THRESHOLD or EC_measurement > EC_HIGH_THRESHOLD)   # EC Out of Range Calculation
        if PH_out_of_range:   
            print(" → PH OUTSIDE RANGE! 'Dosing' for 5 seconds. (PUMP ON)")
            GPIO.output(PH_PUMP_ON_PIN, GPIO.LOW)  # PH Pump ON
            time.sleep(5)                   # Dosing for 5 seconds
            GPIO.output(PH_PUMP_ON_PIN, GPIO.HIGH)   # PH Pump OFF
            print("Waiting 15 seconds before taking next reading for Circulation")
            time.sleep(15)   # Wait before next reading (Circulation Timer)
        else if EC_out_of_range:
            print(" → EC OUTSIDE RANGE! 'Dosing' for 5 seconds. (PUMP ON)")
            GPIO.output(EC_PUMP_ON_PIN, GPIO.LOW)  # EC Pump ON
            time.sleep(5)    # Dosing for 5 seconds
            GPIO.output(EC_PUMP_ON_PIN, GPIO.HIGH)
            print("Waiting 15 seconds before taking next reading for Circulation")
            time.sleep(15)   # Wait before next reading (Circulation Timer)
            
        else:
            print(" → Inside range. PUMP OFF.")
            GPIO.output(PH_PUMP_ON_PIN, GPIO.HIGH)   # PH Pump OFF
            GPIO.output(EC_PUMP_ON_PIN, GPIO.HIGH)   # EC Pump OFF
            print("Waiting 15 seconds before taking next reading for Circulation")
            time.sleep(15)   # Wait before next reading (Circulation Timer)
                         
except KeyboardInterrupt:
    print("\nProgram stopped by user.")

finally:
    GPIO.output(LED_PIN, GPIO.LOW)
    GPIO.cleanup()
    print("GPIO cleaned up.")
