# Zac Painter | ELEC 421 Design
# ─────────────────────────────────────────────────────────────────────
# Responsibilities:
#   - Monitor pH and EC from DMS at a regular interval
#   - Dose pH up solution (base) when pH drops below ph_min
#   - Dose nutrient solution when EC drops below ec_min
#   - pH is always corrected before EC is considered
#   - Uses Atlas Scientific EZO-PMP I2C peristaltic pump modules
# ─────────────────────────────────────────────────────────────────────

import time
import DMS

try:
    from smbus2 import SMBus
except ImportError:
    from smbus import SMBus

# ─────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────

PH_PUMP_ADDR  = 0x67    # EZO-PMP I2C address — pH up (base) pump
EC_PUMP_ADDR  = 0x68    # EZO-PMP I2C address — nutrient pump

DOSE_PH_ML    = 1.0     # mL dispensed per pH correction dose
DOSE_EC_ML    = 5.0     # mL dispensed per EC correction dose
DOSE_RATE_ML  = 0.5     # mL/min — slow rate for dosing accuracy

CIRC_WAIT     = 300    # Seconds to wait after a dose for solution to circulate
POLL_INTERVAL = 300    # Seconds between checks when both values are in range
STARTUP_DELAY = 30      # Seconds to wait at boot for sensors to settle

# ─────────────────────────────────────────────────────────────────────
# EZO-PMP I2C helpers
# ─────────────────────────────────────────────────────────────────────

def _send_command(bus, addr, command):
    """Write an ASCII command string to an EZO-PMP over I2C."""
    cmd_bytes = [ord(c) for c in command]
    bus.write_i2c_block_data(addr, cmd_bytes[0], cmd_bytes[1:])
    time.sleep(0.3)


def _dose(i2c_bus, addr, volume_ml, rate_ml_min=DOSE_RATE_ML):
    command = f"D,{volume_ml:.2f},{rate_ml_min:.2f}"
    with SMBus(i2c_bus) as bus:
        _send_command(bus, addr, command)
# ─────────────────────────────────────────────────────────────────────
# Control loop
# ─────────────────────────────────────────────────────────────────────



def control_loop(pause_event):
    
    print(f"[DCU] Waiting {STARTUP_DELAY}s for sensors to settle...")
    time.sleep(STARTUP_DELAY)
    print("[DCU] Control loop running.")

    while True:
        pause_event.wait()   # block here if calibration is active

        try:
            ph      = DMS.read_ph()
            ec      = DMS.read_ec()
            wl      = DMS.read_water_level()
            ph_min  = DMS.read_ph_min()
            ph_set  = DMS.read_ph_set()
            ec_min  = DMS.read_ec_min()
            ec_set  = DMS.read_ec_set()

            print(f"[DCU] pH_live={ph:.2f}, ec_live={ec:.1f}, wl_live={wl}, ph_min={ph_min}, ph_set={ph_set}, ec_min={ec_min}, ec_set={ec_set}")

            if wl == 0:
                print("[DCU] Water level is 0 — skipping dosing cycle.")
                for _ in range(int(POLL_INTERVAL / 0.1)):
                    if not pause_event.is_set():
                        break
                    time.sleep(0.1)
                continue

            # ── Phase 1: correct pH first (triggered by min, dosed to setpoint) ──
            if ph < ph_min:
                DMS.set_ph_pump(True)
                print(f"[DCU] pH {ph:.2f} below min {ph_min:.2f} — starting pH dosing cycle (target {ph_set:.2f}).")
                while ph < DMS.read_ph_set():
                    pause_event.wait()

                    try:
                        _dose(DMS.I2C_BUS, PH_PUMP_ADDR, DOSE_PH_ML)
                        print(f"[DCU] Dosed {DOSE_PH_ML} mL base. Waiting {CIRC_WAIT}s...")
                    except Exception as e:
                        print(f"[DCU ERROR] pH pump failed: {e}")

                    end_wait = time.time() + CIRC_WAIT
                    while time.time() < end_wait:
                        if not pause_event.is_set():
                            break
                        time.sleep(0.1)

                    pause_event.wait()
                    ph = DMS.read_ph()
                    print(f"[DCU] pH re-read: {ph:.2f} (setpoint {DMS.read_ph_set():.2f})")

                DMS.set_ph_pump(False)
                print(f"[DCU] pH reached setpoint.")

            # ── Phase 2: correct EC (triggered by min, dosed to setpoint) ──
            if ec < ec_min:
                DMS.set_ec_pump(True)
                print(f"[DCU] EC {ec:.1f} below min {ec_min:.1f} — starting EC dosing cycle (target {ec_set:.1f}).")
                while ec < DMS.read_ec_set():
                    pause_event.wait()

                    try:
                        _dose(DMS.I2C_BUS, EC_PUMP_ADDR, DOSE_EC_ML)
                        print(f"[DCU] Dosed {DOSE_EC_ML} mL nutrients. Waiting {CIRC_WAIT}s...")
                    except Exception as e:
                        print(f"[DCU ERROR] EC pump failed: {e}")

                    end_wait = time.time() + CIRC_WAIT
                    while time.time() < end_wait:
                        if not pause_event.is_set():
                            break
                        time.sleep(0.1)

                    pause_event.wait()
                    ec = DMS.read_ec()
                    print(f"[DCU] EC re-read: {ec:.1f} (setpoint {DMS.read_ec_set():.1f})")

                DMS.set_ec_pump(False)
                print(f"[DCU] EC reached setpoint.")

            # ── Idle ──
            print(f"[DCU] Both values at setpoint — idling {POLL_INTERVAL}s.")
            end_idle = time.time() + POLL_INTERVAL
            while time.time() < end_idle:
                if not pause_event.is_set():
                    break
                time.sleep(0.1)

        except Exception as e:
            print(f"[DCU ERROR] Unhandled exception: {e}")
            # Safety: clear pump flags on error so they don't get stuck
            DMS.set_ph_pump(False)
            DMS.set_ec_pump(False)
            end_err = time.time() + POLL_INTERVAL
            while time.time() < end_err:
                if not pause_event.is_set():
                    break
                time.sleep(0.1)
