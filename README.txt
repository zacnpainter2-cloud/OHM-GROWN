
================================================================================
OHM-GROWN Scripts
ELEC 421 Design Project
================================================================================

OVERVIEW
--------
This directory contains the Raspberry Pi side of the OHM-GROWN hydroponics
demo system. The active software stack is organized around four runtime roles:

- sensors.py reads the sensor array over I2C and GPIO.
- DMS.py is the main orchestrator and logger.
- DCU.py handles automatic nutrient and pH dosing.
- LoRa_run.py manages LoRaWAN join, uplink, and downlink traffic.

The remaining files are calibration UI code, historical backups, test notes,
and the Python virtual environment used on the Pi and in local development.


SYSTEM FLOW
-----------
1. DMS.py starts the system and launches background threads.
2. sensors.py polls pH, EC, temperature, water level, and flow state.
3. DMS.py stores the latest values in shared state and appends CSV log rows.
4. DMS.py builds the LoRa payload and passes it to LoRa_run.py.
5. LoRa_run.py sends confirmed uplinks and forwards downlinks back to DMS.py.
6. DCU.py reads the live values and thresholds from DMS.py, then doses pH or
   nutrient solution when limits are violated.
7. calibration.py can temporarily pause the system and open a local
   framebuffer-based calibration UI for pH and EC probes.


ACTIVE ENTRY POINT
------------------
Run DMS.py for the integrated system. It is the top-level service that starts:

- sensor polling
- CSV sampling/logging
- LoRaWAN join and serial downlink listening
- dosing control
- calibration hotkey monitoring

The current code is written for Raspberry Pi deployment. Several paths are hard
coded to Linux locations such as /dev/ttyAMA0 and /home/ohm/Documents.


HARDWARE / SOFTWARE ASSUMPTIONS
-------------------------------
The codebase assumes the following devices and libraries are available:

- Raspberry Pi with GPIO and I2C enabled
- Atlas Scientific I2C devices:
  - RTD sensor at 0x66
  - EC sensor at 0x64
  - pH sensor at 0x63
  - EZO-PMP pH pump at 0x67
  - EZO-PMP EC pump at 0x68
- Capacitive water-level boards at 0x77 and 0x78
- Flow switch on GPIO 16
- Display/buttons/backlight used by calibration.py
- RAK3272 LoRa module on /dev/ttyAMA0

Common Python dependencies referenced in the code:

- pyserial
- gpiozero
- smbus2
- pillow
- pigpio (optional for PWM backlight control)


TOP-LEVEL FILE GUIDE
--------------------

1. DMS.py
   Purpose:
   Main Data Management System service. This is the intended integrated runtime
   entry point.

   What it does:
   - Initializes the LoRa downlink queue.
   - Restores pH/EC limits from the most recent CSV row.
   - Maintains shared sensor and pump state under thread locks.
   - Starts sensor polling, CSV logging, LoRa join/listen, calibration monitor,
     and dosing control threads.
   - Builds the LoRa payload from current measurements and pump flags.
   - Applies threshold updates received by LoRa downlink.

   Important runtime behavior:
   - Sensor polling interval is approximately 2 seconds.
   - CSV/logging interval is 300 seconds.
   - The CSV path in code is /home/ohm/Documents/sensor_database.csv.
   - Holding BACK + UP for 3 seconds triggers calibration mode.

   Important globals/configuration:
   - I2C_BUS = 1
   - INTERVAL_SEC = 300
   - limits dictionary for pH and EC min/max/setpoints
   - pause_event used to pause threads during calibration


2. sensors.py
   Purpose:
   Sensor abstraction layer for the Sensor Array Unit.

   What it reads:
   - RTD temperature sensor over I2C
   - EC sensor with temperature compensation
   - pH sensor with temperature compensation
   - Two water-level boards combined into 20 sections
   - Flow switch on GPIO 16

   Main exported function:
   - read_all_sensors(bus)

   Return payload from read_all_sensors(bus):
   - temperature
   - ec
   - ph
   - water_level
   - circulation
   - o2 (currently fixed at 0.0 placeholder)

   Notes:
   - Water level is converted to a percent in 5 percent increments.
   - The debug main loop prints a full sensor snapshot every 60 seconds.


3. DCU.py
   Purpose:
   Dosing Control Unit logic used by DMS.py.

   What it does:
   - Reads live pH, EC, water level, and threshold/setpoint values from DMS.
   - Prioritizes pH correction before EC correction.
   - Doses Atlas Scientific EZO-PMP pumps over I2C.
   - Sets pump-state flags in DMS so they can be logged and transmitted.
   - Skips dosing when water level is 0.

   Current implementation details:
   - This file contains a simple threshold/setpoint control loop.
   - It doses fixed amounts per cycle.
   - It waits for circulation/mixing after each dose.
   - It is pause-aware, so DMS can suspend it during calibration.

   Key configuration:
   - PH_PUMP_ADDR = 0x67
   - EC_PUMP_ADDR = 0x68
   - DOSE_PH_ML = 1.0
   - DOSE_EC_ML = 5.0
   - DOSE_RATE_ML = 0.5
   - CIRC_WAIT = 300
   - POLL_INTERVAL = 300





