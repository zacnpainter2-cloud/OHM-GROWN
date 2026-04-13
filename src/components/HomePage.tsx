import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Wrench, Loader2, AlertCircle } from "lucide-react";
import { useUnits } from "./UnitContext";
import { useAlerts } from "./AlertContext";
import { useSensorData } from "../hooks/useSensorData";

export function HomePage() {
  const { tempUnit, waterLevelUnit } = useUnits();
  const { } = useAlerts();
  const { readings, latestReading, isLoading, error } = useSensorData();

  // Convert data based on selected units
  const data = useMemo(() => {
    if (readings.length === 0) return [];
    
    return readings.map(d => ({
      date: new Date(d.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      ec: d.ec,
      ph: d.ph,
      temp: tempUnit === "C" ? d.temperature : (d.temperature * 9 / 5) + 32,
      o2: d.o2,
      waterLevel: waterLevelUnit === "cm" ? d.waterLevel : d.waterLevel / 2.54,
      transpirationRate: d.transpirationRate || 0,
    }));
  }, [readings, tempUnit, waterLevelUnit]);

  // Loading state
  if (isLoading && readings.length === 0) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading sensor data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && readings.length === 0) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <p className="text-lg font-semibold">Failed to load sensor data</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // No data yet state
  if (readings.length === 0) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-semibold">Waiting for sensor data...</p>
          <p className="text-muted-foreground">Data will appear once readings are received</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Water Quality Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EC Graph */}
        <Card>
          <CardHeader>
            <CardTitle>EC (Electrical Conductivity)</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  className="text-xs" 
                  domain={[0, (max: number) => Math.max(1, Math.ceil(max * 1.05))]}
                  tickFormatter={(value) => value.toFixed(0)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                  formatter={(value: number) => [value.toFixed(0) + ' μS/cm', 'EC']}
                />
                <Line 
                  type="monotone" 
                  dataKey="ec" 
                  stroke="#0d9488" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* pH Graph */}
        <Card>
          <CardHeader>
            <CardTitle>pH Level</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  className="text-xs" 
                  domain={[0, (max: number) => Math.ceil(max + 0.5)]}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                  formatter={(value: number) => [value.toFixed(1), 'pH']}
                />
                <Line 
                  type="monotone" 
                  dataKey="ph" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Temperature Graph */}
        <Card>
          <CardHeader>
            <CardTitle>Temperature</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  className="text-xs" 
                  domain={[0, (max: number) => Math.ceil(max + 2)]}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                  formatter={(value: number) => [value.toFixed(1) + ` °${tempUnit}`, 'Temperature']}
                />
                <Line 
                  type="monotone" 
                  dataKey="temp" 
                  stroke="#14b8a6" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Water Level Graph */}
        <Card>
          <CardHeader>
            <CardTitle>Water Level</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  className="text-xs" 
                  domain={[0, (max: number) => Math.max(1, Math.ceil(max * 1.05))]}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                  formatter={(value: number) => [value.toFixed(1) + ` ${waterLevelUnit}`, 'Water Level']}
                />
                <Line 
                  type="monotone" 
                  dataKey="waterLevel" 
                  stroke="#16a34a" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}