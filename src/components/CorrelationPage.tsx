import { useMemo, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { useSharedSensorData } from "./SensorDataContext";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ZAxis } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, GitCompare, Activity, CalendarIcon, Download, Image as ImageIcon } from "lucide-react";
import { TimeRangeControls, TimeRange, ComparisonPeriod } from "./TimeRangeControls";
import { format } from "date-fns";
import domtoimage from "dom-to-image-more";
import React from "react";

type ParameterKey = "ec" | "pH" | "temp" | "o2" | "waterLevel" | "transpiration";

interface CorrelationData {
  param1: ParameterKey;
  param2: ParameterKey;
  coefficient: number;
  strength: string;
  interpretation: string;
}

const PARAMETER_LABELS: Record<ParameterKey, string> = {
  ec: "EC",
  pH: "pH",
  temp: "Temperature",
  o2: "O2",
  waterLevel: "Water Level",
  transpiration: "Transpiration",
};

const PARAMETER_UNITS: Record<ParameterKey, string> = {
  ec: "μS/cm",
  pH: "",
  temp: "°F",
  o2: "mg/L",
  waterLevel: "inches",
  transpiration: "rate",
};

export function CorrelationPage() {
  const { readings } = useSharedSensorData();
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [comparisonPeriod, setComparisonPeriod] = useState<ComparisonPeriod>("none");
  const [selectedParam1, setSelectedParam1] = useState<ParameterKey>("ec");
  const [selectedParam2, setSelectedParam2] = useState<ParameterKey>("pH");
  const [lagMinutes, setLagMinutes] = useState<number>(0);
  
  // Primary custom date range
  const [primaryDateRange, setPrimaryDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  // Comparison custom date range
  const [comparisonDateRange, setComparisonDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  // Date validation
  const primaryDateError = useMemo(() => {
    if (!primaryDateRange.from || !primaryDateRange.to) return null;
    if (primaryDateRange.from > primaryDateRange.to) {
      return "Start date must be before end date";
    }
    return null;
  }, [primaryDateRange]);

  const comparisonDateError = useMemo(() => {
    if (!comparisonDateRange.from || !comparisonDateRange.to) return null;
    if (comparisonDateRange.from > comparisonDateRange.to) {
      return "Start date must be before end date";
    }
    return null;
  }, [comparisonDateRange]);

  // Get today's date for disabling future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Filter comparison readings by date range
  const comparisonReadings = useMemo(() => {
    if (comparisonPeriod === "custom" && comparisonDateRange.from && comparisonDateRange.to) {
      const fromTime = comparisonDateRange.from.getTime();
      const toTime = comparisonDateRange.to.getTime() + (24 * 60 * 60 * 1000 - 1);
      return readings.filter((r) => r.timestamp >= fromTime && r.timestamp <= toTime);
    }
    return [];
  }, [readings, comparisonPeriod, comparisonDateRange]);

  // Filter readings by time range
  const filteredReadings = useMemo(() => {
    // Custom date range mode
    if (timeRange === "custom" && primaryDateRange.from && primaryDateRange.to) {
      const fromTime = primaryDateRange.from.getTime();
      const toTime = primaryDateRange.to.getTime() + (24 * 60 * 60 * 1000 - 1); // End of day
      return readings.filter((r) => r.timestamp >= fromTime && r.timestamp <= toTime);
    }

    // Preset time range mode
    const ranges: Record<TimeRange, number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "12h": 12 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "3d": 3 * 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "14d": 14 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const now = Date.now();
    const rangeMs = ranges[timeRange as TimeRange];
    return readings.filter((r) => now - r.timestamp <= rangeMs);
  }, [readings, timeRange, primaryDateRange]);

  // Calculate Pearson correlation coefficient
  const calculateCorrelation = (values1: number[], values2: number[], lag: number = 0): number => {
    if (values1.length < 2 || values2.length < 2) return 0;

    // Apply lag
    let x = values1;
    let y = values2;
    
    if (lag > 0) {
      x = values1.slice(0, -lag);
      y = values2.slice(lag);
    } else if (lag < 0) {
      x = values1.slice(-lag);
      y = values2.slice(0, lag);
    }

    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.slice(0, n).reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    if (denomX === 0 || denomY === 0) return 0;
    return numerator / Math.sqrt(denomX * denomY);
  };

  // Extract parameter values
  const getParameterValues = (param: ParameterKey): number[] => {
    return filteredReadings.map((r) => {
      switch (param) {
        case "ec":
          return r.ec;
        case "pH":
          return r.ph;
        case "temp":
          return r.temperature;
        case "o2":
          return r.o2;
        case "waterLevel":
          return r.waterLevel;
        case "transpiration":
          return r.transpirationRate || 0;
        default:
          return 0;
      }
    });
  };

  // Calculate correlation matrix
  const correlationMatrix = useMemo(() => {
    const params: ParameterKey[] = ["ec", "pH", "temp", "o2", "waterLevel", "transpiration"];
    const matrix: CorrelationData[] = [];

    for (let i = 0; i < params.length; i++) {
      for (let j = 0; j < params.length; j++) {
        const values1 = getParameterValues(params[i]);
        const values2 = getParameterValues(params[j]);
        const coefficient = calculateCorrelation(values1, values2);

        let strength = "";
        let interpretation = "";

        const absCoeff = Math.abs(coefficient);
        if (absCoeff >= 0.7) {
          strength = coefficient > 0 ? "Strong Positive" : "Strong Negative";
        } else if (absCoeff >= 0.4) {
          strength = coefficient > 0 ? "Moderate Positive" : "Moderate Negative";
        } else {
          strength = "Weak/None";
        }

        if (params[i] === params[j]) {
          interpretation = "Perfect correlation (same parameter)";
        } else if (absCoeff >= 0.7) {
          interpretation = coefficient > 0 
            ? "Variables move strongly together" 
            : "Strong inverse relationship";
        } else if (absCoeff >= 0.4) {
          interpretation = coefficient > 0 
            ? "Variables show some relationship" 
            : "Moderate inverse relationship";
        } else {
          interpretation = "Little to no relationship";
        }

        matrix.push({
          param1: params[i],
          param2: params[j],
          coefficient,
          strength,
          interpretation,
        });
      }
    }

    return matrix;
  }, [filteredReadings]);

  // Get correlation color
  const getCorrelationColor = (coeff: number): string => {
    if (coeff > 0.7) return "bg-emerald-600 dark:bg-emerald-500";
    if (coeff > 0.4) return "bg-teal-500 dark:bg-teal-400";
    if (coeff > 0.1) return "bg-teal-300 dark:bg-teal-600";
    if (coeff > -0.1) return "bg-gray-200 dark:bg-gray-600";
    if (coeff > -0.4) return "bg-rose-300 dark:bg-rose-600";
    if (coeff > -0.7) return "bg-rose-500 dark:bg-rose-500";
    return "bg-red-600 dark:bg-red-500";
  };

  const getCorrelationTextColor = (coeff: number): string => {
    const absCoeff = Math.abs(coeff);
    if (absCoeff > 0.4) return "text-white";
    return "text-gray-900 dark:text-gray-100";
  };

  // Scatter plot data
  const scatterData = useMemo(() => {
    const values1 = getParameterValues(selectedParam1);
    const values2 = getParameterValues(selectedParam2);
    
    const lagIndex = Math.floor(lagMinutes / 5); // Assuming 5-minute intervals
    
    return values1.map((val1, idx) => {
      const adjustedIdx = idx + lagIndex;
      if (adjustedIdx < 0 || adjustedIdx >= values2.length) return null;
      
      return {
        x: val1,
        y: values2[adjustedIdx],
        timestamp: filteredReadings[idx]?.timestamp,
      };
    }).filter((d) => d !== null);
  }, [selectedParam1, selectedParam2, filteredReadings, lagMinutes]);

  const selectedCorrelation = calculateCorrelation(
    getParameterValues(selectedParam1),
    getParameterValues(selectedParam2),
    Math.floor(lagMinutes / 5)
  );

  // Key insights
  const keyInsights = useMemo(() => {
    const insights: Array<{ type: "positive" | "negative" | "anomaly"; message: string }> = [];

    // Temperature vs O2 (should be strongly negative)
    const tempO2Corr = correlationMatrix.find((c) => 
      (c.param1 === "temp" && c.param2 === "o2") || (c.param1 === "o2" && c.param2 === "temp")
    );
    if (tempO2Corr && tempO2Corr.coefficient > -0.5) {
      insights.push({
        type: "anomaly",
        message: `Temp/O2 correlation is ${tempO2Corr.coefficient.toFixed(2)} (expected < -0.7). Check O2 sensor calibration.`,
      });
    } else if (tempO2Corr && tempO2Corr.coefficient < -0.7) {
      insights.push({
        type: "positive",
        message: `Temp/O2 correlation is healthy at ${tempO2Corr.coefficient.toFixed(2)}.`,
      });
    }

    // EC vs pH (typically negative)
    const ecPhCorr = correlationMatrix.find((c) => 
      (c.param1 === "ec" && c.param2 === "pH") || (c.param1 === "pH" && c.param2 === "ec")
    );
    if (ecPhCorr && ecPhCorr.coefficient < -0.3) {
      insights.push({
        type: "positive",
        message: `EC/pH relationship is normal (${ecPhCorr.coefficient.toFixed(2)}). EC changes affect pH as expected.`,
      });
    } else if (ecPhCorr && ecPhCorr.coefficient > 0) {
      insights.push({
        type: "anomaly",
        message: `EC/pH correlation is positive (${ecPhCorr.coefficient.toFixed(2)}). Check dosing system.`,
      });
    }

    // Temperature vs Transpiration (should be positive)
    const tempTranspCorr = correlationMatrix.find((c) => 
      (c.param1 === "temp" && c.param2 === "transpiration") || 
      (c.param1 === "transpiration" && c.param2 === "temp")
    );
    if (tempTranspCorr && tempTranspCorr.coefficient > 0.5) {
      insights.push({
        type: "positive",
        message: `Temp/Transpiration correlation is strong (${tempTranspCorr.coefficient.toFixed(2)}). Plants responding well to temperature.`,
      });
    }

    return insights;
  }, [correlationMatrix]);

  const params: ParameterKey[] = ["ec", "pH", "temp", "o2", "waterLevel", "transpiration"];

  // Export correlation data to CSV
  const exportCorrelationData = () => {
    const timestamp = format(new Date(), "yyyy-MM-dd_HHmmss");
    let csvContent = "";

    // Section 1: Correlation Matrix
    csvContent += "CORRELATION MATRIX\\n";
    csvContent += "Analysis Period:," + (timeRange === "custom" && primaryDateRange.from && primaryDateRange.to 
      ? `${format(primaryDateRange.from, "yyyy-MM-dd")} to ${format(primaryDateRange.to, "yyyy-MM-dd")}`
      : `Last ${timeRange}`) + "\\n";
    csvContent += "Data Points:," + filteredReadings.length + "\\n\\n";

    csvContent += "Parameter 1,Parameter 2,Correlation Coefficient,Strength,Interpretation\\n";
    correlationMatrix.forEach((row) => {
      csvContent += `${PARAMETER_LABELS[row.param1]},${PARAMETER_LABELS[row.param2]},${row.coefficient.toFixed(4)},${row.strength},${row.interpretation}\\n`;
    });

    // Section 2: Scatter Plot Data
    csvContent += "\\n\\nSCATTER PLOT DATA\\n";
    csvContent += `${PARAMETER_LABELS[selectedParam1]} (${PARAMETER_UNITS[selectedParam1]}),${PARAMETER_LABELS[selectedParam2]} (${PARAMETER_UNITS[selectedParam2]}),Timestamp\\n`;
    scatterData.forEach((point) => {
      if (point) {
        csvContent += `${point.x},${point.y},${point.timestamp ? new Date(point.timestamp).toISOString() : ""}\\n`;
      }
    });

    // Section 3: Key Insights
    if (keyInsights.length > 0) {
      csvContent += "\\n\\nKEY INSIGHTS\\n";
      csvContent += "Type,Message\\n";
      keyInsights.forEach((insight) => {
        csvContent += `${insight.type},${insight.message}\\n`;
      });
    }

    // Section 4: Statistical Summary
    csvContent += "\\\\n\\\\nSTATISTICAL SUMMARY\\\\n";
    params.forEach((param) => {
      const values = getParameterValues(param).filter((v) => v != null && !isNaN(v));
      if (values.length > 0) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const sorted = [...values].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted[Math.floor(sorted.length / 2)];
        
        csvContent += `${PARAMETER_LABELS[param]},Mean,${mean.toFixed(2)},Min,${min.toFixed(2)},Max,${max.toFixed(2)},Median,${median.toFixed(2)}\\\\n`;
      }
    });

    // Download
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `correlation-analysis_${timestamp}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export correlation data to image
  const exportCorrelationImage = () => {
    const timestamp = format(new Date(), "yyyy-MM-dd_HHmmss");
    const element = document.getElementById("correlation-analysis");
    if (element) {
      domtoimage.toPng(element).then((dataUrl) => {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `correlation-analysis_${timestamp}.png`;
        link.click();
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <GitCompare className="w-8 h-8 text-teal-500" />
          <div>
            <h2 className="text-foreground">Correlation Analysis</h2>
            <p className="text-sm text-muted-foreground">
              Discover relationships between water quality parameters
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCorrelationData}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export Analysis
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCorrelationImage}
            className="gap-2"
          >
            <ImageIcon className="w-4 h-4" />
            Export Image
          </Button>
        </div>
      </div>

      <div id="correlation-analysis">{/* Time Range Controls */}
        <TimeRangeControls
          timeRange={timeRange}
          onTimeRangeChange={(range) => {
            setTimeRange(range);
            // Reset custom dates when switching away from custom
            if (range !== "custom") {
              setPrimaryDateRange({ from: undefined, to: undefined });
            }
          }}
          comparisonPeriod={comparisonPeriod}
          onComparisonChange={(period) => {
            setComparisonPeriod(period);
            // Reset comparison custom dates when switching away from custom
            if (period !== "custom") {
              setComparisonDateRange({ from: undefined, to: undefined });
            }
          }}
        />

        {/* Custom Date Range Selectors */}
        {(timeRange === "custom" || comparisonPeriod === "custom") && (
          <Card className="border-2 border-teal-200 dark:border-teal-800 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-teal-500" />
                Custom Date Range Selection
              </CardTitle>
              <CardDescription>
                {timeRange === "custom" && comparisonPeriod === "custom"
                  ? "Select two custom date ranges to compare"
                  : timeRange === "custom"
                  ? "Select a custom date range for analysis"
                  : "Select a custom date range for comparison"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Date Range (if Time Range is custom) */}
              {timeRange === "custom" && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                    Primary Period
                  </h4>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[180px]">
                      <Label className="mb-2 block text-xs">From Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {primaryDateRange.from ? (
                              format(primaryDateRange.from, "MMM d, yyyy")
                            ) : (
                              <span className="text-muted-foreground">Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={primaryDateRange.from}
                            onSelect={(date) =>
                              setPrimaryDateRange((prev) => ({ ...prev, from: date }))
                            }
                            initialFocus
                            maxDate={today}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex-1 min-w-[180px]">
                      <Label className="mb-2 block text-xs">To Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {primaryDateRange.to ? (
                              format(primaryDateRange.to, "MMM d, yyyy")
                            ) : (
                              <span className="text-muted-foreground">Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={primaryDateRange.to}
                            onSelect={(date) =>
                              setPrimaryDateRange((prev) => ({ ...prev, to: date }))
                            }
                            initialFocus
                            maxDate={today}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPrimaryDateRange({ from: undefined, to: undefined })}
                      disabled={!primaryDateRange.from && !primaryDateRange.to}
                    >
                      Clear
                    </Button>
                  </div>
                  
                  {primaryDateRange.from && primaryDateRange.to && (
                    <div className="p-3 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">Primary:</span> {format(primaryDateRange.from, "MMM d, yyyy")} to {format(primaryDateRange.to, "MMM d, yyyy")}
                        {" "}({filteredReadings.length} data points)
                      </p>
                      {primaryDateError && (
                        <p className="text-xs text-red-500 mt-1">{primaryDateError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Comparison Date Range (if Compare With is custom) */}
              {comparisonPeriod === "custom" && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                    Comparison Period
                  </h4>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[180px]">
                      <Label className="mb-2 block text-xs">From Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {comparisonDateRange.from ? (
                              format(comparisonDateRange.from, "MMM d, yyyy")
                            ) : (
                              <span className="text-muted-foreground">Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={comparisonDateRange.from}
                            onSelect={(date) =>
                              setComparisonDateRange((prev) => ({ ...prev, from: date }))
                            }
                            initialFocus
                            maxDate={today}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex-1 min-w-[180px]">
                      <Label className="mb-2 block text-xs">To Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {comparisonDateRange.to ? (
                              format(comparisonDateRange.to, "MMM d, yyyy")
                            ) : (
                              <span className="text-muted-foreground">Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={comparisonDateRange.to}
                            onSelect={(date) =>
                              setComparisonDateRange((prev) => ({ ...prev, to: date }))
                            }
                            initialFocus
                            maxDate={today}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setComparisonDateRange({ from: undefined, to: undefined })}
                      disabled={!comparisonDateRange.from && !comparisonDateRange.to}
                    >
                      Clear
                    </Button>
                  </div>
                  
                  {comparisonDateRange.from && comparisonDateRange.to && (
                    <div className="p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg border border-cyan-200 dark:border-cyan-800">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">Comparison:</span> {format(comparisonDateRange.from, "MMM d, yyyy")} to {format(comparisonDateRange.to, "MMM d, yyyy")}
                        {" "}({comparisonReadings.length} data points)
                      </p>
                      {comparisonDateError && (
                        <p className="text-xs text-red-500 mt-1">{comparisonDateError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Key Insights */}
        {keyInsights.length > 0 && (
          <Card className="border-2 border-teal-200 dark:border-teal-800 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-500" />
                Key Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {keyInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg flex items-start gap-3 ${
                    insight.type === "positive"
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                      : insight.type === "negative"
                      ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                      : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                  }`}
                >
                  {insight.type === "positive" ? (
                    <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : insight.type === "negative" ? (
                    <TrendingDown className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm text-foreground">{insight.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Correlation Matrix Heatmap */}
        <Card className="border-2 border-teal-200 dark:border-teal-800 shadow-lg">
          <CardHeader>
            <CardTitle>Correlation Matrix</CardTitle>
            <CardDescription>
              Correlation coefficients between all parameters. Click any cell for detailed analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="grid gap-1" style={{ gridTemplateColumns: `120px repeat(${params.length}, 1fr)` }}>
                  {/* Header row */}
                  <div></div>
                  {params.map((param) => (
                    <div key={param} className="text-center font-semibold text-sm p-2">
                      {PARAMETER_LABELS[param]}
                    </div>
                  ))}

                  {/* Matrix rows */}
                  {params.map((param1) => [
                    <div key={`label-${param1}`} className="font-semibold text-sm p-2 flex items-center">
                      {PARAMETER_LABELS[param1]}
                    </div>,
                    ...params.map((param2) => {
                      const correlation = correlationMatrix.find(
                        (c) => c.param1 === param1 && c.param2 === param2
                      );
                      const coeff = correlation?.coefficient || 0;

                      return (
                        <button
                          key={`${param1}-${param2}`}
                          onClick={() => {
                            setSelectedParam1(param1);
                            setSelectedParam2(param2);
                          }}
                          className={`p-3 rounded text-center font-mono text-sm font-semibold transition-all hover:scale-105 hover:shadow-lg ${getCorrelationColor(
                            coeff
                          )} ${getCorrelationTextColor(coeff)}`}
                        >
                          {coeff.toFixed(2)}
                        </button>
                      );
                    })
                  ])}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Correlation Strength:</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-600"></div>
                  <span>Strong Negative (-1.0 to -0.7)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-rose-500"></div>
                  <span>Moderate Negative (-0.7 to -0.4)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-600"></div>
                  <span>Weak (-0.4 to 0.4)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-teal-500"></div>
                  <span>Moderate Positive (0.4 to 0.7)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-600"></div>
                  <span>Strong Positive (0.7 to 1.0)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scatter Plot */}
        <Card className="border-2 border-teal-200 dark:border-teal-800 shadow-lg">
          <CardHeader>
            <CardTitle>Detailed Correlation View</CardTitle>
            <CardDescription>
              Scatter plot showing the relationship between selected parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Parameter selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>X-Axis Parameter</Label>
                <Select value={selectedParam1} onValueChange={(v) => setSelectedParam1(v as ParameterKey)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {params.map((param) => (
                      <SelectItem key={param} value={param}>
                        {PARAMETER_LABELS[param]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Y-Axis Parameter</Label>
                <Select value={selectedParam2} onValueChange={(v) => setSelectedParam2(v as ParameterKey)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {params.map((param) => (
                      <SelectItem key={param} value={param}>
                        {PARAMETER_LABELS[param]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Time Lag (minutes)</Label>
                <Select value={lagMinutes.toString()} onValueChange={(v) => setLagMinutes(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No Lag</SelectItem>
                    <SelectItem value="5">5 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="360">6 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Correlation info */}
            <div className="bg-teal-50 dark:bg-teal-950/30 p-4 rounded-lg border border-teal-200 dark:border-teal-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Correlation Coefficient</p>
                  <p className="text-3xl font-bold text-foreground">{selectedCorrelation.toFixed(3)}</p>
                </div>
                <div>
                  <Badge
                    variant="outline"
                    className={`${
                      Math.abs(selectedCorrelation) > 0.7
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                        : Math.abs(selectedCorrelation) > 0.4
                        ? "bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                    }`}
                  >
                    {Math.abs(selectedCorrelation) > 0.7
                      ? selectedCorrelation > 0
                        ? "Strong Positive"
                        : "Strong Negative"
                      : Math.abs(selectedCorrelation) > 0.4
                      ? selectedCorrelation > 0
                        ? "Moderate Positive"
                        : "Moderate Negative"
                      : "Weak/None"}
                  </Badge>
                </div>
              </div>
              {lagMinutes > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  With {lagMinutes} minute lag: {PARAMETER_LABELS[selectedParam1]} predicts{" "}
                  {PARAMETER_LABELS[selectedParam2]}
                </p>
              )}
            </div>

            {/* Scatter plot */}
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="x"
                  name={PARAMETER_LABELS[selectedParam1]}
                  unit={PARAMETER_UNITS[selectedParam1]}
                  className="text-xs"
                />
                <YAxis
                  dataKey="y"
                  name={PARAMETER_LABELS[selectedParam2]}
                  unit={PARAMETER_UNITS[selectedParam2]}
                  className="text-xs"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  cursor={{ strokeDasharray: "3 3" }}
                />
                <Scatter
                  name={`${PARAMETER_LABELS[selectedParam1]} vs ${PARAMETER_LABELS[selectedParam2]}`}
                  data={scatterData}
                  fill="#14b8a6"
                  fillOpacity={0.6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}