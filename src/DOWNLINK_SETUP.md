# Downlink Configuration Setup

## Overview
This document describes the 9-byte downlink payload structure for sending control parameters from the dashboard to the Raspberry Pi via AWS IoT → The Things Network.

## Payload Structure (9 bytes total)

| Byte Index | Field | Type | Units | Notes |
|------------|-------|------|-------|-------|
| 0-1 | EC Upper Limit | uint16 (big-endian) | μS/cm | No decimal |
| 2-3 | EC Lower Limit | uint16 (big-endian) | μS/cm | No decimal |
| 4-5 | EC Setpoint | uint16 (big-endian) | μS/cm | No decimal |
| 6 | pH Upper Limit | uint8 | pH × 10 | 1 decimal (e.g., 8.5 → 85) |
| 7 | pH Lower Limit | uint8 | pH × 10 | 1 decimal (e.g., 6.5 → 65) |
| 8 | pH Setpoint | uint8 | pH × 10 | 1 decimal (e.g., 7.0 → 70) |

## Example Payload

**Settings:**
- EC Upper: 1800 μS/cm
- EC Lower: 1200 μS/cm
- EC Setpoint: 1500 μS/cm
- pH Upper: 8.5
- pH Lower: 6.5
- pH Setpoint: 7.0

**Byte Calculation:**
```
EC Upper:    1800 = 0x0708 → [0x07, 0x08]
EC Lower:    1200 = 0x04B0 → [0x04, 0xB0]
EC Setpoint: 1500 = 0x05DC → [0x05, 0xDC]
pH Upper:    8.5 × 10 = 85 = 0x55 → [0x55]
pH Lower:    6.5 × 10 = 65 = 0x41 → [0x41]
pH Setpoint: 7.0 × 10 = 70 = 0x46 → [0x46]
```

**Final Payload (hex):**
```
07 08 04 B0 05 DC 55 41 46
```

**Base64 (for API transmission):**
```
BwgEsAXcVUFG
```

## AWS Lambda Function (Downlink Handler)

Create a new Lambda function called `HydroponicsDownlinkHandler`:

```python
import json
import boto3
import base64
from datetime import datetime

# Initialize AWS IoT client
iot_client = boto3.client('iot-data', region_name='us-east-1')

# The Things Network MQTT topic for downlink
TTN_DOWNLINK_TOPIC = 'lorawan/devices/{device_id}/down/push'

def lambda_handler(event, context):
    """
    Handle downlink configuration requests from the dashboard
    Send 9-byte payload to device via The Things Network
    """
    
    try:
        # Parse request body
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', {})
        
        device_id = body.get('deviceId')
        payload_base64 = body.get('payload')
        
        if not device_id or not payload_base64:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'error': 'Missing deviceId or payload'
                })
            }
        
        # Decode base64 payload
        payload_bytes = base64.b64decode(payload_base64)
        
        # Verify payload is exactly 9 bytes
        if len(payload_bytes) != 9:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({
                    'error': f'Invalid payload size: {len(payload_bytes)} bytes (expected 9)'
                })
            }
        
        # Parse the payload for logging
        ec_upper = (payload_bytes[0] << 8) | payload_bytes[1]
        ec_lower = (payload_bytes[2] << 8) | payload_bytes[3]
        ec_setpoint = (payload_bytes[4] << 8) | payload_bytes[5]
        ph_upper = payload_bytes[6] / 10.0
        ph_lower = payload_bytes[7] / 10.0
        ph_setpoint = payload_bytes[8] / 10.0
        
        print(f"Downlink Configuration:")
        print(f"  Device ID: {device_id}")
        print(f"  EC Upper: {ec_upper} μS/cm")
        print(f"  EC Lower: {ec_lower} μS/cm")
        print(f"  EC Setpoint: {ec_setpoint} μS/cm")
        print(f"  pH Upper: {ph_upper}")
        print(f"  pH Lower: {ph_lower}")
        print(f"  pH Setpoint: {ph_setpoint}")
        print(f"  Payload (hex): {payload_bytes.hex()}")
        print(f"  Payload (base64): {payload_base64}")
        
        # Create TTN downlink message
        ttn_message = {
            'downlinks': [{
                'f_port': 1,
                'frm_payload': payload_base64,
                'priority': 'NORMAL',
                'confirmed': False
            }]
        }
        
        # Publish to The Things Network via AWS IoT Core
        topic = TTN_DOWNLINK_TOPIC.format(device_id=device_id)
        
        response = iot_client.publish(
            topic=topic,
            qos=1,
            payload=json.dumps(ttn_message)
        )
        
        print(f"Published to topic: {topic}")
        print(f"IoT Response: {response}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'success': True,
                'message': 'Configuration sent to device',
                'deviceId': device_id,
                'config': {
                    'ec': {
                        'upper': ec_upper,
                        'lower': ec_lower,
                        'setpoint': ec_setpoint
                    },
                    'ph': {
                        'upper': ph_upper,
                        'lower': ph_lower,
                        'setpoint': ph_setpoint
                    }
                }
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'error': str(e)
            })
        }
```

