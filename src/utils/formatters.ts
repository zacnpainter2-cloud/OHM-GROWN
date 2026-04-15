/**
 * Formatting utilities for sensor data.
 *
 * Uses the ECMAScript Internationalization API (Intl.NumberFormat) for
 * locale-aware number formatting.
 *
 * Reference: MDN Web Docs — Intl.NumberFormat
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
 *
 * Spec: ECMA-402 Internationalization API Specification
 * https://tc39.es/ecma402/#numberformat-objects
 */

const fmt = (value: number, fractionDigits: number): string =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);

/** Format EC value — 2 decimal places (μS/cm) */
export function formatEC(value: number): string {
  return fmt(value, 2);
}

/** Format pH value — 1 decimal place */
export function formatPH(value: number): string {
  return fmt(value, 1);
}

/** Format temperature value — 1 decimal place (°C or °F) */
export function formatTemperature(value: number): string {
  return fmt(value, 1);
}

/** Format dissolved oxygen — 1 decimal place (%) */
export function formatO2(value: number): string {
  return fmt(value, 1);
}

/** Format water level — 1 decimal place (cm or inches) */
export function formatWaterLevel(value: number): string {
  return fmt(value, 1);
}

/** Format transpiration rate — 1 decimal place (L/m²/day) */
export function formatTranspirationRate(value: number): string {
  return fmt(value, 1);
}
