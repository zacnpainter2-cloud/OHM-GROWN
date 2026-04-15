/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm.
 *
 * Adapted from Sveinn Steinarsson's original implementation:
 * https://github.com/sveinn-steinarsson/flot-downsample
 *
 * Academic paper: "Downsampling Time Series for Visual Representation"
 * https://skemman.is/bitstream/1946/15343/3/SS_MSthesis.pdf
 *
 * Selects the most visually significant points from a time series,
 * preserving the shape of the data better than uniform sampling.
 */
export function downsample<T extends { timestamp: number }>(
  data: T[],
  maxPoints: number
): T[] {
  if (data.length <= maxPoints) return data;

  const sampled: T[] = [];
  let sampledIndex = 0;

  // Always include the first point
  sampled[sampledIndex++] = data[0];

  const bucketSize = (data.length - 2) / (maxPoints - 2);

  let a = 0; // Previously selected point

  for (let i = 0; i < maxPoints - 2; i++) {
    // Calculate point average for next bucket (look-ahead)
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.min(
      Math.floor((i + 2) * bucketSize) + 1,
      data.length
    );

    let avgX = 0;
    let avgY = 0;
    const avgRangeLength = avgRangeEnd - avgRangeStart;

    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += data[j].timestamp;
      avgY += (data[j] as any).value ?? 0;
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    // Pick point in current bucket with largest triangle area
    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.min(
      Math.floor((i + 1) * bucketSize) + 1,
      data.length
    );

    const pointAX = data[a].timestamp;
    const pointAY = (data[a] as any).value ?? 0;

    let maxArea = -1;
    let nextA = rangeOffs;

    for (let j = rangeOffs; j < rangeTo; j++) {
      const area = Math.abs(
        (pointAX - avgX) * ((data[j] as any).value ?? 0 - pointAY) -
        (pointAX - data[j].timestamp) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }

    sampled[sampledIndex++] = data[nextA];
    a = nextA;
  }

  // Always include the last point
  sampled[sampledIndex] = data[data.length - 1];

  return sampled;
}
