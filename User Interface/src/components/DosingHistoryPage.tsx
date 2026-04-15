import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Activity, Trash2, Zap, Droplets, Download, CalendarIcon } from "lucide-react";
import { useDosing } from "./DosingContext";
import { useState, useMemo } from "react";
import { format } from "date-fns";

type TimeRange = "1h" | "3h" | "6h" | "12h" | "24h" | "3d" | "7d" | "14d" | "30d" | "all" | "custom";

export function DosingHistoryPage() {
  const { dosingHistory, clearDosingHistory } = useDosing();
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

  // Filter dosing events by time range
  const filteredEvents = useMemo(() => {
    if (timeRange === "all") {
      return dosingHistory;
    }

    if (timeRange === "custom" && customDateRange.from && customDateRange.to) {
      const fromTime = customDateRange.from.getTime();
      const toTime = customDateRange.to.getTime() + (24 * 60 * 60 * 1000 - 1); // End of day
      return dosingHistory.filter((event) => event.timestamp >= fromTime && event.timestamp <= toTime);
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
    return dosingHistory.filter((event) => now - event.timestamp <= rangeMs);
  }, [dosingHistory, timeRange, customDateRange]);

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

  // Export to CSV
  const exportToCSV = () => {
    if (filteredEvents.length === 0) {
      return;
    }

    const timestamp = format(new Date(), "yyyy-MM-dd_HHmmss");
    let csvContent = "Timestamp,Parameter,Action,Value at Event\\n";

    filteredEvents.forEach((event) => {
      const value = event.value !== undefined
        ? event.type === "EC"
          ? `${event.value} μS/cm`
          : event.value.toFixed(1)
        : "—";
      const action = event.action === "started" ? "Dosing Started" : "Dosing Stopped";
      csvContent += `${formatTimestamp(event.timestamp)},${event.type},${action},${value}\\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dosing-history_${timestamp}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-emerald-500" />
          <div>
            <h2 className="text-foreground">Dosing Events Log</h2>
            <p className="text-sm text-muted-foreground">
              Historical record of EC and pH dosing activities
            </p>
          </div>
        </div>
        {dosingHistory.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearDosingHistory}
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
                <Activity className="w-5 h-5 text-emerald-500" />
                Dosing Events
              </CardTitle>
              <CardDescription>
                {filteredEvents.length > 0
                  ? `Showing ${filteredEvents.length} of ${dosingHistory.length} event${dosingHistory.length !== 1 ? 's' : ''}`
                  : "No dosing events recorded yet"}
              </CardDescription>
            </div>
            {filteredEvents.length > 0 && (
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
          {filteredEvents.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Value at Event</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-sm">
                        {formatTimestamp(event.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {event.type === "EC" ? (
                            <>
                              <Zap className="w-4 h-4 text-amber-500" />
                              <span className="font-semibold">EC</span>
                            </>
                          ) : (
                            <>
                              <Droplets className="w-4 h-4 text-blue-500" />
                              <span className="font-semibold">pH</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            event.action === "started"
                              ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                              : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700"
                          }
                        >
                          {event.action === "started" ? "Dosing Started" : "Dosing Stopped"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {event.value !== undefined ? (
                          event.type === "EC" ? (
                            `${event.value} μS/cm`
                          ) : (
                            event.value.toFixed(1)
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-semibold">No dosing events yet</p>
              <p className="text-sm mt-2">
                Dosing events will appear here when EC or pH dosing flags are activated
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-teal-200 dark:border-teal-800 shadow-lg bg-gradient-to-br from-white to-teal-50/30 dark:from-gray-900 dark:to-teal-950/30">
        <CardHeader>
          <CardTitle className="text-lg">About Dosing Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Dosing events</strong> are automatically logged when the system detects EC or pH dosing flags become active.
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2">
            <li>
              <strong className="text-amber-600 dark:text-amber-400">EC Dosing:</strong> Triggered when nutrients are being added to adjust electrical conductivity
            </li>
            <li>
              <strong className="text-blue-600 dark:text-blue-400">pH Dosing:</strong> Triggered when pH adjusters (acid/base) are being added
            </li>
          </ul>
          <p className="text-xs mt-4 text-muted-foreground">
            Events are stored locally in your browser and limited to the most recent 10,000 entries.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}