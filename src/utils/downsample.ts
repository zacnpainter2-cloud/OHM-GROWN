/**
 * Downsample an array to at most `maxPoints` evenly-spaced entries.
 * Keeps the first and last element to preserve the visible range.
 */
export function downsample<T>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;
  const step = (data.length - 1) / (maxPoints - 1);
  const result: T[] = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    result.push(data[Math.round(i * step)]);
  }
  result.push(data[data.length - 1]);
  return result;
}
