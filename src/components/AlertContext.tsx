import { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback, useRef } from "react";
import type { SensorReading } from "../types/sensor-data";
import { supabase } from "../lib/supabaseClient";
import { useProject } from "./ProjectContext";

export interface Alert {
  id: string;
  type: "temperature" | "waterLevel" | "ec" | "ph" | "network" | "waterFlow";
  severity: "critical" | "warning";
  message: string;
  timestamp: number;
}

export interface AlertHistoryEntry {
  id: string;
  type: "temperature" | "waterLevel" | "ec" | "ph" | "network" | "waterFlow";
  severity: "critical" | "warning";
  message: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

interface ThresholdValues {
  ec: { lower: number; upper: number };
  ph: { lower: number; upper: number };
  temperature: { lower: number; upper: number };
  o2: { lower: number; upper: number };
  waterLevel: { lower: number; upper: number };
}

interface AlertContextType {
  alerts: Alert[];
  alertHistory: AlertHistoryEntry[];
  checkAlerts: (reading: SensorReading, thresholds: ThresholdValues) => void;
  clearAlert: (id: string) => void;
  clearAllAlerts: () => void;
  clearAlertHistory: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([]);
  const [lastDataTimestamp, setLastDataTimestamp] = useState<number>(Date.now());
  const activeAlertsRef = useRef<Map<string, AlertHistoryEntry>>(new Map());
  const { viewingProject, activeProject } = useProject();

  // Load alert history from Supabase when viewing project changes
  useEffect(() => {
    if (!viewingProject) return;
    (async () => {
      const { data, error } = await supabase
        .from("alert_history")
        .select("*")
        .eq("project_id", viewingProject.id)
        .order("start_time", { ascending: false })
        .limit(10000);

      if (error) {
        console.error("Failed to load alert history:", error);
        return;
      }

      setAlertHistory(
        (data || []).map((row: any) => ({
          id: `history-${row.alert_type}-${row.id}`,
          type: row.alert_type as AlertHistoryEntry["type"],
          severity: row.severity as AlertHistoryEntry["severity"],
          message: row.message,
          startTime: new Date(row.start_time).getTime(),
          endTime: row.end_time ? new Date(row.end_time).getTime() : undefined,
          duration: row.duration_ms ?? undefined,
        }))
      );
    })();
  }, [viewingProject]);

  // Check for network connectivity alert (no data for 10 minutes)
  useEffect(() => {
    const checkNetworkInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastData = now - lastDataTimestamp;
      const TEN_MINUTES = 10 * 60 * 1000;

      if (timeSinceLastData > TEN_MINUTES) {
        // Add network alert if not already present
        setAlerts((prev) => {
          const hasNetworkAlert = prev.some((alert) => alert.type === "network");
          if (hasNetworkAlert) return prev;

          return [
            ...prev,
            {
              id: "network-" + now,
              type: "network",
              severity: "critical",
              message: "No Data Received — Check Network Connection",
              timestamp: now,
            },
          ];
        });
      } else {
        // Remove network alert if data is flowing again
        setAlerts((prev) => prev.filter((alert) => alert.type !== "network"));
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkNetworkInterval);
  }, [lastDataTimestamp]);

