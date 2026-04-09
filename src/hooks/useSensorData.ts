/**
 * Custom hook for managing sensor data
 * Uses Supabase as the shared source of truth
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchLatestReading, fetchReadingsFromDynamo } from "../services/aws-data-service";
import { AWS_CONFIG } from "../config/aws-config";
import { supabase } from "../lib/supabaseClient";
import type { SensorReading } from "../types/sensor-data";

interface UseSensorDataResult {
  readings: SensorReading[];
  latestReading: SensorReading | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

const MAX_READINGS = 51840; // 180 days at 5-minute intervals

/**
 * Save latest AWS reading into Supabase if it doesn't already exist
 */
async function saveReadingToSupabase(reading: SensorReading, projectId: number | null) {
  try {
    // Skip saving bad readings with all-zero critical values
    if (reading.temperature === 0 && reading.ph === 0 && reading.ec === 0) {
      console.warn('Skipping save of invalid reading with all-zero values');
      return;
    }

    // Check if the most recent reading has the same sensor values
    const { data: latest, error: checkError } = await supabase
      .from("measurements")
      .select("ec, ph, temperature, dissolved_oxygen, water_level, transpiration_rate")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Supabase duplicate check failed:", checkError);
      return;
    }

    if (latest &&
      latest.ec === reading.ec &&
      latest.ph === reading.ph &&
      latest.temperature === reading.temperature &&
      latest.dissolved_oxygen === reading.o2 &&
      latest.water_level === reading.waterLevel &&
      latest.transpiration_rate === reading.transpirationRate) {
      return; // sensor values unchanged, skip saving
    }

    const { error } = await supabase.from("measurements").insert([
      {
        recorded_at: new Date(reading.timestamp).toISOString(),
        ec: reading.ec,
        ph: reading.ph,
        temperature: reading.temperature,
        dissolved_oxygen: reading.o2,
        water_level: reading.waterLevel,
        transpiration_rate: reading.transpirationRate,
        network_status: "online",
        project_id: projectId,
      },
    ]);

    if (error) {
      console.error("Failed to insert reading into Supabase:", error);
    }
  } catch (err) {
    console.error("Unexpected Supabase save error:", err);
  }
}

/**
 * Load last 180 days of readings from Supabase
 * Paginates in chunks of 1000 (Supabase default row limit)
 */
async function fetchReadingsFromSupabase(projectId?: number | null): Promise<SensorReading[]> {
  try {
    const cutoff = new Date(
      Date.now() - 180 * 24 * 60 * 60 * 1000
    ).toISOString();

    const PAGE_SIZE = 1000;
    const allRows: any[] = [];
    let from = 0;

    while (from < MAX_READINGS) {
      const to = from + PAGE_SIZE - 1; // .range() is inclusive
      let query = supabase
        .from("measurements")
        .select("*")
        .gte("recorded_at", cutoff)
        .order("recorded_at", { ascending: true })
        .range(from, to);

      if (projectId != null) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to fetch readings from Supabase:", error);
        break;
      }

      if (!data || data.length === 0) break;

      allRows.push(...data);
      from += data.length;

      // If we got fewer than PAGE_SIZE, we've reached the end
      if (data.length < PAGE_SIZE) break;
    }

    console.log(`Supabase: fetched ${allRows.length} readings in ${Math.ceil(allRows.length / 1000)} pages`);

    return allRows.map((row: any) => ({
      deviceId: String(row.device_id ?? ""),
      timestamp: new Date(row.recorded_at).getTime(),
      ec: Number(row.ec ?? 0),
      ph: Number(row.ph ?? 0),
      temperature: Number(row.temperature ?? 0),
      o2: Number(row.dissolved_oxygen ?? 0),
      waterLevel: Number(row.water_level ?? 0),
      transpirationRate: Number(row.transpiration_rate ?? 0),
    })).filter((r) => !(r.temperature === 0 && r.ph === 0 && r.ec === 0));
  } catch (err) {
    console.error("Unexpected Supabase fetch error:", err);
    return [];
  }
}

