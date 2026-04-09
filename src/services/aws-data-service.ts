/**
 * AWS Data Service
 * Handles all communication with AWS API Gateway and IoT Core
 */

import { AWS_CONFIG } from '../config/aws-config';
import type { SensorReading, ThresholdValues, ApiResponse, SensorDataResponse } from '../types/sensor-data';

/**
 * Fetch sensor data from DynamoDB via API Gateway
 * Note: Since we only have /latest endpoint, we return single reading
 * Historical data will be built up over time by the useSensorData hook
 * @param startTime - Start timestamp (optional)
 * @param endTime - End timestamp (optional)
 * @returns Promise with sensor readings
 */
export async function fetchSensorData(
  startTime?: number,
  endTime?: number
): Promise<ApiResponse<SensorDataResponse>> {
  try {
    const latestResponse = await fetchLatestReading();
    
    if (!latestResponse.success || !latestResponse.data) {
      return {
        success: false,
        error: latestResponse.error || 'Failed to fetch latest reading',
      };
    }

    return {
      success: true,
      data: {
        readings: [latestResponse.data], // Return single reading in array
        lastUpdated: Date.now(),
      },
    };
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Fetch the latest sensor reading
 */
export async function fetchLatestReading(): Promise<ApiResponse<SensorReading>> {
  try {
    const url = `${AWS_CONFIG.API_GATEWAY_URL}/devices/${AWS_CONFIG.DEVICE_ID}/latest`;
    
    console.log('Fetching from:', url); // Debug log
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    console.log('AWS Response (full):', JSON.stringify(data, null, 2)); // Detailed debug log
    
    // Handle case where no telemetry data exists yet
    if (!data.latestTelemetry) {
      console.warn('⚠️ No telemetry data available for this device yet');
      return {
        success: false,
        error: 'No sensor data available yet. Waiting for first reading from device.',
      };
    }
    
    // Parse the AWS response format
    const parsed = data.latestTelemetry?.parsed;
    if (!parsed) {
      console.error('Response structure:', {
        hasLatestTelemetry: !!data.latestTelemetry,
        hasParsed: !!parsed,
        keys: Object.keys(data),
        latestTelemetryKeys: data.latestTelemetry ? Object.keys(data.latestTelemetry) : null
      });
      throw new Error('Invalid response format: missing parsed data. Check console for response structure.');
    }
    
    console.log('Parsed data:', parsed);
    
    // Extract server timestamp from response - check all common field names
    const rawTs =
      data.latestTelemetry?.ts ??
      data.latestTelemetry?.receivedAt ??
      data.latestTelemetry?.ReceivedAt ??
      data.latestTelemetry?.timestamp ??
      data.ts ??
      data.receivedAt ??
      data.timestamp;

    let timestamp: number;
    if (rawTs != null) {
      const parsedTs = typeof rawTs === 'string' ? new Date(rawTs).getTime() : Number(rawTs);
      // Auto-detect seconds vs milliseconds (values < 1e12 are likely seconds)
      timestamp = parsedTs < 1e12 ? parsedTs * 1000 : parsedTs;
    } else {
      console.warn('⚠️ No server timestamp found in response. Keys in latestTelemetry:',
        Object.keys(data.latestTelemetry || {}), 'Top-level keys:', Object.keys(data));
      timestamp = Date.now();
    }
    
    // Apply scaling factors and convert to SensorReading format
    const reading: SensorReading = {
      deviceId: data.deviceID || AWS_CONFIG.DEVICE_ID,
      timestamp,
      ec: parsed.ec_u16 || parsed.eh_u16 || parsed.ec_u8 || 0, // μS/cm - no decimal, read as-is (16-bit)
      ph: (parsed.ph_u8 || 0) / 10, // pH - divide by 10 (1 decimal)
      temperature: (parsed.temp_i16 || 0) / 10, // °C - divide by 10 (1 decimal)
      o2: (parsed.o2_u16 || 0) / 10, // % - divide by 10 (1 decimal, now 16-bit)
      waterLevel: (parsed.waterLevel_u8 || 0) / 10, // cm - divide by 10 (1 decimal)
      transpirationRate: parsed.transpiration_u8 || 0, // L/m²/day - read as-is (no decimals)
      ecDosingFlag: parsed.ecDosing ? 1 : 0, // Convert boolean to 0/1
      phDosingFlag: parsed.phDosing ? 1 : 0, // Convert boolean to 0/1
      waterFlowOk: parsed.waterFlowOk ? 1 : 0, // Convert boolean to 0/1
    };

    // Reject readings where critical sensor values are all zero (bad/incomplete payload)
    if (reading.temperature === 0 && reading.ph === 0 && reading.ec === 0) {
      console.warn('⚠️ Rejecting reading with all-zero critical values (likely bad payload):', parsed);
      return {
        success: false,
        error: 'Invalid sensor reading: all critical values are zero',
      };
    }

    console.log('Final reading:', reading);

    return {
      success: true,
      data: reading,
    };
  } catch (error) {
    console.error('Error fetching latest reading:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Send threshold values back to microcontroller via AWS IoT
 * @param thresholds - Threshold values to send
 */
export async function sendThresholds(thresholds: ThresholdValues): Promise<ApiResponse<void>> {
  try {
    const url = `${AWS_CONFIG.API_GATEWAY_URL}/send-thresholds`;
    
    const payload = {
      topic: AWS_CONFIG.IOT_TOPIC,
      deviceId: AWS_CONFIG.DEVICE_ID,
      thresholds: thresholds,
      timestamp: Date.now(),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AWS_CONFIG.API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send thresholds: ${response.status}`);
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error sending thresholds:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

interface SetpointValues {
  ec: number;
  ph: number;
}

interface CombinedThresholdValues {
  ec: { lower: number; upper: number };
  ph: { lower: number; upper: number };
  temperature: { lower: number; upper: number };
  o2: { lower: number; upper: number };
  waterLevel: { lower: number; upper: number };
}

/**
 * Send thresholds and setpoints to the microcontroller via AWS IoT
 * @param thresholds - Threshold values to send
 * @param setpoints - Setpoint values to send
 */
export async function sendThresholdsAndSetpoints(
  thresholds: CombinedThresholdValues,
  setpoints: SetpointValues
): Promise<ApiResponse<void>> {
  try {
    // Create 9-byte payload:
    // EC upper limit (2 bytes), EC lower limit (2 bytes), EC setpoint (2 bytes)
    // pH upper limit (1 byte), pH lower limit (1 byte), pH setpoint (1 byte)
    
    // EC values are in μS/cm (no decimal) - use 16-bit unsigned integers
    const ecUpper = Math.round(thresholds.ec.upper);
    const ecLower = Math.round(thresholds.ec.lower);
    const ecSetpoint = Math.round(setpoints.ec);
    
    // pH values need to be multiplied by 10 - use 8-bit unsigned integers
    const phUpper = Math.round(thresholds.ph.upper * 10);
    const phLower = Math.round(thresholds.ph.lower * 10);
    const phSetpoint = Math.round(setpoints.ph * 10);
    
    // Create byte array
    const payload = new Uint8Array(9);
    
    // EC upper limit (bytes 0-1, big-endian)
    payload[0] = (ecUpper >> 8) & 0xFF;
    payload[1] = ecUpper & 0xFF;
    
    // EC lower limit (bytes 2-3, big-endian)
    payload[2] = (ecLower >> 8) & 0xFF;
    payload[3] = ecLower & 0xFF;
    
    // EC setpoint (bytes 4-5, big-endian)
    payload[4] = (ecSetpoint >> 8) & 0xFF;
    payload[5] = ecSetpoint & 0xFF;
    
    // pH upper limit (byte 6)
    payload[6] = phUpper & 0xFF;
    
    // pH lower limit (byte 7)
    payload[7] = phLower & 0xFF;
    
    // pH setpoint (byte 8)
    payload[8] = phSetpoint & 0xFF;
    
    // Convert to base64 for transmission
    const base64Payload = btoa(String.fromCharCode(...payload));
    
    console.log('Downlink payload:', {
      ec: { upper: ecUpper, lower: ecLower, setpoint: ecSetpoint },
      ph: { upper: phUpper / 10, lower: phLower / 10, setpoint: phSetpoint / 10 },
      bytes: Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join(' '),
      base64: base64Payload
    });
    
    const url = `${AWS_CONFIG.API_GATEWAY_URL}/send-config`;
    
    const requestPayload = {
      deviceId: AWS_CONFIG.WIRELESS_DEVICE_ID, // Use the AWS IoT Wireless UUID, not data device ID
      payload: base64Payload,
      thresholds: thresholds,
      setpoints: setpoints,
      timestamp: Date.now(),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Send config error:', errorText);
      throw new Error(`Failed to send configuration: ${response.status}`);
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error sending configuration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Fetch all sensor readings from DynamoDB between two timestamps (in seconds).
 * Used to backfill Supabase with data recorded while the website was closed.
 */
export async function fetchReadingsFromDynamo(
  startTimeSec: number,
  endTimeSec: number
): Promise<ApiResponse<SensorReading[]>> {
  try {
    const url = `${AWS_CONFIG.API_GATEWAY_URL}/query?deviceID=${AWS_CONFIG.DEVICE_ID}&startTime=${startTimeSec}&endTime=${endTimeSec}`;

    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DynamoDB query failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.telemetry || data.telemetry.length === 0) {
      return { success: true, data: [] };
    }

    const readings: SensorReading[] = data.telemetry
      .map((item: any) => {
        const parsed = item.parsed || {};
        return {
          deviceId: item.deviceID || AWS_CONFIG.DEVICE_ID,
          timestamp: item.ts * 1000,
          ec: parsed.ec_u16 || parsed.eh_u16 || parsed.ec_u8 || 0,
          ph: (parsed.ph_u8 || 0) / 10,
          temperature: (parsed.temp_i16 || 0) / 10,
          o2: (parsed.o2_u16 || 0) / 10,
          waterLevel: (parsed.waterLevel_u8 || 0) / 10,
          transpirationRate: parsed.transpiration_u8 || 0,
          ecDosingFlag: parsed.ecDosing ? 1 : 0,
          phDosingFlag: parsed.phDosing ? 1 : 0,
          waterFlowOk: parsed.waterFlowOk ? 1 : 0,
        };
      })
      .filter((r: SensorReading) => !(r.temperature === 0 && r.ph === 0 && r.ec === 0));

    return { success: true, data: readings };
  } catch (error) {
    console.error('Error fetching readings from DynamoDB:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Fetch sensor data for a specific date range (for export functionality)
 */
export async function fetchSensorDataForExport(
  startDate: Date,
  endDate: Date,
  parameters: string[]
): Promise<ApiResponse<SensorReading[]>> {
  try {
    // Set endDate to end of day (23:59:59) to include all data from that day
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Convert dates to Unix timestamps (seconds)
    const startTime = Math.floor(startDate.getTime() / 1000);
    const endTime = Math.floor(endOfDay.getTime() / 1000);
    
    // Use /query endpoint with deviceID as query parameter
    const url = `${AWS_CONFIG.API_GATEWAY_URL}/query?deviceID=${AWS_CONFIG.DEVICE_ID}&startTime=${startTime}&endTime=${endTime}`;
    
    console.log('Fetching export data from:', url);
    console.log('Date range:', startDate.toISOString(), 'to', endOfDay.toISOString());
    console.log('Unix timestamps:', startTime, 'to', endTime);
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Export API Error:', errorText);
      throw new Error(`Failed to fetch export data: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('Export data received:', data.count, 'records');
    
    if (!data.telemetry || data.telemetry.length === 0) {
      return {
        success: true,
        data: [],
      };
    }
    
    // Transform DynamoDB records to SensorReading format, filtering out bad payloads
    const readings: SensorReading[] = data.telemetry
      .map((item: any) => {
        const parsed = item.parsed || {};
      
        return {
          deviceId: item.deviceID || AWS_CONFIG.DEVICE_ID,
          timestamp: item.ts * 1000, // Convert to milliseconds
          ec: parsed.ec_u16 || parsed.eh_u16 || parsed.ec_u8 || 0,
          ph: (parsed.ph_u8 || 0) / 10,
          temperature: (parsed.temp_i16 || 0) / 10,
          o2: (parsed.o2_u16 || 0) / 10,
          waterLevel: (parsed.waterLevel_u8 || 0) / 10, // cm - divide by 10 (1 decimal)
          transpirationRate: parsed.transpiration_u8 || 0, // L/m²/day - read as-is (no decimals)
          ecDosingFlag: parsed.ecDosing ? 1 : 0, // Convert boolean to 0/1
          phDosingFlag: parsed.phDosing ? 1 : 0, // Convert boolean to 0/1
          waterFlowOk: parsed.waterFlowOk ? 1 : 0, // Convert boolean to 0/1
        };
      })
      .filter((r: SensorReading) => !(r.temperature === 0 && r.ph === 0 && r.ec === 0));
    
    // Filter to only include selected parameters (for efficiency)
    // Note: We still return all readings, just filter columns if needed later
    
    console.log('Transformed', readings.length, 'readings for export');
    
    return {
      success: true,
      data: readings,
    };
  } catch (error) {
    console.error('Error fetching export data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}