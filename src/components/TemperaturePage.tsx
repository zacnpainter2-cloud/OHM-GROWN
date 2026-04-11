import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Badge } from "./ui/badge";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { useSensorData } from "../hooks/useSensorData";
import { useUnits } from "./UnitContext";
import { useState, useMemo } from "react";
import { StatisticsCard } from "./StatisticsCard";
import { useProject } from "./ProjectContext";

export function TemperaturePage() {
  const { viewingProject } = useProject();
  const { readings, latestReading, isLoading } = useSensorData(viewingProject?.id);
  const { tempUnit, setTempUnit } = useUnits();
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
  
  // Convert temperature based on unit (sensor sends Celsius)
  const convertTemp = (tempC: number) => {
    return tempUnit === "F" ? (tempC * 9 / 5) + 32 : tempC;
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
      temp: convertTemp(reading.temperature),
      timestamp: reading.timestamp,
    }));
  }, [filteredReadings, tempUnit]);

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
  
  // Calculate 24h average
  const average24h = useMemo(() => {
    if (filteredReadings.length === 0) return null;
    const sum = filteredReadings.reduce((acc, r) => acc + r.temperature, 0);
    return (sum / filteredReadings.length).toFixed(1);
  }, [filteredReadings]);

  // Calculate 7-day average
  const average7d = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const sevenDayReadings = readings.filter((r) => r.timestamp >= sevenDaysAgo);
    if (sevenDayReadings.length === 0) return null;
    const sum = sevenDayReadings.reduce((acc, r) => acc + r.temperature, 0);
    return (sum / sevenDayReadings.length).toFixed(1);
  }, [readings]);

  // Extract temperature values for statistics
  const tempValues = useMemo(() => {
    return filteredReadings.map((r) => r.temperature);
  }, [filteredReadings]);
  
  const currentTemp = latestReading ? convertTemp(latestReading.temperature) : null;
  
  // Determine status based on typical range
  const getStatus = (value: number) => {
    // Convert to Fahrenheit for comparison if needed
    const tempF = tempUnit === "F" ? value : (value * 9 / 5) + 32;
    if (tempF < 65 || tempF > 80) return { label: "Warning", variant: "destructive" as const };
    if (tempF < 68 || tempF > 78) return { label: "Caution", variant: "secondary" as const };
    return { label: "Normal", variant: "default" as const };
  };
  
  const status = currentTemp !== null ? getStatus(currentTemp) : null;
  
  const optimalRange = tempUnit === "C" ? "18 - 26" : "65 - 78";
  
  if (isLoading && readings.length === 0) {
    return <div className="max-w-7xl mx-auto space-y-6">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Unit & Range Toggles */}
      <div className="flex items-center justify-end gap-4">
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Unit:</span>
          <ToggleGroup
            type="single"
            value={tempUnit}
            onValueChange={(value) => value && setTempUnit(value as "F" | "C")}
            size="sm"
          >
            <ToggleGroupItem value="F" aria-label="Fahrenheit">
              °F
            </ToggleGroupItem>
            <ToggleGroupItem value="C" aria-label="Celsius">
              °C
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Temperature Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Temperature</CardTitle>
            <CardDescription>Real-time measurement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl">{currentTemp !== null ? currentTemp.toFixed(1) : "--"}</span>
              <span className="text-muted-foreground">°{tempUnit}</span>
            </div>
            {status && <Badge className="mt-2" variant={status.variant}>{status.label}</Badge>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7-Day Average</CardTitle>
            <CardDescription>Weekly average</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl">{average7d !== null ? convertTemp(parseFloat(average7d)).toFixed(1) : "--"}</span>
              <span className="text-muted-foreground">°{tempUnit}</span>
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
              <span className="text-3xl">{optimalRange}</span>
              <span className="text-muted-foreground">°{tempUnit}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Card */}
      <StatisticsCard title="Temperature" data={tempValues} unit={`°${tempUnit}`} color="red" decimals={1} rangeLabel={rangeLabelMap[timeRange]} />

      {/* Temperature Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Temperature Monitoring</CardTitle>
          <CardDescription>
            Water temperature — {rangeLabelMap[timeRange].toLowerCase()}
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
              <YAxis className="text-xs" domain={[0, (max: number) => Math.ceil(max + 2)]} />
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
              <Line 
                type="monotone" 
                dataKey="temp" 
                stroke="#ef4444" 
                strokeWidth={2}
                name={`Temperature (°${tempUnit})`}
                dot={filteredReadings.length > 50 ? false : { fill: '#ef4444', r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}