export function useSensorData(projectId?: number | null): UseSensorDataResult {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const latestReadingRef = useRef<SensorReading | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const hasBackfilled = useRef(false);
  const projectIdRef = useRef(projectId);

  // Track project changes
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  // Reload data when project changes
  useEffect(() => {
    if (projectId == null) return;
    hasBackfilled.current = false;
    latestReadingRef.current = null;
    setReadings([]);
    setLatestReading(null);
    setIsLoading(true);
  }, [projectId]);

  const loadData = useCallback(async () => {
    try {
      // Only show loading on initial load, not on subsequent polls
      if (!latestReadingRef.current) {
        setIsLoading(true);
      }
      setError(null);

      // Step 1: fetch latest from AWS
      const response = await fetchLatestReading();

      if (response.success && response.data) {
        const newReading = response.data;

        // Only update latest if sensor values actually changed
        const prev = latestReadingRef.current;
        const isNewData = !prev ||
          prev.ec !== newReading.ec ||
          prev.ph !== newReading.ph ||
          prev.temperature !== newReading.temperature ||
          prev.o2 !== newReading.o2 ||
          prev.waterLevel !== newReading.waterLevel ||
          prev.transpirationRate !== newReading.transpirationRate;

        if (isNewData) {
          setLatestReading(newReading);
          latestReadingRef.current = newReading;
          setLastUpdated(newReading.timestamp);
          await saveReadingToSupabase(newReading, projectIdRef.current ?? null);

          // Only reload from Supabase when we have new data
          const dbReadings = await fetchReadingsFromSupabase(projectIdRef.current);
          setReadings(dbReadings);
        }
      } else {
        console.warn("AWS latest reading fetch failed:", response.error);

        // Only load from Supabase on first load or if we have no data
        if (!latestReadingRef.current) {
          const dbReadings = await fetchReadingsFromSupabase(projectIdRef.current);
          setReadings(dbReadings);
          if (dbReadings.length > 0) {
            const fallback = dbReadings[dbReadings.length - 1];
            setLatestReading(fallback);
            latestReadingRef.current = fallback;
            setLastUpdated(fallback.timestamp);
          }
        }
      }
    } catch (err) {
      console.error("useSensorData: Error loading sensor data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Backfill: on first load, fetch any DynamoDB readings missed while site was closed
  useEffect(() => {
    if (hasBackfilled.current) return;
    if (projectId == null) return;
    hasBackfilled.current = true;

    (async () => {
      try {
        // Find the most recent Supabase entry for this project
        let latestQuery = supabase
          .from("measurements")
          .select("recorded_at")
          .order("recorded_at", { ascending: false })
          .limit(1);

        if (projectId != null) {
          latestQuery = latestQuery.eq("project_id", projectId);
        }

        const { data: latestRow, error: latestErr } = await latestQuery.single();

        // Default to 180 days ago if no data exists
        const startMs = latestErr || !latestRow
          ? Date.now() - 180 * 24 * 60 * 60 * 1000
          : new Date(latestRow.recorded_at).getTime() + 1000; // +1s to avoid re-fetching last row

        const startSec = Math.floor(startMs / 1000);
        const endSec = Math.floor(Date.now() / 1000);

        // Don't backfill if less than 1 minute gap
        if (endSec - startSec < 60) return;

        console.log(`Backfilling DynamoDB → Supabase from ${new Date(startMs).toISOString()} to now...`);

        const result = await fetchReadingsFromDynamo(startSec, endSec);

        if (!result.success || !result.data || result.data.length === 0) {
          console.log('Backfill: no new readings to import');
          return;
        }

        // Batch insert into Supabase (skip duplicates with same timestamp)
        const rows = result.data.map((r) => ({
          recorded_at: new Date(r.timestamp).toISOString(),
          ec: r.ec,
          ph: r.ph,
          temperature: r.temperature,
          dissolved_oxygen: r.o2,
          water_level: r.waterLevel,
          transpiration_rate: r.transpirationRate ?? 0,
          network_status: "online",
          project_id: projectId,
        }));

        // Insert in batches of 500 to avoid payload limits
        const BATCH_SIZE = 500;
        let inserted = 0;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const { error: insertErr } = await supabase
            .from("measurements")
            .upsert(batch, { onConflict: "recorded_at", ignoreDuplicates: true });

          if (insertErr) {
            console.error("Backfill insert error:", insertErr);
          } else {
            inserted += batch.length;
          }
        }

        console.log(`Backfill complete: imported ${inserted} readings`);

        // Reload readings from Supabase to show the backfilled data
        const dbReadings = await fetchReadingsFromSupabase(projectId);
        setReadings(dbReadings);
        if (dbReadings.length > 0) {
          const latest = dbReadings[dbReadings.length - 1];
          setLatestReading(latest);
          latestReadingRef.current = latest;
          setLastUpdated(latest.timestamp);
        }
      } catch (err) {
        console.error("Backfill failed:", err);
      }
    })();
  }, [projectId]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, AWS_CONFIG.REFRESH_INTERVAL);

    // Refresh immediately when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData]);

  return {
    readings,
    latestReading,
    isLoading,
    error,
    lastUpdated,
    refresh: loadData,
  };
}

/**
 * Hook for fetching only the latest reading
 * Also syncs latest reading into Supabase
 */
export function useLatestReading(projectId?: number | null) {
  const [reading, setReading] = useState<SensorReading | null>(null);
  const readingRef = useRef<SensorReading | null>(null);
  const [lastChanged, setLastChanged] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const projectIdRef = useRef(projectId);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const loadLatest = useCallback(async () => {
    try {
      // Only show loading on initial load
      if (!readingRef.current) {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetchLatestReading();

      if (response.success && response.data) {
        const newReading = response.data;
        const prev = readingRef.current;

        const isNewData = !prev ||
          prev.ec !== newReading.ec ||
          prev.ph !== newReading.ph ||
          prev.temperature !== newReading.temperature ||
          prev.o2 !== newReading.o2 ||
          prev.waterLevel !== newReading.waterLevel ||
          prev.transpirationRate !== newReading.transpirationRate;

        if (isNewData) {
          setReading(newReading);
          readingRef.current = newReading;
          setLastChanged(newReading.timestamp);
          await saveReadingToSupabase(newReading, projectIdRef.current ?? null);
        }
      } else {
        // fallback: get latest from Supabase if AWS fails
        if (!readingRef.current) {
          const readings = await fetchReadingsFromSupabase(projectIdRef.current);
          if (readings.length > 0) {
            const fallback = readings[readings.length - 1];
            setReading(fallback);
            readingRef.current = fallback;
            setLastChanged(fallback.timestamp);
          } else {
            setError(response.error || "Failed to fetch latest reading");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLatest();

    const interval = setInterval(() => {
      loadLatest();
    }, AWS_CONFIG.REFRESH_INTERVAL);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadLatest();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadLatest]);

  return {
    reading,
    lastChanged,
    isLoading,
    error,
    refresh: loadLatest,
  };
}