  const checkAlerts = useCallback((reading: SensorReading, thresholds: ThresholdValues) => {
    // Update last data timestamp
    setLastDataTimestamp(reading.timestamp);

    const newAlerts: Alert[] = [];
    const now = Date.now();
    const currentAlertTypes = new Set<string>();

    // Check Temperature
    if (reading.temperature < thresholds.temperature.lower || reading.temperature > thresholds.temperature.upper) {
      const alertType = "temperature";
      const direction = reading.temperature < thresholds.temperature.lower ? "Too Low" : "Too High";
      currentAlertTypes.add(alertType);
      newAlerts.push({
        id: "temperature-" + now,
        type: alertType,
        severity: "critical",
        message: `Temperature ${direction}`,
        timestamp: now,
      });

      // Track in history if not already active
      if (!activeAlertsRef.current.has(alertType)) {
        const historyEntry: AlertHistoryEntry = {
          id: `history-${alertType}-${now}`,
          type: alertType,
          severity: "critical",
          message: `Temperature ${direction}`,
          startTime: now,
        };
        activeAlertsRef.current.set(alertType, historyEntry);
      }
    }

    // Check Water Level
    if (reading.waterLevel < thresholds.waterLevel.lower || reading.waterLevel > thresholds.waterLevel.upper) {
      const alertType = "waterLevel";
      const direction = reading.waterLevel < thresholds.waterLevel.lower ? "Too Low" : "Too High";
      currentAlertTypes.add(alertType);
      newAlerts.push({
        id: "waterLevel-" + now,
        type: alertType,
        severity: "critical",
        message: `Water Level ${direction}`,
        timestamp: now,
      });

      if (!activeAlertsRef.current.has(alertType)) {
        const historyEntry: AlertHistoryEntry = {
          id: `history-${alertType}-${now}`,
          type: alertType,
          severity: "critical",
          message: `Water Level ${direction}`,
          startTime: now,
        };
        activeAlertsRef.current.set(alertType, historyEntry);
      }
    }

    // Check EC
    if (reading.ec < thresholds.ec.lower || reading.ec > thresholds.ec.upper) {
      const alertType = "ec";
      const direction = reading.ec < thresholds.ec.lower ? "Too Low" : "Too High";
      currentAlertTypes.add(alertType);
      newAlerts.push({
        id: "ec-" + now,
        type: alertType,
        severity: "critical",
        message: `EC ${direction}`,
        timestamp: now,
      });

      if (!activeAlertsRef.current.has(alertType)) {
        const historyEntry: AlertHistoryEntry = {
          id: `history-${alertType}-${now}`,
          type: alertType,
          severity: "critical",
          message: `EC ${direction}`,
          startTime: now,
        };
        activeAlertsRef.current.set(alertType, historyEntry);
      }
    }

    // Check pH
    if (reading.ph < thresholds.ph.lower || reading.ph > thresholds.ph.upper) {
      const alertType = "ph";
      const direction = reading.ph < thresholds.ph.lower ? "Too Low" : "Too High";
      currentAlertTypes.add(alertType);
      newAlerts.push({
        id: "ph-" + now,
        type: alertType,
        severity: "critical",
        message: `pH ${direction}`,
        timestamp: now,
      });

      if (!activeAlertsRef.current.has(alertType)) {
        const historyEntry: AlertHistoryEntry = {
          id: `history-${alertType}-${now}`,
          type: alertType,
          severity: "critical",
          message: `pH ${direction}`,
          startTime: now,
        };
        activeAlertsRef.current.set(alertType, historyEntry);
      }
    }

    // Check Water Flow (1 = ok/flowing, 0 = issue/no flow)
    if (reading.waterFlowOk !== undefined && reading.waterFlowOk === 0) {
      const alertType = "waterFlow";
      currentAlertTypes.add(alertType);
      newAlerts.push({
        id: "waterFlow-" + now,
        type: alertType,
        severity: "critical",
        message: "Water Flow Issue Detected (No Flow)",
        timestamp: now,
      });

      if (!activeAlertsRef.current.has(alertType)) {
        const historyEntry: AlertHistoryEntry = {
          id: `history-${alertType}-${now}`,
          type: alertType,
          severity: "critical",
          message: "Water Flow Issue Detected (No Flow)",
          startTime: now,
        };
        activeAlertsRef.current.set(alertType, historyEntry);
      }
    }

    // End alerts that are no longer active
    const endedAlerts: AlertHistoryEntry[] = [];
    activeAlertsRef.current.forEach((entry, type) => {
      if (!currentAlertTypes.has(type)) {
        endedAlerts.push({
          ...entry,
          endTime: now,
          duration: now - entry.startTime,
        });
        activeAlertsRef.current.delete(type);
      }
    });

    if (endedAlerts.length > 0) {
      setAlertHistory((prev) => [...endedAlerts, ...prev].slice(0, 10000));
      // Save ended alerts to Supabase
      if (activeProject) {
        endedAlerts.forEach((entry) => {
          supabase.from("alert_history").insert([{
            project_id: activeProject.id,
            alert_type: entry.type,
            severity: entry.severity,
            message: entry.message,
            start_time: new Date(entry.startTime).toISOString(),
            end_time: entry.endTime ? new Date(entry.endTime).toISOString() : null,
            duration_ms: entry.duration ?? null,
          }]).then(({ error }) => {
            if (error) console.error("Failed to save alert history:", error);
          });
        });
      }
    }

    // Update alerts - remove old alerts of the same type, add new ones
    setAlerts((prev) => {
      // Keep network alerts separate (managed by useEffect)
      const networkAlerts = prev.filter((alert) => alert.type === "network");
      
      // Remove duplicates by type from new alerts
      const uniqueNewAlerts = newAlerts.filter(
        (newAlert, index, self) =>
          index === self.findIndex((a) => a.type === newAlert.type)
      );

      return [...networkAlerts, ...uniqueNewAlerts];
    });
  }, []);

  const clearAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const clearAlertHistory = useCallback(() => {
    setAlertHistory([]);
    if (viewingProject) {
      supabase
        .from("alert_history")
        .delete()
        .eq("project_id", viewingProject.id)
        .then(({ error }) => {
          if (error) console.error("Failed to clear alert history:", error);
        });
    }
  }, [viewingProject]);

  // Merge active (ongoing) alerts into history so they appear on the history page
  const fullAlertHistory = useMemo(() => {
    const activeEntries: AlertHistoryEntry[] = [];
    activeAlertsRef.current.forEach((entry) => {
      activeEntries.push({ ...entry });
    });
    // Active alerts first (no endTime), then ended alerts
    return [...activeEntries, ...alertHistory];
  }, [alerts, alertHistory]); // re-derive when alerts or history change

  return (
    <AlertContext.Provider value={{ alerts, alertHistory: fullAlertHistory, checkAlerts, clearAlert, clearAllAlerts, clearAlertHistory }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlerts must be used within AlertProvider");
  }
  return context;
}