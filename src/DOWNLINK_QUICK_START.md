# Downlink Implementation Summary

## ✅ What's Been Done

### 1. Dashboard Frontend (Complete)
- **File:** `/services/aws-data-service.ts`
- **Function:** `sendThresholdsAndSetpoints()`
- **What it does:**
  - Creates a 9-byte payload:
    - Bytes 0-1: EC Upper Limit (uint16, big-endian)
    - Bytes 2-3: EC Lower Limit (uint16, big-endian)
    - Bytes 4-5: EC Setpoint (uint16, big-endian)
    - Byte 6: pH Upper Limit (uint8, × 10)
    - Byte 7: pH Lower Limit (uint8, × 10)
    - Byte 8: pH Setpoint (uint8, × 10)
  - Converts to base64
  - Sends POST request to `/send-config` endpoint
  - Logs detailed payload info to browser console

### 2. Controls UI (Already Working)
- **File:** `/components/ThresholdPage.tsx`
- **Features:**
  - Setpoints for EC and pH
  - Threshold boundaries for all parameters
  - "Save All Settings" button triggers the downlink
  - Toast notifications for success/error

### 3. Documentation (Complete)
- **File:** `/DOWNLINK_SETUP.md`
- Includes:
  - Payload structure table
  - Example calculations
  - Complete Lambda function code
  - API Gateway setup instructions
  - Raspberry Pi decoding code (Python)
  - Testing instructions
  - Data flow diagram

## 🔧 What You Need to Do

### Step 1: Create Lambda Function
1. Go to AWS Lambda Console
2. Create new function: `HydroponicsDownlinkHandler`
3. Runtime: Python 3.12
4. Copy code from `/DOWNLINK_SETUP.md` (lines 50-150)
5. Add IAM permissions:
   ```json
   {
     "Effect": "Allow",
     "Action": "iot:Publish",
     "Resource": "arn:aws:iot:us-east-1:YOUR_ACCOUNT:topic/lorawan/devices/*/down/push"
   }
   ```

### Step 2: Create API Gateway Endpoint
1. Go to API Gateway Console
2. Select your existing API
3. Create resource: `/send-config`
4. Create method: `POST`
5. Integration type: Lambda Function
6. Select `HydroponicsDownlinkHandler`
7. Enable CORS
8. Deploy to your stage

### Step 3: Update IoT Topic (if needed)
Make sure the Lambda publishes to the correct topic for The Things Network:
```
lorawan/devices/256/down/push
```

### Step 4: Test the Flow

#### From Dashboard:
1. Go to Controls page
2. Set EC Setpoint: 1500 μS/cm
3. Set pH Setpoint: 7.0
4. Click "Save All Settings"
5. Check browser console for payload details
6. Should see success toast

#### Check CloudWatch:
1. Go to Lambda → HydroponicsDownlinkHandler → Monitor → Logs
2. Look for log output showing parsed configuration
3. Verify payload bytes are correct

#### From Browser Console (Manual Test):
```javascript
const testPayload = {
  deviceId: '256',
  payload: 'BwgEsAXcVUFG', // Example: EC 1800/1200/1500, pH 8.5/6.5/7.0
  thresholds: {
    ec: { upper: 1800, lower: 1200 },
    ph: { upper: 8.5, lower: 6.5 }
  },
  setpoints: { ec: 1500, ph: 7.0 },
  timestamp: Date.now()
};

fetch('https://zwk6rwl4li.execute-api.us-east-1.amazonaws.com/send-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testPayload)
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## 📊 Example Payload

**Input Values:**
- EC Upper: 1800 μS/cm
- EC Lower: 1200 μS/cm
- EC Setpoint: 1500 μS/cm
- pH Upper: 8.5
- pH Lower: 6.5
- pH Setpoint: 7.0

**Generated Payload:**
```
Hex:    07 08 04 B0 05 DC 55 41 46
Base64: BwgEsAXcVUFG
```

**Browser Console Output:**
```javascript
Downlink payload: {
  ec: { upper: 1800, lower: 1200, setpoint: 1500 },
  ph: { upper: 8.5, lower: 6.5, setpoint: 7.0 },
  bytes: "07 08 04 b0 05 dc 55 41 46",
  base64: "BwgEsAXcVUFG"
}
```

## 🔄 Data Flow

```
User enters values on Controls page
          ↓
Clicks "Save All Settings"
          ↓
sendThresholdsAndSetpoints() creates 9-byte payload
          ↓
POST to /send-config with base64 payload
          ↓
API Gateway triggers Lambda
          ↓
Lambda validates and publishes to IoT Core
          ↓
IoT Core forwards to The Things Network
          ↓
TTN schedules downlink (sent after next uplink)
          ↓
Raspberry Pi receives configuration
          ↓
Pi decodes and applies new settings
```

## 🐛 Troubleshooting

### Dashboard shows error toast
- Check browser console for detailed error
- Verify API Gateway URL in `/config/aws-config.ts`
- Check Network tab in DevTools for HTTP status

### Lambda not receiving requests
- Verify API Gateway integration is set correctly
- Check API Gateway logs in CloudWatch
- Ensure CORS is enabled

### IoT message not sent
- Check Lambda CloudWatch logs for errors
- Verify IAM permissions for iot:Publish
- Confirm topic name matches TTN format

### Raspberry Pi not receiving downlink
- Check TTN console for scheduled downlinks
- Verify device is sending uplinks (downlink window only after uplink)
- Check LoRaWAN duty cycle limits
- Verify FPort matches on both sides (port 1)

## 📝 Notes

- **Downlink Timing:** LoRaWAN devices can only receive downlinks immediately after an uplink. Since your device transmits every 5 minutes, the downlink will be queued and sent at the next opportunity.
- **Byte Order:** EC values use big-endian (MSB first)
- **pH Scaling:** pH values are multiplied by 10 to preserve 1 decimal place in a single byte
- **Validation:** Lambda validates payload is exactly 9 bytes before sending

## ✨ Ready to Deploy!

The dashboard is fully configured and ready to send downlinks. Just follow the 4 steps above to set up the AWS backend, and you'll be able to remotely configure your hydroponics system! 🚀
