#DCU LOGIC
#USED ChatGPT to convert Code from C to Python
#Used Franc For help
#Code will operate both peristaltic metering pumps in order to maintain a range 

import time
import random
import RPi.GPIO as GPIO

            #=====================================================================================
            #=========================INITIAL CONDITIONS/DEFAUL VALUES============================
            #===================================================================================== 

# PH Threshold Range
# Range that will affect the dosing sequence
PH_Setpoint = 5.0
PH_HIGH_THRESHOLD = 6.0

# EC Threshold Range
# Range that will affect the dosing sequence
EC_Setpoint = 1.0
EC_LOW_THRESHOLD = 0.9

#PH and EC pump Status bits
PH_Status=0
EC_Status=0

# GPIO Pin 5 (BCM numbering)(PH output pin)
PH_PUMP_ON_PIN = 5

# GPIO Pin 6 (BCM numbering)(EC Output Pin)
EC_PUMP_ON_PIN = 6

# GPIO setup
GPIO.setmode(GPIO.BCM)
GPIO.setup(PH_PUMP_ON_PIN, GPIO.OUT)
GPIO.setup(EC_PUMP_ON_PIN, GPIO.OUT)

#INITIAL GPIO PIN CONDITIONS
GPIO.output(PH_PUMP_ON_PIN, GPIO.LOW)
GPIO.output(EC_PUMP_ON_PIN, GPIO.LOW)


            #=====================================================================================
            #================================ PROGRAM STARTING ===================================
            #================================  CTRL+C TO STOP  ===================================
            #===================================================================================== 


print("Starting program... (Ctrl+C to stop)")

try:
    while True:

        #-------Displaying Threshold Values for both Pumps-------#
        print(f"PH Upper Threshold: {PH_HIGH_THRESHOLD:.2f}")
        print(f"PH Setpoint: {PH_Setpoint:.2f}")
        print(f"EC Setpoint: {EC_Setpoint:.2f}")
        print(f"EC Lower Threshold: {EC_LOW_THRESHOLD:.2f}")

        #-------Entering and Displaying the pH and EC measurement values-------#
        PH_measurement = float(input("Enter desired pH value:"))
        EC_measurement = float(input("Enter desired EC value:"))
        print(f"PH measurement: {PH_measurement:.2f}")      
        print(f"EC measurement: {EC_measurement:.2f}")      

        #-------pH Range Functions-------#
        def PH_NOT_at_Setpoint():
                    return PH_measurement > PH_Setpoint:
        def PH_out_of_range():
                    return  PH_measurement > PH_HIGH_THRESHOLD:
        PH_Above_Setpoint = PH_NOT_at_Setpoint()
        PH_Above_MAX = PH_out_of_range()
                
        #-------EC Range Functions-------#
        def EC_NOT_at_Setpoint():
                    return EC_measurement < EC_Setpoint:
        def EC_out_of_range():
                    return  EC_measurement > EC_LOW_THRESHOLD:
        EC_Below_Setpoint = EC_NOT_at_Setpoint()
        EC_Below_MIN = EC_out_of_range()
                
            #=====================================================================================
            #================================ LOGIC STARTS =======================================
            #=====================================================================================   

        #-------pH is Checked and Dosed(if needed) First-------#
        #-------Dosed back down to setpoint not to the range-------#
        if PH_Above_MAX:
            while (PH_Above_Setpoint)
                    print(" → PH OUTSIDE RANGE! 'Dosing' for 5 seconds. (PUMP ON)")
                    GPIO.output(PH_PUMP_ON_PIN, GPIO.HIGH)  # PH Pump ON    #dms.setphpump(1)
                    PH_Status=1                               # ==================================================================================
                    EC_Status=0                               # ======================= Pump Status Bits set & ===================================
                    print(f"PH Pump Status: {PH_Status:f}")   # =======================    Bits are Printed    ===================================
                    print(f"EC Pump Status: {EC_Status:f}")   # ==================================================================================
                    time.sleep(5)                   # Dosing for 5 seconds
                    GPIO.output(PH_PUMP_ON_PIN, GPIO.LOW)   # PH Pump OFF
                    PH_Status=0
                    print(f"PH Pump Status: {PH_Status:f}")
                    print("Waiting 5 seconds before taking next reading for Circulation")
                    time.sleep(5)   # Wait before next reading (Circulation Timer)
                    PH_measurement = float(input("Enter desired pH value:"))
                    PH_Above_Setpoint = PH_NOT_at_Setpoint()
                    


        #-------EC is Checked Next Dosed(if needed)-------#
        #-------Dosed back up to setpoint not to the range-------#
        elif EC_Below_MIN:
            while (EC_Below_Setpoint)
                    print(" → PH INSIDE RANGE! MOVING TO EC")
                    print(" → EC OUTSIDE RANGE! 'Dosing' for 5 seconds. (PUMP ON)")
                    GPIO.output(EC_PUMP_ON_PIN, GPIO.HIGH)  # EC Pump ON
                    PH_Status=0                               # =================================================================================
                    EC_Status=1                               # ======================= Pump Status Bits set & ===================================
                    print(f"PH Pump Status: {PH_Status:f}")   # =======================    Bits are Printed    =================================== 
                    print(f"EC Pump Status: {EC_Status:f}")   # ==================================================================================
                    time.sleep(5)    # Dosing for 5 seconds
                    GPIO.output(EC_PUMP_ON_PIN, GPIO.LOW)
                    EC_Status=0
                    print("Waiting 5 seconds before taking next reading for Circulation")
                    time.sleep(5)   # Wait before next reading (Circulation Timer)
                    print(f"EC measurement: {EC_measurement:.2f}") 
                    EC_Below_Setpoint = EC_NOT_at_Setpoint()
            
        #-------If Both Measurements are good, Code will break for a longer amount of time-------#
        else:
            print(" → Inside range. PUMP OFF.")
            GPIO.output(PH_PUMP_ON_PIN, GPIO.LOW)   # PH Pump OFF
            GPIO.output(EC_PUMP_ON_PIN, GPIO.LOW)   # EC Pump OFF
            PH_Status=0                               # ==================================================================================
            EC_Status=0                               # ======================= Pump Status Bits set & ===================================
            print(f"PH Pump Status: {PH_Status:f}")   # =======================    Bits are Printed    ===================================
            print(f"EC Pump Status: {EC_Status:f}")   # ==================================================================================
            print("Waiting 15 seconds before taking next reading for Circulation")
            time.sleep(15)   # Wait before next reading (Circulation Timer)
                         
except KeyboardInterrupt:
    print("\nProgram stopped by user.")

finally:
    GPIO.output(PH_PUMP_ON_PIN, GPIO.LOW)
    GPIO.output(EC_PUMP_ON_PIN, GPIO.LOW)
    GPIO.cleanup()
    print("GPIO cleaned up.")
