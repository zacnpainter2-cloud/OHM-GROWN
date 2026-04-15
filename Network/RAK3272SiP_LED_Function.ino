/*
 * RAK3272SiP LoRaWAN LED Status Indicator
 * 
 * This script provides visual feedback for LoRaWAN network status using two LEDs.
 * The module is controlled by a Raspberry Pi Zero via AT commands over serial.
 * 
 * Hardware Configuration:
 *   - LED1 (PA6): Network connection status indicator
 *   - LED2 (PA5): Uplink/downlink activity indicator
 * 
 * LED Behavior:
 *   LED1 - Network Status:
 *     - Blinking (200ms on/off): Not connected to LoRaWAN network
 *     - Solid ON: Successfully joined to LoRaWAN network
 * 
 *   LED2 - Data Activity:
 *     - 3 quick blinks (100ms): Uplink transmission completed
 *     - 5 slow blinks (200ms): Downlink message received from network
 * 
 * Operation:
 *   - LoRaWAN configuration handled by Raspberry Pi via AT commands
 *   - Module monitors internal LoRaWAN stack state
 *   - Callbacks trigger LED feedback for uplink/downlink events
 *   - Main loop continuously monitors network join status
 */

#include <RAKLorawan.h>

#define LEDPIN_1 PA6
#define LEDPIN_2 PA5

void send_cb(int32_t status);
void recv_cb(SERVICE_LORA_RECEIVE_T *data);

void setup() {                     
  pinMode(LEDPIN_1, OUTPUT);
  pinMode(LEDPIN_2, OUTPUT);
  digitalWrite(LEDPIN_1, LOW);
  digitalWrite(LEDPIN_2, LOW);
  api.lorawan.registerSendCallback(send_cb);
  api.lorawan.registerRecvCallback(recv_cb);
}

void loop() {
  // polls for NJS of the module
  // Blink LED1 for module is not connected to a network.
  // LED1 solid when module has joined a network.
  if(api.lorawan.njs.get() == 1){
    digitalWrite(LEDPIN_1, HIGH);
  }
  else {
    digitalWrite(LEDPIN_1,HIGH);
    delay(500);
    digitalWrite(LEDPIN_1, LOW);
    delay(500);
  }
}

void send_cb(int32_t status){
  //LED2 Will blink 3 times quickly when a uplink is sent.
  for(int i = 0; i < 3; i++){
    digitalWrite(LEDPIN_2, HIGH);
    delay(100);
    digitalWrite(LEDPIN_2, LOW);
    delay(100);
  }
}

void recv_cb(SERVICE_LORA_RECEIVE_T *data){
//LED2 Will Blink 5 times slowly when a downlink is received.
  if(data->BufferSize > 0){
    for(int i = 0; i < 5; i++){
      digitalWrite(LEDPIN_2,HIGH);
      delay(200);
      digitalWrite(LEDPIN_2, LOW);
      delay(200);
    }
  }
}
