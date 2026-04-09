/**
 * Formatting utilities for sensor data
 */

/**
 * Format EC value with 2 decimal places
 */
export function formatEC(value: number): string {
  return value.toFixed(2);
}

/**
 * Format pH value with 1 decimal place
 */
export function formatPH(value: number): string {
  return value.toFixed(1);
}

/**
 * Format temperature value with 1 decimal place
 */
export function formatTemperature(value: number): string {
  return value.toFixed(1);
}

/**
 * Format O2 value with 1 decimal place
 */
export function formatO2(value: number): string {
  return value.toFixed(1);
}

/**
 * Format water level with 1 decimal place
 */
export function formatWaterLevel(value: number): string {
  return value.toFixed(1);
}

/**
 * Format transpiration rate with 1 decimal place
 */
export function formatTranspirationRate(value: number): string {
  return value.toFixed(1);
}
