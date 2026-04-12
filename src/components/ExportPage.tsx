import { useState } from "react";
import { CalendarIcon, Download, Loader2, Zap } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useDosing } from "./DosingContext";
import { useAlerts } from "./AlertContext";
import { useProject } from "./ProjectContext";
import { supabase } from "../lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type TimeRangeOption = "1h" | "3h" | "6h" | "12h" | "24h" | "3d" | "7d" | "14d" | "30d" | "all" | "custom";

export function ExportPage() {
  const { dosingHistory } = useDosing();
  const { alertHistory } = useAlerts();
  const { viewingProject } = useProject();
  
  const [selectedParameters, setSelectedParameters] = useState({
    ec: false,
    ph: false,
    temperature: false,
    waterLevel: false,
  });

  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  const [unitSettings, setUnitSettings] = useState({
    fahrenheit: true,
    celsius: false,
    centimeters: true,
    inches: false,
  });

  const [isExporting, setIsExporting] = useState(false);

  const [dosingDateRange, setDosingDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  const [alertDateRange, setAlertDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  const [dosingTimeRange, setDosingTimeRange] = useState<TimeRangeOption>("all");
  const [alertTimeRange, setAlertTimeRange] = useState<TimeRangeOption>("all");

  // Derive units from checkbox states
  const tempUnit = unitSettings.celsius ? "C" : "F";
  const waterLevelUnit = unitSettings.inches ? "in" : "cm";

  const handleUnitChange = (unit: string, checked: boolean) => {
    if (unit === "fahrenheit" || unit === "celsius") {
      // Temperature units are mutually exclusive
      setUnitSettings((prev) => ({
        ...prev,
        fahrenheit: unit === "fahrenheit" ? checked : !checked,
        celsius: unit === "celsius" ? checked : !checked,
      }));
    } else if (unit === "centimeters" || unit === "inches") {
      // Water level units are mutually exclusive
      setUnitSettings((prev) => ({
        ...prev,
        centimeters: unit === "centimeters" ? checked : !checked,
        inches: unit === "inches" ? checked : !checked,
      }));
    }
  };

  const handleParameterChange = (parameter: string, checked: boolean) => {
    setSelectedParameters((prev) => ({
      ...prev,
      [parameter]: checked,
    }));
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return "";

    // Get headers from the first data object
    const headers = Object.keys(data[0]);
    
    // Create CSV header row
    const csvHeader = headers.join(",");
    
    // Create CSV data rows
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Escape values that contain commas, quotes, or newlines
        if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(",");
    });
    
    // Combine header and rows
    return [csvHeader, ...csvRows].join("\n");
  };

  const handleDosingExport = () => {
    if (dosingHistory.length === 0) {
      toast.warning("No dosing history available to export");
      return;
    }

    // Filter by date range if selected
    let filteredData = dosingHistory;
    if (dosingDateRange.from && dosingDateRange.to) {
      const fromTime = dosingDateRange.from.getTime();
      const toTime = dosingDateRange.to.getTime() + (24 * 60 * 60 * 1000 - 1); // End of day
      filteredData = dosingHistory.filter(event => 
        event.timestamp >= fromTime && event.timestamp <= toTime
      );
      
      if (filteredData.length === 0) {
        toast.warning("No dosing events found in the selected date range");
        return;
      }
    }

    // Transform dosing history to CSV format
    const csvData = filteredData.map(event => ({
      Date: format(new Date(event.timestamp), "yyyy-MM-dd"),
      Time: format(new Date(event.timestamp), "HH:mm:ss"),
      Type: event.type,
      Action: event.action,
      Value: event.value !== undefined ? event.value.toFixed(event.type === "pH" ? 2 : 0) : "N/A"
    }));

    const csvContent = convertToCSV(csvData);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const dateRangeStr = dosingDateRange.from && dosingDateRange.to 
      ? `_${format(dosingDateRange.from, "yyyy-MM-dd")}_to_${format(dosingDateRange.to, "yyyy-MM-dd")}`
      : `_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}`;
    const filename = `dosing_history${dateRangeStr}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredData.length} dosing events`);
  };

  const handleAlertExport = () => {
    if (alertHistory.length === 0) {
      toast.warning("No alert history available to export");
      return;
    }

    // Filter by date range if selected
    let filteredData = alertHistory;
    if (alertDateRange.from && alertDateRange.to) {
      const fromTime = alertDateRange.from.getTime();
      const toTime = alertDateRange.to.getTime() + (24 * 60 * 60 * 1000 - 1); // End of day
      filteredData = alertHistory.filter(alert => 
        alert.startTime >= fromTime && alert.startTime <= toTime
      );
      
      if (filteredData.length === 0) {
        toast.warning("No alert events found in the selected date range");
        return;
      }
    }

    // Transform alert history to CSV format
    const csvData = filteredData.map(alert => {
      const duration = alert.duration ? Math.round(alert.duration / 1000 / 60) : "Ongoing";
      return {
        "Alert Type": alert.type,
        Severity: alert.severity,
        "Start Time": format(new Date(alert.startTime), "yyyy-MM-dd HH:mm:ss"),
        "End Time": alert.endTime ? format(new Date(alert.endTime), "yyyy-MM-dd HH:mm:ss") : "Ongoing",
        "Duration (min)": duration,
        Message: alert.message
      };
    });

    const csvContent = convertToCSV(csvData);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const dateRangeStr = alertDateRange.from && alertDateRange.to 
      ? `_${format(alertDateRange.from, "yyyy-MM-dd")}_to_${format(alertDateRange.to, "yyyy-MM-dd")}`
      : `_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}`;
    const filename = `alert_history${dateRangeStr}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredData.length} alert events`);
  };

  const handleExport = async () => {
    if (!dateRange.from || !dateRange.to) {
      toast.error("Please select a date range");
      return;
    }

    setIsExporting(true);

    try {
      // Get selected parameter names
      const selectedParams = Object.entries(selectedParameters)
        .filter(([_, isSelected]) => isSelected)
        .map(([param]) => param);

      if (selectedParams.length === 0) {
        toast.error("Please select at least one parameter");
        setIsExporting(false);
        return;
      }

      // Fetch data from Supabase
      console.log('Fetching export data from Supabase...');
      const startISO = dateRange.from.toISOString();
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      const endISO = endOfDay.toISOString();

      // Paginate to get all results
      const PAGE_SIZE = 1000;
      const allRows: any[] = [];
      let from = 0;
      while (true) {
        let query = supabase
          .from("measurements")
          .select("*")
          .gte("recorded_at", startISO)
          .lte("recorded_at", endISO)
          .order("recorded_at", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (viewingProject?.id != null) {
          query = query.eq("project_id", viewingProject.id);
        }

        const { data, error: fetchErr } = await query;
        if (fetchErr) {
          console.error("Supabase export fetch error:", fetchErr);
          toast.error("Failed to fetch data: " + fetchErr.message);
          setIsExporting(false);
          return;
        }
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      const readings = allRows.map((row: any) => ({
        timestamp: new Date(row.recorded_at).getTime(),
        ec: Number(row.ec ?? 0),
        ph: Number(row.ph ?? 0),
        temperature: Number(row.temperature ?? 0),
        o2: Number(row.dissolved_oxygen ?? 0),
        waterLevel: Number(row.water_level ?? 0),
        transpirationRate: Number(row.transpiration_rate ?? 0),
      }));

      if (readings.length === 0) {
        toast.warning("No data found for the selected date range");
        setIsExporting(false);
        return;
      }

      console.log(`Processing ${readings.length} readings for export`);

      // Transform readings to CSV format
      const csvData = readings.map(reading => {
        const row: any = {
          Date: format(new Date(reading.timestamp), "yyyy-MM-dd"),
          Time: format(new Date(reading.timestamp), "HH:mm:ss"),
        };

        if (selectedParameters.ec) {
          row["EC (µS/cm)"] = reading.ec.toFixed(0);
        }
        if (selectedParameters.ph) {
          row["pH"] = reading.ph.toFixed(2);
        }
        if (selectedParameters.temperature) {
          const tempValue = tempUnit === "F" 
            ? (reading.temperature * 9/5) + 32 
            : reading.temperature;
          row[`Temperature (°${tempUnit})`] = tempValue.toFixed(2);
        }
        if (selectedParameters.waterLevel) {
          const levelValue = waterLevelUnit === "cm" 
            ? reading.waterLevel 
            : reading.waterLevel / 2.54;
          row[`Water Level (${waterLevelUnit})`] = levelValue.toFixed(2);
        }

        return row;
      });

      // Convert data to CSV
      const csvContent = convertToCSV(csvData);

      // Create a Blob from the CSV content
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

      // Create a download link and trigger download
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      // Generate filename with date range
      const filename = `hydroponics_data_${format(dateRange.from, "yyyy-MM-dd")}_to_${format(dateRange.to, "yyyy-MM-dd")}.csv`;
      
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      URL.revokeObjectURL(url);

      toast.success(`Exported ${readings.length} records to ${filename}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  // Quick export presets
  const handleQuickExport = async (days: number, presetName: string) => {
    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // Select all parameters
    setSelectedParameters({
      ec: true,
      ph: true,
      temperature: true,
      waterLevel: true,
    });
    
    // Set date range
    setDateRange({ from, to: now });
    
    // Trigger export
    setIsExporting(true);

    try {
      const startISO = from.toISOString();
      const endISO = now.toISOString();

      let query = supabase
        .from("measurements")
        .select("*")
        .gte("recorded_at", startISO)
        .lte("recorded_at", endISO)
        .order("recorded_at", { ascending: true })
        .limit(10000);

      if (viewingProject?.id != null) {
        query = query.eq("project_id", viewingProject.id);
      }

      const { data, error: fetchErr } = await query;

      if (fetchErr) {
        console.error("Supabase quick export error:", fetchErr);
        toast.error("Failed to fetch data: " + fetchErr.message);
        setIsExporting(false);
        return;
      }

      const readings = (data || []).map((row: any) => ({
        timestamp: new Date(row.recorded_at).getTime(),
        ec: Number(row.ec ?? 0),
        ph: Number(row.ph ?? 0),
        temperature: Number(row.temperature ?? 0),
        o2: Number(row.dissolved_oxygen ?? 0),
        waterLevel: Number(row.water_level ?? 0),
        transpirationRate: Number(row.transpiration_rate ?? 0),
      }));

      if (readings.length === 0) {
        toast.warning(`No data found for the ${presetName.toLowerCase()}`);
        setIsExporting(false);
        return;
      }

      // Transform readings to CSV format
      const csvData = readings.map(reading => {
        const tempValue = tempUnit === "F" 
          ? (reading.temperature * 9/5) + 32 
          : reading.temperature;
        const levelValue = waterLevelUnit === "cm" 
          ? reading.waterLevel 
          : reading.waterLevel / 2.54;

        return {
          Date: format(new Date(reading.timestamp), "yyyy-MM-dd"),
          Time: format(new Date(reading.timestamp), "HH:mm:ss"),
          "EC (µS/cm)": reading.ec.toFixed(0),
          "pH": reading.ph.toFixed(2),
          [`Temperature (°${tempUnit})`]: tempValue.toFixed(2),
          [`Water Level (${waterLevelUnit})`]: levelValue.toFixed(2),
        };
      });

      const csvContent = convertToCSV(csvData);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      const filename = `hydroponics_${presetName.replace(/\s+/g, '_').toLowerCase()}_${format(from, "yyyy-MM-dd")}_to_${format(now, "yyyy-MM-dd")}.csv`;
      
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${readings.length} records for ${presetName}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Quick Export Presets */}
      <Card className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-500" />
            Quick Export Presets
          </CardTitle>
          <CardDescription>
            One-click export for common reporting periods (includes all parameters)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={() => handleQuickExport(1, "Daily Report")}
              disabled={isExporting}
              className="h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
            >
              {isExporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              <div className="text-center">
                <div className="font-semibold">Daily Report</div>
                <div className="text-xs opacity-90">Last 24 hours</div>
              </div>
            </Button>

            <Button
              onClick={() => handleQuickExport(7, "Weekly Report")}
              disabled={isExporting}
              className="h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
            >
              {isExporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              <div className="text-center">
                <div className="font-semibold">Weekly Report</div>
                <div className="text-xs opacity-90">Last 7 days</div>
              </div>
            </Button>

            <Button
              onClick={() => handleQuickExport(30, "Monthly Report")}
              disabled={isExporting}
              className="h-auto py-4 flex flex-col items-center gap-2 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
            >
              {isExporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              <div className="text-center">
                <div className="font-semibold">Monthly Report</div>
                <div className="text-xs opacity-90">Last 30 days</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Data Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Data Selection</CardTitle>
            <CardDescription>
              Select the parameters you want to export
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ec"
                checked={selectedParameters.ec}
                onCheckedChange={(checked) =>
                  handleParameterChange("ec", checked as boolean)
                }
              />
              <Label htmlFor="ec" className="cursor-pointer">
                EC (Electrical Conductivity)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ph"
                checked={selectedParameters.ph}
                onCheckedChange={(checked) =>
                  handleParameterChange("ph", checked as boolean)
                }
              />
              <Label htmlFor="ph" className="cursor-pointer">
                pH Level
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="temperature"
                checked={selectedParameters.temperature}
                onCheckedChange={(checked) =>
                  handleParameterChange("temperature", checked as boolean)
                }
              />
              <Label htmlFor="temperature" className="cursor-pointer">
                Temperature
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="waterLevel"
                checked={selectedParameters.waterLevel}
                onCheckedChange={(checked) =>
                  handleParameterChange("waterLevel", checked as boolean)
                }
              />
              <Label htmlFor="waterLevel" className="cursor-pointer">
                Water Level
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Date Range Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Date Range</CardTitle>
            <CardDescription>
              Select the date range for data export
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      format(dateRange.from, "PPP")
                    ) : (
                      <span className="text-muted-foreground">Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) =>
                      setDateRange((prev) => ({ ...prev, from: date }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? (
                      format(dateRange.to, "PPP")
                    ) : (
                      <span className="text-muted-foreground">Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) =>
                      setDateRange((prev) => ({ ...prev, to: date }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              className="w-full mt-4"
              onClick={handleExport}
              disabled={
                !Object.values(selectedParameters).some((val) => val) ||
                !dateRange.from ||
                !dateRange.to
              }
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export to CSV
            </Button>
          </CardContent>
        </Card>

        {/* Unit Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Unit Settings</CardTitle>
            <CardDescription>
              Choose your preferred units for export
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">Temperature Settings</Label>
              <div className="space-y-3 ml-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fahrenheit"
                    checked={unitSettings.fahrenheit}
                    onCheckedChange={(checked) =>
                      handleUnitChange("fahrenheit", checked as boolean)
                    }
                  />
                  <Label htmlFor="fahrenheit" className="cursor-pointer">
                    Fahrenheit (°F)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="celsius"
                    checked={unitSettings.celsius}
                    onCheckedChange={(checked) =>
                      handleUnitChange("celsius", checked as boolean)
                    }
                  />
                  <Label htmlFor="celsius" className="cursor-pointer">
                    Celsius (°C)
                  </Label>
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Water Level Settings</Label>
              <div className="space-y-3 ml-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="centimeters"
                    checked={unitSettings.centimeters}
                    onCheckedChange={(checked) =>
                      handleUnitChange("centimeters", checked as boolean)
                    }
                  />
                  <Label htmlFor="centimeters" className="cursor-pointer">
                    Centimeters (cm)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="inches"
                    checked={unitSettings.inches}
                    onCheckedChange={(checked) =>
                      handleUnitChange("inches", checked as boolean)
                    }
                  />
                  <Label htmlFor="inches" className="cursor-pointer">
                    Inches (in)
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Export Summary</CardTitle>
          <CardDescription>
            Review your selection before exporting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="text-muted-foreground">Selected Parameters: </span>
              <span>
                {Object.entries(selectedParameters)
                  .filter(([_, isSelected]) => isSelected)
                  .map(([param]) => {
                    const paramNames: { [key: string]: string } = {
                      ec: "EC",
                      ph: "pH",
                      temperature: "Temperature",
                      waterLevel: "Water Level",
                    };
                    return paramNames[param];
                  })
                  .join(", ") || "None"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Date Range: </span>
              <span>
                {dateRange.from && dateRange.to
                  ? `${format(dateRange.from, "PPP")} - ${format(dateRange.to, "PPP")}`
                  : "Not set"}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Units: </span>
              <span>
                Temperature: °{tempUnit}, Water Level: {waterLevelUnit}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dosing History Export */}
      <Card>
        <CardHeader>
          <CardTitle>Dosing History Export</CardTitle>
          <CardDescription>
            Export your dosing history to a CSV file (last 10,000 events)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {dosingHistory.length > 0 
              ? `${dosingHistory.length} dosing events available` 
              : "No dosing events available"}
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Time Range</Label>
            <Select
              value={dosingTimeRange}
              onValueChange={(value: TimeRangeOption) => {
                setDosingTimeRange(value);
                if (value !== "custom") {
                  const now = new Date();
                  let from: Date;
                  switch (value) {
                    case "1h":
                      from = new Date(now.getTime() - 60 * 60 * 1000);
                      break;
                    case "3h":
                      from = new Date(now.getTime() - 3 * 60 * 60 * 1000);
                      break;
                    case "6h":
                      from = new Date(now.getTime() - 6 * 60 * 60 * 1000);
                      break;
                    case "12h":
                      from = new Date(now.getTime() - 12 * 60 * 60 * 1000);
                      break;
                    case "24h":
                      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                      break;
                    case "3d":
                      from = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
                      break;
                    case "7d":
                      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      break;
                    case "14d":
                      from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
                      break;
                    case "30d":
                      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                      break;
                    case "all":
                      from = new Date(0);
                      break;
                    default:
                      from = new Date(0);
                      break;
                  }
                  setDosingDateRange({ from, to: now });
                } else {
                  setDosingDateRange({ from: undefined, to: undefined });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="3h">Last 3 Hours</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="12h">Last 12 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="3d">Last 3 Days</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="14d">Last 14 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dosingTimeRange === "custom" && (
            <div className="space-y-2">
              <Label className="text-sm">Date Range (Optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left text-sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dosingDateRange.from ? (
                        format(dosingDateRange.from, "MM/dd/yy")
                      ) : (
                        <span className="text-muted-foreground">From</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dosingDateRange.from}
                      onSelect={(date) =>
                        setDosingDateRange((prev) => ({ ...prev, from: date }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left text-sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dosingDateRange.to ? (
                        format(dosingDateRange.to, "MM/dd/yy")
                      ) : (
                        <span className="text-muted-foreground">To</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dosingDateRange.to}
                      onSelect={(date) =>
                        setDosingDateRange((prev) => ({ ...prev, to: date }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {dosingDateRange.from && dosingDateRange.to && (
                <p className="text-xs text-muted-foreground">
                  Will export events from {format(dosingDateRange.from, "MMM d")} to {format(dosingDateRange.to, "MMM d, yyyy")}
                </p>
              )}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleDosingExport}
            disabled={dosingHistory.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Dosing History
          </Button>
        </CardContent>
      </Card>

      {/* Alert History Export */}
      <Card>
        <CardHeader>
          <CardTitle>Alert History Export</CardTitle>
          <CardDescription>
            Export your alert history to a CSV file (last 10,000 events)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {alertHistory.length > 0 
              ? `${alertHistory.length} alert events available` 
              : "No alert events available"}
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Time Range</Label>
            <Select
              value={alertTimeRange}
              onValueChange={(value: TimeRangeOption) => {
                setAlertTimeRange(value);
                if (value !== "custom") {
                  const now = new Date();
                  let from: Date;
                  switch (value) {
                    case "1h":
                      from = new Date(now.getTime() - 60 * 60 * 1000);
                      break;
                    case "3h":
                      from = new Date(now.getTime() - 3 * 60 * 60 * 1000);
                      break;
                    case "6h":
                      from = new Date(now.getTime() - 6 * 60 * 60 * 1000);
                      break;
                    case "12h":
                      from = new Date(now.getTime() - 12 * 60 * 60 * 1000);
                      break;
                    case "24h":
                      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                      break;
                    case "3d":
                      from = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
                      break;
                    case "7d":
                      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      break;
                    case "14d":
                      from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
                      break;
                    case "30d":
                      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                      break;
                    case "all":
                      from = new Date(0);
                      break;
                    default:
                      from = new Date(0);
                      break;
                  }
                  setAlertDateRange({ from, to: now });
                } else {
                  setAlertDateRange({ from: undefined, to: undefined });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="3h">Last 3 Hours</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="12h">Last 12 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="3d">Last 3 Days</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="14d">Last 14 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {alertTimeRange === "custom" && (
            <div className="space-y-2">
              <Label className="text-sm">Date Range (Optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left text-sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {alertDateRange.from ? (
                        format(alertDateRange.from, "MM/dd/yy")
                      ) : (
                        <span className="text-muted-foreground">From</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={alertDateRange.from}
                      onSelect={(date) =>
                        setAlertDateRange((prev) => ({ ...prev, from: date }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left text-sm"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {alertDateRange.to ? (
                        format(alertDateRange.to, "MM/dd/yy")
                      ) : (
                        <span className="text-muted-foreground">To</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={alertDateRange.to}
                      onSelect={(date) =>
                        setAlertDateRange((prev) => ({ ...prev, to: date }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {alertDateRange.from && alertDateRange.to && (
                <p className="text-xs text-muted-foreground">
                  Will export events from {format(alertDateRange.from, "MMM d")} to {format(alertDateRange.to, "MMM d, yyyy")}
                </p>
              )}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleAlertExport}
            disabled={alertHistory.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Alert History
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}