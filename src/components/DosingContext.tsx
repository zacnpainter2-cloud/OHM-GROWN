import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import type { SensorReading } from "../types/sensor-data";
import { supabase } from "../lib/supabaseClient";
import { useThresholds } from "./ThresholdContext";

export interface DosingEvent {
  id: string;
  timestamp: number;
  type: "EC" | "pH";
  action: "started" | "stopped";
  value?: number;
}

interface DosingContextType {
  dosingHistory: DosingEvent[];
  checkDosingEvents: (reading: SensorReading) => void;
  clearDosingHistory: () => void;
}

const DosingContext = createContext<DosingContextType | undefined>(undefined);

export function DosingProvider({ children }: { children: ReactNode }) {
  const [dosingHistory, setDosingHistory] = useState<DosingEvent[]>([]);
  const { thresholds } = useThresholds();

  // Track last flag states in refs (stable across renders, no re-render loops)
  const lastECFlagRef = useRef<number | undefined>(undefined);
  const lastPHFlagRef = useRef<number | undefined>(undefined);
  // Prevent duplicate processing when the same reading triggers the effect multiple times
  const lastProcessedTimestampRef = useRef<number | undefined>(undefined);

  // Load dosing history from Supabase
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("dosing_history")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(10000);

      if (error) {
        console.error("Failed to load dosing history:", error);
        return;
      }

      const events = (data || []).map((row: any) => ({
        id: `${row.event_type.toLowerCase()}-${row.id}`,
        timestamp: new Date(row.occurred_at).getTime(),
        type: row.event_type as DosingEvent["type"],
        action: row.action as DosingEvent["action"],
        value: row.sensor_value ?? undefined,
      }));
      setDosingHistory(events);

      // Initialize refs from the most recent events so page reloads
      // don't re-emit a "started" event that was already recorded.
      const lastEC = events.find((e) => e.type === "EC");
      const lastPH = events.find((e) => e.type === "pH");
      if (lastEC) {
        lastECFlagRef.current = lastEC.action === "started" ? 1 : 0;
      }
      if (lastPH) {
        lastPHFlagRef.current = lastPH.action === "started" ? 1 : 0;
      }
    })();
  }, []);

  const checkDosingEvents = useCallback((reading: SensorReading) => {
    const now = reading.timestamp;
    const newEvents: DosingEvent[] = [];

    // Helper to check for duplicate event in dosingHistory
    const eventExists = (type: "EC" | "pH", action: "started" | "stopped") =>
      dosingHistory.some(e => e.timestamp === now && e.type === type && e.action === action);

    // Check EC dosing flag (0 = not dosing, 1 = dosing)
    if (reading.ecDosingFlag !== undefined) {
      // Detect transition from 0 to 1 (dosing started)
      if (reading.ecDosingFlag === 1 && lastECFlagRef.current === 0 && !eventExists("EC", "started")) {
        newEvents.push({
          id: `ec-${now}`,
          timestamp: now,
          type: "EC",
          action: "started",
          value: reading.ec,
        });
      }
      // Detect transition from 1 to 0 (dosing stopped)
      if (reading.ecDosingFlag === 0 && lastECFlagRef.current === 1 && !eventExists("EC", "stopped")) {
        newEvents.push({
          id: `ec-${now}`,
          timestamp: now,
          type: "EC",
          action: "stopped",
          value: reading.ec,
        });
      }
      lastECFlagRef.current = reading.ecDosingFlag;
    }

    // Check pH dosing flag (0 = not dosing, 1 = dosing)
    // Only log pH dosing when pH is below lower threshold (too low)
    if (reading.phDosingFlag !== undefined) {
      const phTooLow = reading.ph < thresholds.ph.lower;

      // Detect transition from 0 to 1 (dosing started) — only when pH is too low
      if (reading.phDosingFlag === 1 && lastPHFlagRef.current === 0 && phTooLow && !eventExists("pH", "started")) {
        newEvents.push({
          id: `ph-${now}`,
          timestamp: now,
          type: "pH",
          action: "started",
          value: reading.ph,
        });
      }
      // Detect transition from 1 to 0 (dosing stopped)
      if (reading.phDosingFlag === 0 && lastPHFlagRef.current === 1 && !eventExists("pH", "stopped")) {
        newEvents.push({
          id: `ph-${now}`,
          timestamp: now,
          type: "pH",
          action: "stopped",
          value: reading.ph,
        });
      }
      lastPHFlagRef.current = reading.phDosingFlag;
    }

    if (newEvents.length > 0) {
      setDosingHistory((prev) => [...newEvents, ...prev].slice(0, 10000)); // Keep last 10,000 events
      // Note: Supabase persistence is handled by the supabase-writer Lambda
    }
  }, [thresholds, dosingHistory]);

  const clearDosingHistory = useCallback(() => {
    setDosingHistory([]);
    supabase
      .from("dosing_history")
      .delete()
      .neq("id", 0)
      .then(({ error }) => {
        if (error) console.error("Failed to clear dosing history:", error);
      });
  }, []);

  return (
    <DosingContext.Provider value={{ dosingHistory, checkDosingEvents, clearDosingHistory }}>
      {children}
    </DosingContext.Provider>
  );
}

export function useDosing() {
  const context = useContext(DosingContext);
  if (!context) {
    throw new Error("useDosing must be used within DosingProvider");
  }
  return context;
}