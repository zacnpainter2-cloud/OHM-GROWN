/**
 * AWS Configuration
 * 
 * INSTRUCTIONS:
 * 1. Replace API_GATEWAY_URL with your actual API Gateway endpoint
 * 2. Replace API_KEY with your actual API Gateway key
 * 3. Replace AWS_REGION with your AWS region (e.g., 'us-east-1')
 * 4. Update IOT_TOPIC with your actual IoT topic for sending setpoints
 */

export const AWS_CONFIG = {
  // API Gateway endpoint for fetching sensor data
  API_GATEWAY_URL: 'https://zwk6rwl4li.execute-api.us-east-1.amazonaws.com',
  
  // API Key for authentication (not required for this endpoint)
  API_KEY: '',
  
  // AWS Region
  AWS_REGION: 'us-east-1',
  
  // IoT Topic for sending setpoints back to microcontroller
  IOT_TOPIC: 'greenhouse/setpoints',
  
  // Device ID for data payload (used in sensor readings)
  DEVICE_ID: '256',
  
  // AWS IoT Wireless Device UUID (used for downlink commands)
  WIRELESS_DEVICE_ID: '1e2c5735-6650-4c5d-bea0-a5eb45050aed',
  
  // Data refresh interval in milliseconds (30 seconds = 30000)
  // Sensor data is sent every 5 minutes, polling every 30 seconds for faster updates
  REFRESH_INTERVAL: 10000,
};