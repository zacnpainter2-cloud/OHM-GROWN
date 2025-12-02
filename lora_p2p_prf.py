## Bennett Bucher | ELEC 421 Design | Proof of concept Script
## CREDITS: This script is adapted from Adafruit's LoRa examples found at: https://learn.adafruit.com/adafruit-rfm9x-long-range-radio-arduino-library
## This script demonstrates peer-to-peer LoRa communication between two Raspberry Pis
## using buttons to send distinct messages and an OLED display to show received messages.
## This script will also have the RFM9x module configured for P2P LoRa communication.
## Once Button A, B, or C is pressed, a unique message is sent via LoRa containing the date 
## sent from a Raspberry Pi. The receiving Raspberry Pi Zero will display the message on the OLED screen.
## A mock sensor reading for EC, pH, Tempeurature, flow boolean switch, and water level sensor will be transmitted
## periodically after and adjusted interval of time (Default: 30 seconds) to simulate real-world application. The transmittions
## will then repeat (Default: 3 times) with randomized values of sensor data and button presses again.
##

## Required Hardware:
## - Raspberry Pi (any model with GPIO pins)
##- ADAfruit LoRa Radio (RFM9x) or compatible module
## - ADAfruit 128x32 OLED Display



# Import Python System Libraries
import time
import random
# Import Blinka Libraries
import busio
from digitalio import DigitalInOut, Direction, Pull
import board
# Import the SSD1306 module.
import adafruit_ssd1306
# Import RFM9x
import adafruit_rfm9x


#Button Initialization and Configuration
# Button A
btnA = DigitalInOut(board.D5)
btnA.direction = Direction.INPUT
btnA.pull = Pull.UP

# Button B
btnB = DigitalInOut(board.D6)
btnB.direction = Direction.INPUT
btnB.pull = Pull.UP

# Button C
btnC = DigitalInOut(board.D12)
btnC.direction = Direction.INPUT
btnC.pull = Pull.UP

#Interface Initialization
# Create the I2C interface.
i2c = busio.I2C(board.SCL, board.SDA)

# 128x32 OLED Display
reset_pin = DigitalInOut(board.D4)
display = adafruit_ssd1306.SSD1306_I2C(128, 32, i2c, reset=reset_pin)
# Clear the display.
display.fill(0)
display.show()
width = display.width
height = display.height

# Configure LoRa Radio
CS = DigitalInOut(board.CE1)
RESET = DigitalInOut(board.D25)
spi = busio.SPI(board.SCK, MOSI=board.MOSI, MISO=board.MISO)
rfm9x = adafruit_rfm9x.RFM9x(spi, CS, RESET, 902.3)
rfm9x.tx_power = 23
rfm9x.signal_bandwidth = 125000
rfm9x.preamble_length = 8
prev_packet = None
stop_sequence = False  # Flag to stop the mock sequence

def get_sensor_data():
    """Generate mock sensor readings"""
    ec = round(random.uniform(0.5, 3.0), 2)  # EC in mS/cm
    ph = round(random.uniform(5.5, 8.5), 1)  # pH value
    temp = round(random.uniform(15.0, 35.0), 1)  # Temperature in Celsius
    flow = random.choice([True, False])  # Flow boolean
    water_level = random.randint(10, 100)  # Water level in %
    
    return {
        "EC": ec,
        "pH": ph,
        "Temp": temp,
        "Flow": flow,
        "WaterLevel": water_level
    }

while True:
    packet = None
    # draw a box to clear the image
    display.fill(0)
    display.text('RasPi LoRa', 35, 0, 1)

    # check for packet rx
    packet = rfm9x.receive()
    if packet is None:
        display.show()
        display.text('- Waiting for PKT -', 15, 20, 1)
    else:
        # Display the packet text and rssi
        display.fill(0)
        prev_packet = packet
        print(packet)
        packet_text = str(prev_packet, "utf-8")
        display.text('RX: ', 0, 0, 1)
        display.text(packet_text, 25, 0, 1)
        time.sleep(0.5)

    # Button C: Stop the mock sequence
    if not btnC.value:
        stop_sequence = True
        display.fill(0)
        display.text('Sequence Stopped!', 15, 15, 1)
        display.show()
        time.sleep(0.5)
    # Send Button A with new sensor data each loop
    elif not btnA.value:
        stop_sequence = False
        for i in range(3):
            # Check if button C is pressed to break out of loop
            if stop_sequence or not btnC.value:
                display.fill(0)
                display.text('Loop Cancelled!', 20, 15, 1)
                display.show()
                time.sleep(0.5)
                break
            
            display.fill(0)
            sensor_data = get_sensor_data()
            msg = f"BTN_A|EC:{sensor_data['EC']}|pH:{sensor_data['pH']}|Temp:{sensor_data['Temp']}|Flow:{sensor_data['Flow']}|WL:{sensor_data['WaterLevel']}%\"
            payload = msg.encode('utf-8')
            print(f"[Button A - Transmission {i+1}/3]")
            print(f"Message: {msg.strip()}")
            print(f"Payload (characters): {payload.decode('utf-8')}")
            #print(f"Payload (hex): {payload.hex()}")
            print(f"Byte Length: {len(payload)}")
            print()
            rfm9x.send(payload)
            display.text(f'Sent Mock:({i+1}/3)', 15, 15, 1)
            display.show()
            if i < 2:  
            # Wait 1 minute between transmissions (not after the last one)
                for wait_count in range(60):
                    if stop_sequence:
                        break
                    time.sleep(1)
    #Send TEST CON message when Button B is pressed
    elif not btnB.value:
        display.fill(0)
        msg = "TEST CON"
        payload = msg.encode('utf-8')
        print(f"[Button B - TEST Connection]")
        print(f"Message: {msg}")
        print(f"Payload (characters): {payload.decode('utf-8')}")
        print(f"Byte Length: {len(payload)}")
        print()
        rfm9x.send(payload)
        display.text('Sent: TEST', 20, 15, 1)
    display.show()
    time.sleep(0.1)
