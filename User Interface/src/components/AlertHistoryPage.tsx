import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { AlertCircle, Trash2, Clock, Download, CalendarIcon } from "lucide-react";
import { useAlerts } from "./AlertContext";
import { useState, useMemo } from "react";
import { format } from "date-fns";

type TimeRange = "1h" | "3h" | "6h" | "12h" | "24h" | "3d" | "7d" | "14d" | "30d" | "all" | "custom";

export function AlertHistoryPage() {
  const { alertHistory, clearAlertHistory } = useAlerts();
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  // Get today's date for disabling future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Filter alerts by time range
  const filteredAlerts = useMemo(() => {
    if (timeRange === "all") {
      return alertHistory;
    }

    if (timeRange === "custom" && customDateRange.from && customDateRange.to) {
      const fromTime = customDateRange.from.getTime();
      const toTime = customDateRange.to.getTime() + (24 * 60 * 60 * 1000 - 1); // End of day
      return alertHistory.filter((alert) => alert.startTime >= fromTime && alert.startTime <= toTime);
    }

    const ranges: Record<Exclude<TimeRange, "all" | "custom">, number> = {
      "1h": 60 * 60 * 1000,
      "3h": 3 * 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "12h": 12 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "3d": 3 * 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "14d": 14 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const now = Date.now();
    const rangeMs = ranges[timeRange as keyof typeof ranges];
    return alertHistory.filter((alert) => now - alert.startTime <= rangeMs);
  }, [alertHistory, timeRange, customDateRange]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case "temperature":
        return "Temperature";
      case "waterLevel":
        return "Water Level";
      case "ec":
        return "EC";
      case "ph":
        return "pH";
      case "network":
        return "Network";
      case "waterFlow":
        return "Water Flow";
      default:
        return type;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700";
      case "warning":
        return "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600";
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredAlerts.length === 0) {
      return;
    }

    const timestamp = format(new Date(), "yyyy-MM-dd_HHmmss");
    let csvContent = "Alert Type,Severity,Start Time,End Time,Duration (minutes)\\n";

    filteredAlerts.forEach((alert) => {
      const duration = alert.duration ? Math.round(alert.duration / 1000 / 60) : "Ongoing";
      csvContent += `${getAlertTypeLabel(alert.type)},${alert.severity},${formatTimestamp(alert.startTime)},${
        alert.endTime ? formatTimestamp(alert.endTime) : "Active"
      },${duration}\\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alert-history_${timestamp}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <div>
            <h2 className="text-foreground">Alert History</h2>
            <p className="text-sm text-muted-foreground">
              Complete log of all system alerts and their durations
            </p>
          </div>
        </div>
        {alertHistory.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAlertHistory}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear History
          </Button>
        )}
      </div>

      <Card className="border-2 border-teal-200 dark:border-teal-800 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-500" />
                Alert Log
              </CardTitle>
              <CardDescription>
                {filteredAlerts.length > 0
                  ? `Showing ${filteredAlerts.length} of ${alertHistory.length} alert${alertHistory.length !== 1 ? 's' : ''}`
                  : "No alerts recorded yet"}
              </CardDescription>
            </div>
            {filteredAlerts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Time Range Filter */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-2 block">Time Range</Label>
              <Select
                value={timeRange}
                onValueChange={(value) => {
                  setTimeRange(value as TimeRange);
                  if (value !== "custom") {
                    setCustomDateRange({ from: undefined, to: undefined });
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

            {timeRange === "custom" && (
              <>
                <div className="flex-1 min-w-[180px]">
                  <Label className="mb-2 block text-xs">From Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange.from ? (
                          format(customDateRange.from, "MMM d, yyyy")
                        ) : (
                          <span className="text-muted-foreground">Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange.from}
                        onSelect={(date) =>
                          setCustomDateRange((prev) => ({ ...prev, from: date }))
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
                        {customDateRange.to ? (
                          format(customDateRange.to, "MMM d, yyyy")
                        ) : (
                          <span className="text-muted-foreground">Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange.to}
                        onSelect={(date) =>
                          setCustomDateRange((prev) => ({ ...prev, to: date }))
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
                  onClick={() => setCustomDateRange({ from: undefined, to: undefined })}
                  disabled={!customDateRange.from && !customDateRange.to}
                >
                  Clear
                </Button>
              </>
            )}
          </div>

          {/* Table */}
          {filteredAlerts.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alert Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-semibold">
                        {getAlertTypeLabel(entry.type)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getSeverityColor(entry.severity)}>
                          {entry.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatTimestamp(entry.startTime)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.endTime ? formatTimestamp(entry.endTime) : (
                          <span className="text-muted-foreground italic">Active</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {entry.duration ? formatDuration(entry.duration) : (
                          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                            Ongoing
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-semibold">No alerts recorded</p>
              <p className="text-sm mt-2">
                Alert history will appear here when system parameters go out of range
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-teal-200 dark:border-teal-800 shadow-lg bg-gradient-to-br from-white to-teal-50/30 dark:from-gray-900 dark:to-teal-950/30">
        <CardHeader>
          <CardTitle className="text-lg">About Alert History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Alert history</strong> tracks all system alerts with precise timing information.
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              <strong className="text-foreground">Start Time:</strong> When the alert condition first occurred
            </li>
            <li>
              <strong className="text-foreground">End Time:</strong> When the condition returned to normal
            </li>
            <li>
              <strong className="text-foreground">Duration:</strong> Total time the alert was active
            </li>
          </ul>
          <p className="text-xs mt-4 text-muted-foreground">
            Alert history is stored locally in your browser and limited to the most recent 10,000 entries.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}