## API Gateway Setup

### Create `/send-config` Endpoint

1. **Method:** POST
2. **Integration:** Lambda Function (HydroponicsDownlinkHandler)
3. **CORS:** Enabled
4. **No API Key Required**

### Request Body Example:
```json
{
  "deviceId": "256",
  "payload": "BwgEsAXcVUFG",
  "thresholds": {
    "ec": { "upper": 1800, "lower": 1200 },
    "ph": { "upper": 8.5, "lower": 6.5 }
  },
  "setpoints": {
    "ec": 1500,
    "ph": 7.0
  },
  "timestamp": 1708390000000
}
```

### Response Example:
```json
{
  "success": true,
  "message": "Configuration sent to device",
  "deviceId": "256",
  "config": {
    "ec": {
      "upper": 1800,
      "lower": 1200,
      "setpoint": 1500
    },
    "ph": {
      "upper": 8.5,
      "lower": 6.5,
      "setpoint": 7.0
    }
  }
}
```

## Raspberry Pi Decoding (Python)

```python
def decode_downlink(payload_bytes):
    """
    Decode 9-byte downlink configuration payload
    
    Args:
        payload_bytes: bytes object (9 bytes)
    
    Returns:
        dict with parsed configuration
    """
    if len(payload_bytes) != 9:
        raise ValueError(f"Invalid payload size: {len(payload_bytes)} bytes (expected 9)")
    
    # Parse EC values (16-bit, big-endian)
    ec_upper = (payload_bytes[0] << 8) | payload_bytes[1]
    ec_lower = (payload_bytes[2] << 8) | payload_bytes[3]
    ec_setpoint = (payload_bytes[4] << 8) | payload_bytes[5]
    
    # Parse pH values (8-bit, divide by 10)
    ph_upper = payload_bytes[6] / 10.0
    ph_lower = payload_bytes[7] / 10.0
    ph_setpoint = payload_bytes[8] / 10.0
    
    return {
        'ec': {
            'upper': ec_upper,
            'lower': ec_lower,
            'setpoint': ec_setpoint
        },
        'ph': {
            'upper': ph_upper,
            'lower': ph_lower,
            'setpoint': ph_setpoint
        }
    }

# Example usage
payload = bytes.fromhex("070804B005DC554146")
config = decode_downlink(payload)
print(config)
# Output:
# {
#   'ec': {'upper': 1800, 'lower': 1200, 'setpoint': 1500},
#   'ph': {'upper': 8.5, 'lower': 6.5, 'setpoint': 7.0}
# }
```

## Testing the Downlink

### From Browser Console:
```javascript
const testDownlink = async () => {
  const response = await fetch('https://YOUR_API_GATEWAY_URL/send-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: '256',
      payload: 'BwgEsAXcVUFG',
      thresholds: { ec: { upper: 1800, lower: 1200 }, ph: { upper: 8.5, lower: 6.5 } },
      setpoints: { ec: 1500, ph: 7.0 },
      timestamp: Date.now()
    })
  });
  const result = await response.json();
  console.log(result);
};

testDownlink();
```

## Data Flow

```
Dashboard (React)
    ↓ [User clicks "Save All Settings"]
aws-data-service.ts → sendThresholdsAndSetpoints()
    ↓ [Creates 9-byte payload, converts to base64]
API Gateway → /send-config
    ↓ [POST request with base64 payload]
Lambda → HydroponicsDownlinkHandler
    ↓ [Decodes, validates, logs]
AWS IoT Core → lorawan/devices/256/down/push
    ↓ [MQTT message to TTN]
The Things Network
    ↓ [LoRa downlink scheduled]
Raspberry Pi
    ↓ [Receives on next uplink window]
Apply Configuration
```

## Notes

- **FPort:** Use port 1 for downlink
- **Confirmed:** Set to `false` for unconfirmed downlink (faster)
- **Priority:** Set to `NORMAL` unless urgent
- **Scheduling:** Downlink will be sent in the next available downlink window (after next uplink)
- **Max Payload:** LoRaWAN typically allows up to 51 bytes on SF7, but 9 bytes is well within limits
