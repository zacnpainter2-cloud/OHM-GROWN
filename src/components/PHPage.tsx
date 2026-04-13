import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { Badge } from "./ui/badge";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { useSharedSensorData } from "./SensorDataContext";
import { useState, useMemo } from "react";
import { StatisticsCard } from "./StatisticsCard";
import { useThresholds } from "./ThresholdContext";

export function PHPage() {
  const { thresholds } = useThresholds();
  const { readings, latestReading, isLoading } = useSharedSensorData();
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
  
  // Transform sensor readings for the chart
  const chartData = useMemo(() => {
    return filteredReadings.map(reading => ({
      time: new Date(reading.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      ph: reading.ph,
      timestamp: reading.timestamp,
      phDosing: reading.phDosingFlag === 1, // Convert from number to boolean
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

  // Detect pH dosing start/stop events
  const dosingEvents = useMemo(() => {
    const events: Array<{ time: string; type: 'start' | 'stop'; timestamp: number }> = [];
    
    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1];
      const curr = chartData[i];
      
      // Dosing started
      if (!prev.phDosing && curr.phDosing) {
        events.push({ time: curr.time, type: 'start', timestamp: curr.timestamp });
      }
      // Dosing stopped
      if (prev.phDosing && !curr.phDosing) {
        events.push({ time: curr.time, type: 'stop', timestamp: curr.timestamp });
      }
    }
    
    return events;
  }, [chartData]);
  
  // Calculate 7-day average
  const average7d = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const sevenDayReadings = readings.filter((r) => r.timestamp >= sevenDaysAgo);
    if (sevenDayReadings.length === 0) return null;
    const sum = sevenDayReadings.reduce((acc, r) => acc + r.ph, 0);
    return (sum / sevenDayReadings.length).toFixed(1);
  }, [readings]);

  // Extract pH values for statistics
  const phValues = useMemo(() => {
    return filteredReadings.map((r) => r.ph);
  }, [filteredReadings]);
  
  const currentPH = latestReading?.ph ?? null;
  
  // Determine status based on typical range
  const getStatus = (value: number) => {
    if (value < 5.5 || value > 8.5) return { label: "Warning", variant: "destructive" as const };
    if (value < 6.0 || value > 7.5) return { label: "Caution", variant: "secondary" as const };
    return { label: "Normal", variant: "default" as const };
  };
  
  const status = currentPH !== null ? getStatus(currentPH) : null;
  
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

      {/* pH Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current pH</CardTitle>
            <CardDescription>Real-time measurement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl">{currentPH !== null ? currentPH.toFixed(1) : "--"}</span>
              <span className="text-muted-foreground">pH</span>
            </div>
            {status && <Badge className="mt-2" variant={status.variant}>{status.label}</Badge>}
            {latestReading?.phDosingFlag === 1 && (
              <Badge className="mt-2 ml-2 bg-cyan-500">Dosing Active</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7-Day Average</CardTitle>
            <CardDescription>Weekly average</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl">{average7d ?? "--"}</span>
              <span className="text-muted-foreground">pH</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Optimal Range</CardTitle>
            <CardDescription>Target values</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl">{thresholds.ph.lower} - {thresholds.ph.upper}</span>
              <span className="text-muted-foreground">pH</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Card */}
      <StatisticsCard title="pH" data={phValues} unit="" color="cyan" decimals={1} rangeLabel={rangeLabelMap[timeRange]} />

      {/* pH Chart */}
      <Card>
        <CardHeader>
          <CardTitle>pH Monitoring</CardTitle>
          <CardDescription>
            pH level — {rangeLabelMap[timeRange].toLowerCase()}. Vertical lines show dosing start (green) and stop (red).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
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
              <YAxis className="text-xs" domain={[0, (max: number) => Math.ceil(max + 0.5)]} />
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
              />
              <Legend />
              
              {/* Dosing start lines (green) */}
              {dosingEvents.filter(e => e.type === 'start').map((event, idx) => (
                <ReferenceLine
                  key={`start-${idx}`}
                  x={event.timestamp}
                  stroke="#10b981"
                  strokeWidth={2}
                  label={{ value: 'Start', position: 'top', fill: '#10b981', fontSize: 12 }}
                />
              ))}
              
              {/* Dosing stop lines (red) */}
              {dosingEvents.filter(e => e.type === 'stop').map((event, idx) => (
                <ReferenceLine
                  key={`stop-${idx}`}
                  x={event.timestamp}
                  stroke="#ef4444"
                  strokeWidth={2}
                  label={{ value: 'Stop', position: 'top', fill: '#ef4444', fontSize: 12 }}
                />
              ))}
              
              <Line 
                type="monotone" 
                dataKey="ph" 
                stroke="#06b6d4" 
                strokeWidth={2}
                name="pH Level"
                dot={filteredReadings.length > 50 ? false : { fill: '#06b6d4', r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}