4. LoRa_run.py
   Purpose:
   LoRaWAN transport layer for the Raspberry Pi and RAK3272 module.

   What it does:
   - Opens the UART serial port.
   - Configures the RAK3272 for LoRaWAN OTAA.
   - Verifies join state and rejoins if required.
   - Sends confirmed uplinks.
   - Continuously monitors serial events for downlinks.
   - Pushes downlink payloads into a queue consumed by DMS.py.

   Key configuration:
   - SERIAL_PORT = /dev/ttyAMA0
   - BAUD_RATE = 115200
   - UPLINK_PORT = 2
   - JOIN_POLL_DELAY = 10
   - JOIN_POLL_MAX = 12

   Downlink behavior:
   - Expects RAK event lines that begin with +EVT:RX_.
   - Forwards the final hex field to DMS via a queue.

   Logging note:
   - Repository notes indicate this module also writes lightweight network logs
     to lora_network_log.csv with log rotation in some recent iterations.


5. calibration.py
   Purpose:
   Local calibration user interface for pH and EC probes.

   What it does:
   - Uses the Pi framebuffer directly for a 320x240 display.
   - Reads hardware buttons for menu navigation.
   - Controls the display backlight with pigpio or a gpiozero fallback.
   - Provides EC and pH calibration flows.
   - Opens from DMS when the BACK and UP buttons are held together.

   Important entry point:
   - launch_calibration_ui()

   Important notes:
   - Uses Linux paths for image assets under /home/ohm.
   - Talks directly to the pH and EC devices over I2C.
   - DMS pauses polling and dosing while calibration is active.


6. sensor_database.csv
   Purpose:
   Main CSV log of sensor values, pump states, and pH/EC threshold settings.

   Columns currently used by DMS.py:
   - Date
   - Time
   - pH
   - ec
   - Circulation
   - pH pump
   - EC pump
   - Temperature
   - Water Level
   - pH min
   - pH max
   - EC min
   - EC max
   - EC Setpoint
   - pH Setpoint

   Important behavior:
   - DMS.py reads the last row at startup and restores saved limits.
   - The sample CSV in this directory is useful for format reference, but the
     live runtime path in DMS.py points to /home/ohm/Documents/sensor_database.csv.





RUNTIME THREADS STARTED BY DMS.py
---------------------------------
The integrated runtime starts these daemon threads:

- sensor_polling_loop
- sampling_loop
- LoRa_run.downlink_listener
- lora_listener_loop
- LoRa_run.lorawan_init
- DCU.control_loop
- calibration_monitor_loop


LORA PAYLOAD FORMAT
-------------------
DMS.py currently builds a packed payload with the following fields:

- EC: 16 bits
- pH x10: 8 bits
- Temperature x10: 16 bits
- O2 x10: 16 bits
- Water level: 8 bits
- Transpiration count: 8 bits
- EC pump flag: 1 bit
- pH pump flag: 1 bit
- Circulation flag: 1 bit
- Zero padding to the next byte boundary

Downlinks handled by DMS.py are expected to be 9 bytes long and contain:

- ec_max: 2 bytes
- ec_min: 2 bytes
- ec_set: 2 bytes
- ph_max x10: 1 byte
- ph_min x10: 1 byte
- ph_set x10: 1 byte


KNOWN PATH / ENVIRONMENT MISMATCHES
-----------------------------------
If you run this folder on Windows without adapting paths and hardware access,
parts of the system will fail because the active code assumes Raspberry Pi
Linux deployment. In particular:

- LoRa_run.py expects /dev/ttyAMA0
- DMS.py writes to /home/ohm/Documents/sensor_database.csv
- calibration.py uses /dev/fb1 and /home/ohm image assets
- GPIO, I2C, and pigpio dependencies require Pi hardware or mocks


RECOMMENDED USAGE
-----------------
- Use DMS.py when you want the full integrated greenhouse runtime.
- Use sensors.py directly only for low-level sensor debugging.
- Use calibration.py only on the Pi hardware with the display/buttons attached.
- Treat DCU_PD_loop.py as an alternate controller under development.
- Use Demo_4_Test_Procedures.txt for end-to-end validation.


QUICK START CHECKLIST
---------------------
1. Activate the project virtual environment.
2. Confirm required Python packages are installed.
3. Confirm I2C, GPIO, serial, and framebuffer hardware are available.
4. Verify the RAK3272 credentials in LoRa_run.py.
5. Run DMS.py.
6. Watch console output for sensor polling, LoRa join, and CSV writes.


MAINTENANCE NOTES
-----------------
- If you change the CSV column order, update both init_csv() and
  _load_limits_from_csv() in DMS.py.
- If you change payload packing in DMS.py, update the UI decoder and test notes.
- If you switch to the PD controller, DMS.py must import DCU_PD_loop or the
  logic must be merged into DCU.py.
- Keep Backups/ separate from active source edits to avoid confusion.

================================================================================
