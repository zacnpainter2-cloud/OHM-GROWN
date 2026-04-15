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

# pH Max Value Set
# pH Setpoint Set
# Range that will affect the dosing sequence
PH_Default_Setpoint = 5.0
PH_Default_Min = 4.0

# EC Min Value Set
# EC Setpoint Set
# Range that will affect the dosing sequence
EC_Default_Setpoint = 1.0
EC_Default_Min = 0.9

#PH and EC pump Status bits
PH_Status=0
EC_Status=0

def read_ph_min():
            with limits_lock:
                 return limits["ph_low_thresh"]

def read_ph_max():
            with limits_lock:
                 return limits["ph_up_thresh"]

def read_ec_min():
            with limits_lock:
                 return limits["ec_low_thresh"]

def read_ec_max():
            with limits_lock:
                 return limits["ec_up_thresh"] 
def read_ph():
            with sensor_lock:
                 return sensor_state["ph"]

def read_ec():
            with sensor_lock:
                 return sensor_state["ec"]

try:
    from smbus2 import SMBus
except ImportError:
    from smbus import SMBus
I2C_BUS = 1
EC_Pump_ADDR  = 0x68
PH_Pump_ADDR  = 0x67

def ph_pump_on(bus):
    command = "D,*"
    bus.write_i2c_block_data(PH_Pump_ADDR, cmd_bytes[0], cmd_bytes[1:])
    time.sleep(0.3)
    
def ph_pump_off(bus):
    command = "X"
    bus.write_i2c_block_data(PH_Pump_ADDR, cmd_bytes[0], cmd_bytes[1:])
    time.sleep(0.3)
            
def ec_pump_on(bus):
    command = "D,*"
    bus.write_i2c_block_data(EC_Pump_ADDR, cmd_bytes[0], cmd_bytes[1:])
    time.sleep(0.3)
def ec_pump_off(bus):
    command = "X"
    bus.write_i2c_block_data(EC_Pump_ADDR, cmd_bytes[0], cmd_bytes[1:])
    time.sleep(0.3)

            #=====================================================================================
            #================================ PROGRAM STARTING ===================================
            #================================  CTRL+C TO STOP  ===================================
            #===================================================================================== 


print("Starting program... (Ctrl+C to stop)")

try:
    while True:

        #-------Entering and Displaying the pH and EC measurement values-------#
        PH_measurement = read_ph() 
        EC_measurement = read_ec()      
        
        if read_ph_max() = 0
            PH_Setpoint = PH_Defualt_Setpoint
        else
            PH_Setpoint = read_ph_max()
                    
        if read_ph_min() = 0
            PH_Min = read_ph_min()
        else
            PH_Min = read_ph_min 

        if read_ec_max() = 0
            EC_Setpoint = EC_Defualt_Setpoint
        else
            EC_Setpoint = read_ec_max()

        if read_ec_min() = 0
            EC_Min = EC_Defualt_MIN
        else
            EC_MIN = read_ec_min()
                
         #-------pH Range Functions-------#
        def PH_NOT_at_Setpoint():
            return PH_measurement < PH_Setpoint
        def PH_out_of_range():
            return PH_measurement < PH_Min
        PH_Below_Setpoint = PH_NOT_at_Setpoint()
        PH_Above_MAX = PH_out_of_range()
                
        #-------EC Range Functions-------#
        def EC_NOT_at_Setpoint():
            return EC_measurement < EC_Setpoint
        def EC_out_of_range():
            return EC_measurement < EC_Min
        EC_Below_Setpoint = EC_NOT_at_Setpoint()
        EC_Below_MIN = EC_out_of_range()
            
                
            #=====================================================================================
            #================================ LOGIC STARTS =======================================
            #=====================================================================================   

        #-------pH is Checked and Dosed(if needed) First-------#
        #-------Dosed back down to setpoint not to the range-------#
        if PH_Above_MAX:
            while (PH_Below_Setpoint):
                    print(" → PH OUTSIDE RANGE! 'Dosing' for 5 seconds. (PUMP ON)")
                    ph_pump_on(bus)  # PH Pump ON    
                    PH_Status=1                              
                    EC_Status=0                              
                    time.sleep(2)                   # Dosing for 5 seconds
                    ph_pump_on(bus)   # PH Pump OFF
                    PH_Status=0
                    time.sleep(60)   # Wait before next reading (Circulation Timer)
                    PH_Below_Setpoint = PH_NOT_at_Setpoint()
                    


        #-------EC is Checked Next Dosed(if needed)-------#
        #-------Dosed back up to setpoint not to the range-------#
        elif EC_Below_MIN:
            while (EC_Below_Setpoint):
                    ec_pump_on(bus)  # EC Pump ON
                    PH_Status=0                               # =================================================================================
                    EC_Status=1                               # ======================= Pump Status Bits set & ===================================
                    print(f"PH Pump Status: {PH_Status:f}")   # =======================    Bits are Printed    =================================== 
                    print(f"EC Pump Status: {EC_Status:f}")   # ==================================================================================
                    time.sleep(2)    # Dosing for 5 seconds
                    ec_pump_off(bus) #EC Pump OFF
                    EC_Status=0
                    time.sleep(60)   # Wait before next reading (Circulation Timer)  
                    EC_Below_Setpoint = EC_NOT_at_Setpoint()
            
        #-------If Both Measurements are good, Code will break for a longer amount of time-------#
        else
            GPIO.output(PH_PUMP_ON_PIN, GPIO.LOW)   # PH Pump OFF
            GPIO.output(EC_PUMP_ON_PIN, GPIO.LOW)   # EC Pump OFF
            PH_Status=0                              
            EC_Status=0                              
            time.sleep(15)   # Wait before next reading (Circulation Timer)
                         
except KeyboardInterrupt:
    print("\nProgram stopped by user.")

finally:
    GPIO.output(PH_PUMP_ON_PIN, GPIO.LOW)
    GPIO.output(EC_PUMP_ON_PIN, GPIO.LOW)
    GPIO.cleanup()
    print("GPIO cleaned up.")
