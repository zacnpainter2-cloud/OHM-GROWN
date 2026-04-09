import { useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent } from "./ui/card";
import { Calendar, GitCompare } from "lucide-react";

export type TimeRange = "1h" | "6h" | "12h" | "24h" | "3d" | "7d" | "14d" | "30d" | "custom";
export type ComparisonPeriod = "none" | "1h" | "6h" | "12h" | "24h" | "3d" | "7d" | "14d" | "30d" | "previous" | "lastWeek" | "lastMonth" | "custom";

interface TimeRangeControlsProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  comparisonPeriod: ComparisonPeriod;
  onComparisonChange: (period: ComparisonPeriod) => void;
}

export function TimeRangeControls({
  timeRange,
  onTimeRangeChange,
  comparisonPeriod,
  onComparisonChange,
}: TimeRangeControlsProps) {
  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: "1h", label: "Last Hour" },
    { value: "6h", label: "Last 6 Hours" },
    { value: "12h", label: "Last 12 Hours" },
    { value: "24h", label: "Last 24 Hours" },
    { value: "3d", label: "Last 3 Days" },
    { value: "7d", label: "Last 7 Days" },
    { value: "14d", label: "Last 14 Days" },
    { value: "30d", label: "Last 30 Days" },
    { value: "custom", label: "Custom Date Range" },
  ];

  const comparisonOptions: { value: ComparisonPeriod; label: string }[] = [
    { value: "none", label: "No Comparison" },
    { value: "1h", label: "Previous Hour" },
    { value: "6h", label: "Previous 6 Hours" },
    { value: "12h", label: "Previous 12 Hours" },
    { value: "24h", label: "Previous 24 Hours" },
    { value: "3d", label: "Previous 3 Days" },
    { value: "7d", label: "Previous 7 Days" },
    { value: "14d", label: "Previous 14 Days" },
    { value: "30d", label: "Previous 30 Days" },
    { value: "previous", label: "Previous Period" },
    { value: "lastWeek", label: "Same Time Last Week" },
    { value: "lastMonth", label: "Same Time Last Month" },
    { value: "custom", label: "Custom Date Range" },
  ];

  return (
    <Card className="border-2 border-teal-200 dark:border-teal-800 shadow-lg bg-gradient-to-r from-white to-teal-50/30 dark:from-gray-900 dark:to-teal-950/30">
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Time Range Selector */}
          <div className="flex-1 min-w-[200px]">
            <Label className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Time Range
            </Label>
            <Select value={timeRange} onValueChange={(value) => onTimeRangeChange(value as TimeRange)}>
              <SelectTrigger className="bg-white dark:bg-gray-800 border-teal-300 dark:border-teal-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Comparison Period Selector */}
          <div className="flex-1 min-w-[200px]">
            <Label className="flex items-center gap-2 mb-2">
              <GitCompare className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              Compare With
            </Label>
            <Select
              value={comparisonPeriod}
              onValueChange={(value) => onComparisonChange(value as ComparisonPeriod)}
            >
              <SelectTrigger className="bg-white dark:bg-gray-800 border-cyan-300 dark:border-cyan-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {comparisonOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Range Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={timeRange === "24h" ? "default" : "outline"}
              onClick={() => onTimeRangeChange("24h")}
              className={timeRange === "24h" ? "bg-teal-500 hover:bg-teal-600" : ""}
            >
              24h
            </Button>
            <Button
              size="sm"
              variant={timeRange === "7d" ? "default" : "outline"}
              onClick={() => onTimeRangeChange("7d")}
              className={timeRange === "7d" ? "bg-teal-500 hover:bg-teal-600" : ""}
            >
              7d
            </Button>
            <Button
              size="sm"
              variant={timeRange === "30d" ? "default" : "outline"}
              onClick={() => onTimeRangeChange("30d")}
              className={timeRange === "30d" ? "bg-teal-500 hover:bg-teal-600" : ""}
            >
              30d
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}