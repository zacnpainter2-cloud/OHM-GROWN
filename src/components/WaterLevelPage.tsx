import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Badge } from "./ui/badge";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { useUnits } from "./UnitContext";
import { useSensorData } from "../hooks/useSensorData";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { StatisticsCard } from "./StatisticsCard";
import { useMemo } from "react";
import { useProject } from "./ProjectContext";
import { useThresholds } from "./ThresholdContext";

export function WaterLevelPage() {
  const { waterLevelUnit: unit, setWaterLevelUnit } = useUnits();
  const { viewingProject } = useProject();
  const { thresholds } = useThresholds();
  const { readings, latestReading, isLoading, error } = useSensorData(viewingProject?.id);
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

  // Transform readings for chart display with unit conversion
  const chartData = useMemo(() => {
    return filteredReadings.map((d) => ({
      time: new Date(d.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      level: unit === "cm" ? d.waterLevel : d.waterLevel / 2.54,
      timestamp: d.timestamp
    }));
  }, [filteredReadings, unit]);

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

  // Extract water level values for statistics
  const waterLevelValues = useMemo(() => {
    return filteredReadings.map((r) => unit === "cm" ? r.waterLevel : r.waterLevel / 2.54);
  }, [filteredReadings, unit]);

  const currentLevel = latestReading ? (unit === "cm" ? latestReading.waterLevel : latestReading.waterLevel / 2.54) : null;
  
  const avgLevel = useMemo(() => {
    if (chartData.length === 0) return null;
    const sum = chartData.reduce((acc, d) => acc + d.level, 0);
    return sum / chartData.length;
  }, [chartData]);

  // Calculate 7-day average
  const avg7d = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const sevenDayReadings = readings.filter((r) => r.timestamp >= sevenDaysAgo);
    if (sevenDayReadings.length === 0) return null;
    const sum = sevenDayReadings.reduce((acc, r) => acc + (unit === "cm" ? r.waterLevel : r.waterLevel / 2.54), 0);
    return sum / sevenDayReadings.length;
  }, [readings, unit]);

  const minRange = Number((unit === "cm" ? thresholds.waterLevel.lower : thresholds.waterLevel.lower / 2.54).toFixed(1));
  const maxRange = Number((unit === "cm" ? thresholds.waterLevel.upper : thresholds.waterLevel.upper / 2.54).toFixed(1));

  // Loading state
  if (isLoading && readings.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading data</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const isNormal = currentLevel !== null && currentLevel >= minRange && currentLevel <= maxRange;

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
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Unit:</span>
          <ToggleGroup type="single" value={unit} onValueChange={(value) => value && setWaterLevelUnit(value as "cm" | "in")}>
            <ToggleGroupItem value="cm" aria-label="Centimeters">cm</ToggleGroupItem>
            <ToggleGroupItem value="in" aria-label="Inches">in</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Water Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Water Level</CardTitle>
            <CardDescription>Real-time measurement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl">{currentLevel !== null ? currentLevel.toFixed(1) : "--"}</span>
              <span className="text-slate-500">{unit}</span>
            </div>
            {currentLevel !== null && (
              <Badge className="mt-2" variant={isNormal ? "default" : "destructive"}>
                {isNormal ? "Normal" : "Out of Range"}
              </Badge>
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
              <span className="text-3xl">{avg7d !== null ? avg7d.toFixed(1) : "--"}</span>
              <span className="text-slate-500">{unit}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Target Range</CardTitle>
            <CardDescription>Optimal level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl">{minRange} - {maxRange}</span>
              <span className="text-slate-500">{unit}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Card */}
      <StatisticsCard title="Water Level" data={waterLevelValues} unit={unit} color="blue" decimals={1} rangeLabel={rangeLabelMap[timeRange]} />

      {/* Water Level Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Water Level Monitoring</CardTitle>
          <CardDescription>
            Water level — {rangeLabelMap[timeRange].toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
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
                domain={[0, (max: number) => Math.ceil(max * 1.05)]} 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
                labelFormatter={(ts) =>
                  new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                }
                formatter={(value: number) => [value.toFixed(1) + ` ${unit}`, `Water Level`]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="level" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name={`Water Level (${unit})`}
                dot={filteredReadings.length > 50 ? false : { fill: '#3b82f6', r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}