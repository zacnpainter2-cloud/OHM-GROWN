import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { SensorReading } from "../types/sensor-data";
import { supabase } from "../lib/supabaseClient";
import { useProject } from "./ProjectContext";

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
  const { viewingProject, activeProject } = useProject();

  // Track last flag states in refs (not persisted — only matters within a session)
  const [lastECFlag, setLastECFlag] = useState<number | undefined>(undefined);
  const [lastPHFlag, setLastPHFlag] = useState<number | undefined>(undefined);

  // Load dosing history from Supabase when viewing project changes
  useEffect(() => {
    if (!viewingProject) return;
    (async () => {
      const { data, error } = await supabase
        .from("dosing_history")
        .select("*")
        .eq("project_id", viewingProject.id)
        .order("occurred_at", { ascending: false })
        .limit(10000);

      if (error) {
        console.error("Failed to load dosing history:", error);
        return;
      }

      setDosingHistory(
        (data || []).map((row: any) => ({
          id: `${row.event_type.toLowerCase()}-${row.id}`,
          timestamp: new Date(row.occurred_at).getTime(),
          type: row.event_type as DosingEvent["type"],
          action: row.action as DosingEvent["action"],
          value: row.sensor_value ?? undefined,
        }))
      );
    })();
  }, [viewingProject]);

  const checkDosingEvents = useCallback((reading: SensorReading) => {
    const newEvents: DosingEvent[] = [];
    const now = reading.timestamp;

    // Check EC dosing flag (0 = not dosing, 1 = dosing)
    if (reading.ecDosingFlag !== undefined) {
      // Detect transition from 0 to 1 (dosing started) OR first reading with flag=1
      if (reading.ecDosingFlag === 1 && (lastECFlag === undefined || lastECFlag === 0)) {
        newEvents.push({
          id: `ec-${now}`,
          timestamp: now,
          type: "EC",
          action: "started",
          value: reading.ec,
        });
      }
      // Detect transition from 1 to 0 (dosing stopped)
      if (reading.ecDosingFlag === 0 && lastECFlag === 1) {
        newEvents.push({
          id: `ec-${now}`,
          timestamp: now,
          type: "EC",
          action: "stopped",
          value: reading.ec,
        });
      }
      setLastECFlag(reading.ecDosingFlag);
    }

    // Check pH dosing flag (0 = not dosing, 1 = dosing)
    if (reading.phDosingFlag !== undefined) {
      // Detect transition from 0 to 1 (dosing started) OR first reading with flag=1
      if (reading.phDosingFlag === 1 && (lastPHFlag === undefined || lastPHFlag === 0)) {
        newEvents.push({
          id: `ph-${now}`,
          timestamp: now,
          type: "pH",
          action: "started",
          value: reading.ph,
        });
      }
      // Detect transition from 1 to 0 (dosing stopped)
      if (reading.phDosingFlag === 0 && lastPHFlag === 1) {
        newEvents.push({
          id: `ph-${now}`,
          timestamp: now,
          type: "pH",
          action: "stopped",
          value: reading.ph,
        });
      }
      setLastPHFlag(reading.phDosingFlag);
    }

    if (newEvents.length > 0) {
      setDosingHistory((prev) => [...newEvents, ...prev].slice(0, 10000)); // Keep last 10,000 events
      // Save new events to Supabase
      if (activeProject) {
        newEvents.forEach((event) => {
          supabase.from("dosing_history").insert([{
            project_id: activeProject.id,
            event_type: event.type,
            action: event.action,
            sensor_value: event.value ?? null,
            occurred_at: new Date(event.timestamp).toISOString(),
          }]).then(({ error }) => {
            if (error) console.error("Failed to save dosing event:", error);
          });
        });
      }
    }
  }, [lastECFlag, lastPHFlag, activeProject]);

  const clearDosingHistory = useCallback(() => {
    setDosingHistory([]);
    if (viewingProject) {
      supabase
        .from("dosing_history")
        .delete()
        .eq("project_id", viewingProject.id)
        .then(({ error }) => {
          if (error) console.error("Failed to clear dosing history:", error);
        });
    }
  }, [viewingProject]);

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