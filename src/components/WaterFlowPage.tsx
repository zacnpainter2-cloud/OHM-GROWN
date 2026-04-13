import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Badge } from "./ui/badge";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { useSensorData } from "../hooks/useSensorData";
import { useState, useMemo } from "react";

export function WaterFlowPage() {
  const { readings, latestReading, isLoading } = useSensorData();
  const [timeRange, setTimeRangeState] = useState<"24h" | "7d" | "1m">(() => {
    const saved = localStorage.getItem("hydro-chart-range");
    return saved === "24h" || saved === "7d" || saved === "1m" ? saved : "24h";
  });
  const setTimeRange = (v: "24h" | "7d" | "1m") => { setTimeRangeState(v); localStorage.setItem("hydro-chart-range", v); };

  const rangeMs: Record<string, number> = { "24h": 24*60*60*1000, "7d": 7*24*60*60*1000, "1m": 30*24*60*60*1000 };
  const rangeLabelMap: Record<string, string> = { "24h": "Last 24 Hours", "7d": "Last 7 Days", "1m": "Last 30 Days" };

  const formatXAxis = (ts: number) => {
    if (timeRange === "24h") {
      return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Filter readings by selected time range
  const filteredReadings = useMemo(() => {
    const cutoff = Date.now() - rangeMs[timeRange];
    return readings.filter((r) => r.timestamp >= cutoff);
  }, [readings, timeRange]);

  // Transform sensor readings for the chart (1 = flowing/ok, 0 = no flow/issue)
  const chartData = useMemo(() => {
    return filteredReadings.map(reading => ({
      timestamp: reading.timestamp,
      waterFlow: reading.waterFlowOk ?? 1,
    }));
  }, [filteredReadings]);

  // Compute evenly-spaced ticks for the x-axis
  const chartTicks = useMemo(() => {
    if (chartData.length < 2) return [];
    const min = chartData[0].timestamp;
    const max = chartData[chartData.length - 1].timestamp;
    const count = timeRange === "24h" ? 8 : timeRange === "7d" ? 7 : 10;
    const step = (max - min) / count;
    if (step <= 0) return [min];
    return Array.from({ length: count + 1 }, (_, i) => Math.round(min + step * i));
  }, [chartData, timeRange]);

  // Calculate uptime percentage
  const uptimePercent = useMemo(() => {
    if (filteredReadings.length === 0) return null;
    const flowingCount = filteredReadings.filter((r) => (r.waterFlowOk ?? 1) === 1).length;
    return ((flowingCount / filteredReadings.length) * 100).toFixed(1);
  }, [filteredReadings]);

  // Count flow interruptions (transitions from 1 to 0)
  const interruptionCount = useMemo(() => {
    let count = 0;
    for (let i = 1; i < filteredReadings.length; i++) {
      const prev = filteredReadings[i - 1].waterFlowOk ?? 1;
      const curr = filteredReadings[i].waterFlowOk ?? 1;
      if (prev === 1 && curr === 0) count++;
    }
    return count;
  }, [filteredReadings]);

  // Build a log of flow state changes
  const flowLog = useMemo(() => {
    const log: { timestamp: number; status: "On" | "Off" }[] = [];
    for (let i = 0; i < filteredReadings.length; i++) {
      const curr = (filteredReadings[i].waterFlowOk ?? 1) === 1 ? "On" : "Off";
      if (i === 0 || curr !== log[log.length - 1].status) {
        log.push({ timestamp: filteredReadings[i].timestamp, status: curr });
      }
    }
    return log.slice(0, 200); // cap at 200 entries
  }, [filteredReadings]);

  const currentFlow = latestReading?.waterFlowOk;
  const isFlowing = currentFlow === undefined || currentFlow === 1;

  if (isLoading && readings.length === 0) {
    return <div className="max-w-7xl mx-auto space-y-6">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Time Range Toggle */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">Range:</span>
        <ToggleGroup
          type="single"
          value={timeRange}
          onValueChange={(v) => v && setTimeRange(v as "24h" | "7d" | "1m")}
          size="sm"
        >
          <ToggleGroupItem value="24h">24h</ToggleGroupItem>
          <ToggleGroupItem value="7d">7d</ToggleGroupItem>
          <ToggleGroupItem value="1m">1m</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Water Flow Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
            <CardDescription>Real-time water flow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold">{isFlowing ? "On" : "Off"}</span>
              <Badge variant={isFlowing ? "default" : "destructive"}>
                {isFlowing ? "Flowing" : "No Flow"}
              </Badge>
            </div>
            <div className={`mt-3 w-4 h-4 rounded-full ${isFlowing ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uptime</CardTitle>
            <CardDescription>{rangeLabelMap[timeRange]}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl">{uptimePercent ?? "--"}</span>
              <span className="text-muted-foreground">%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interruptions</CardTitle>
            <CardDescription>{rangeLabelMap[timeRange]}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl">{interruptionCount}</span>
              <span className="text-muted-foreground">events</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Water Flow Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Water Flow Timeline</CardTitle>
          <CardDescription>
            Flow status — {rangeLabelMap[timeRange].toLowerCase()} (1 = On, 0 = Off)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                className="text-xs"
                tickFormatter={formatXAxis}
                ticks={chartTicks}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis
                className="text-xs"
                domain={[-0.1, 1.1]}
                ticks={[0, 1]}
                tickFormatter={(v) => v === 1 ? "On" : "Off"}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))'
                }}
                labelFormatter={(ts) =>
                  new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                }
                formatter={(value: number) => [value === 1 ? "On" : "Off", "Water Flow"]}
              />
              <Legend />
              <Line
                type="stepAfter"
                dataKey="waterFlow"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Water Flow"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Flow State Change Log */}
      <Card>
        <CardHeader>
          <CardTitle>Flow Change Log</CardTitle>
          <CardDescription>
            State transitions — {rangeLabelMap[timeRange].toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flowLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data in selected range.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Time</th>
                    <th className="text-left py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {flowLog.map((entry, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 px-3 tabular-nums">
                        {new Date(entry.timestamp).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={entry.status === "On" ? "default" : "destructive"}>
                          {entry.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
