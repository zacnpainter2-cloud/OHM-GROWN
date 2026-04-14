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
async function saveReadingToSupabase(reading: SensorReading) {
  try {
    // Skip saving bad readings with all-zero critical values
    if (reading.temperature === 0 && reading.ph === 0 && reading.ec === 0) {
      console.warn('Skipping save of invalid reading with all-zero values');
      return;
    }

    // Upsert with ignoreDuplicates — silently skips if recorded_at already exists
    const { error } = await supabase
      .from("measurements")
      .upsert([
        {
          recorded_at: new Date(reading.timestamp).toISOString(),
          ec: reading.ec,
          ph: reading.ph,
          temperature: reading.temperature,
          dissolved_oxygen: reading.o2,
          water_level: reading.waterLevel,
          transpiration_rate: reading.transpirationRate,
          ec_dosing_flag: reading.ecDosingFlag ?? 0,
          ph_dosing_flag: reading.phDosingFlag ?? 0,
          water_flow_ok: reading.waterFlowOk ?? 1,
          network_status: "online",
        },
      ], { onConflict: 'recorded_at', ignoreDuplicates: true });

    if (error) {
      console.error("Failed to save reading to Supabase:", error);
    }
  } catch (err) {
    console.error("Unexpected Supabase save error:", err);
  }
}

/**
 * Load last 180 days of readings from Supabase
 * Paginates in chunks of 1000 (Supabase default row limit)
 */
async function fetchReadingsFromSupabase(): Promise<SensorReading[]> {
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
      ecDosingFlag: row.ec_dosing_flag != null ? Number(row.ec_dosing_flag) : undefined,
      phDosingFlag: row.ph_dosing_flag != null ? Number(row.ph_dosing_flag) : undefined,
      waterFlowOk: row.water_flow_ok != null ? Number(row.water_flow_ok) : undefined,
    })).filter((r) => !(r.temperature === 0 && r.ph === 0 && r.ec === 0));
  } catch (err) {
    console.error("Unexpected Supabase fetch error:", err);
    return [];
  }
}

export function useSensorData(): UseSensorDataResult {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const latestReadingRef = useRef<SensorReading | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const hasBackfilled = useRef(false);
  const hasInitialLoad = useRef(false);

  const loadData = useCallback(async () => {
    try {
      // Only show loading on initial load, not on subsequent polls
      if (!latestReadingRef.current) {
        setIsLoading(true);
      }
      setError(null);

      // On first load, fetch full history from Supabase
      if (!hasInitialLoad.current) {
        hasInitialLoad.current = true;
        const dbReadings = await fetchReadingsFromSupabase();
        setReadings(dbReadings);
        if (dbReadings.length > 0) {
          const latest = dbReadings[dbReadings.length - 1];
          setLatestReading(latest);
          latestReadingRef.current = latest;
          setLastUpdated(latest.timestamp);
        }
      }

      // Fetch latest from AWS
      const response = await fetchLatestReading();

      if (response.success && response.data) {
        const newReading = response.data;

        // Check if this is a genuinely new reading (different timestamp OR different values)
        const prev = latestReadingRef.current;
        const isNewTimestamp = !prev || prev.timestamp !== newReading.timestamp;
        const isNewValues = !prev ||
          prev.ec !== newReading.ec ||
          prev.ph !== newReading.ph ||
          prev.temperature !== newReading.temperature ||
          prev.o2 !== newReading.o2 ||
          prev.waterLevel !== newReading.waterLevel ||
          prev.transpirationRate !== newReading.transpirationRate;

        // Always update lastUpdated when we get a new timestamp (proves connection is alive)
        if (isNewTimestamp) {
          setLastUpdated(newReading.timestamp);
        }

        if (isNewTimestamp || isNewValues) {
          setLatestReading(newReading);
          latestReadingRef.current = newReading;

          // Update UI immediately, then save to Supabase in background
          setReadings(prev => {
            // Avoid duplicate timestamps
            if (prev.length > 0 && prev[prev.length - 1].timestamp === newReading.timestamp) {
              return prev;
            }
            // Trim old readings beyond 180 days
            const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
            const trimmed = prev.filter(r => r.timestamp >= cutoff);
            return [...trimmed, newReading];
          });

          // Fire-and-forget Supabase save (don't block UI)
          saveReadingToSupabase(newReading).catch(err =>
            console.error('Background save failed:', err)
          );
        }
      } else {
        console.warn("AWS latest reading fetch failed:", response.error);
      }
    } catch (err) {
      console.error("useSensorData: Error loading sensor data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Backfill: on first load, fetch any DynamoDB readings missed while site was closed
  useEffect(() => {
    if (hasBackfilled.current) return;
    hasBackfilled.current = true;

    (async () => {
      try {
        // Find the most recent Supabase entry
        let latestQuery = supabase
          .from("measurements")
          .select("recorded_at")
          .order("recorded_at", { ascending: false })
          .limit(1);

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
          ec_dosing_flag: r.ecDosingFlag ?? 0,
          ph_dosing_flag: r.phDosingFlag ?? 0,
          water_flow_ok: r.waterFlowOk ?? 1,
          network_status: "online",
        }));

        // Upsert in batches of 500 — silently skip duplicates via unique constraint
        const BATCH_SIZE = 500;
        let inserted = 0;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const { error: upsertErr } = await supabase
            .from("measurements")
            .upsert(batch, { onConflict: 'recorded_at', ignoreDuplicates: true });

          if (upsertErr) {
            console.warn("Backfill upsert error:", upsertErr);
          } else {
            inserted += batch.length;
          }
        }

        console.log(`Backfill complete: imported ${inserted} readings`);

        // Merge backfill data into existing state (don't re-fetch entire history)
        if (result.data && result.data.length > 0) {
          const validBackfill = result.data.filter(
            (r) => !(r.temperature === 0 && r.ph === 0 && r.ec === 0)
          );
          if (validBackfill.length > 0) {
            setReadings(prev => {
              const existingTimestamps = new Set(prev.map(r => r.timestamp));
              const newOnly = validBackfill.filter(r => !existingTimestamps.has(r.timestamp));
              if (newOnly.length === 0) return prev;
              const merged = [...prev, ...newOnly].sort((a, b) => a.timestamp - b.timestamp);
              return merged;
            });
          }
        }
      } catch (err) {
        console.error("Backfill failed:", err);
      }
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, AWS_CONFIG.REFRESH_INTERVAL);

    // When tab becomes visible again, fetch latest AND backfill any gap
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      // Fetch latest reading immediately
      loadData();

      // Backfill the gap from DynamoDB if we've been away > 2 minutes
      const lastTs = latestReadingRef.current?.timestamp;
      if (!lastTs) return;
      const gapMs = Date.now() - lastTs;
      if (gapMs < 2 * 60 * 1000) return; // less than 2 min gap, skip

      try {
        const startSec = Math.floor(lastTs / 1000) + 1;
        const endSec = Math.floor(Date.now() / 1000);
        console.log(`Tab resumed: backfilling ${Math.round(gapMs / 60000)}min gap from DynamoDB...`);

        const result = await fetchReadingsFromDynamo(startSec, endSec);
        if (!result.success || !result.data || result.data.length === 0) return;

        const valid = result.data.filter(
          r => !(r.temperature === 0 && r.ph === 0 && r.ec === 0)
        );
        if (valid.length === 0) return;

        // Merge into state
        setReadings(prev => {
          const existingTs = new Set(prev.map(r => r.timestamp));
          const newOnly = valid.filter(r => !existingTs.has(r.timestamp));
          if (newOnly.length === 0) return prev;
          return [...prev, ...newOnly].sort((a, b) => a.timestamp - b.timestamp);
        });

        // Save to Supabase in background
        const rows = valid.map(r => ({
          recorded_at: new Date(r.timestamp).toISOString(),
          ec: r.ec, ph: r.ph, temperature: r.temperature,
          dissolved_oxygen: r.o2, water_level: r.waterLevel,
          transpiration_rate: r.transpirationRate ?? 0,
          ec_dosing_flag: r.ecDosingFlag ?? 0,
          ph_dosing_flag: r.phDosingFlag ?? 0,
          water_flow_ok: r.waterFlowOk ?? 1,
          network_status: "online",
        }));
        for (let i = 0; i < rows.length; i += 500) {
          supabase
            .from("measurements")
            .upsert(rows.slice(i, i + 500), { onConflict: 'recorded_at', ignoreDuplicates: true })
            .then(({ error }) => { if (error) console.warn("Gap backfill upsert error:", error); });
        }
        console.log(`Tab resumed: backfilled ${valid.length} readings`);
      } catch (err) {
        console.error("Tab resume backfill failed:", err);
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
 * Polls AWS for the latest reading; does NOT re-fetch full history.
 * Supabase saving is handled by useSensorData.
 */
export function useLatestReading() {
  const [reading, setReading] = useState<SensorReading | null>(null);
  const readingRef = useRef<SensorReading | null>(null);
  const [lastChanged, setLastChanged] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const isNewTimestamp = !prev || prev.timestamp !== newReading.timestamp;
        const isNewValues = !prev ||
          prev.ec !== newReading.ec ||
          prev.ph !== newReading.ph ||
          prev.temperature !== newReading.temperature ||
          prev.o2 !== newReading.o2 ||
          prev.waterLevel !== newReading.waterLevel ||
          prev.transpirationRate !== newReading.transpirationRate ||
          prev.ecDosingFlag !== newReading.ecDosingFlag ||
          prev.phDosingFlag !== newReading.phDosingFlag;

        if (isNewTimestamp || isNewValues) {
          setReading(newReading);
          readingRef.current = newReading;
          setLastChanged(newReading.timestamp);
        }
      } else {
        // Fallback: get only the single latest row from Supabase
        if (!readingRef.current) {
          const { data, error: fetchErr } = await supabase
            .from("measurements")
            .select("*")
            .order("recorded_at", { ascending: false })
            .limit(1);

          if (!fetchErr && data && data.length > 0) {
            const row = data[0];
            const fallback: SensorReading = {
              deviceId: String(row.device_id ?? ""),
              timestamp: new Date(row.recorded_at).getTime(),
              ec: Number(row.ec ?? 0),
              ph: Number(row.ph ?? 0),
              temperature: Number(row.temperature ?? 0),
              o2: Number(row.dissolved_oxygen ?? 0),
              waterLevel: Number(row.water_level ?? 0),
              transpirationRate: Number(row.transpiration_rate ?? 0),
              ecDosingFlag: row.ec_dosing_flag != null ? Number(row.ec_dosing_flag) : undefined,
              phDosingFlag: row.ph_dosing_flag != null ? Number(row.ph_dosing_flag) : undefined,
              waterFlowOk: row.water_flow_ok != null ? Number(row.water_flow_ok) : undefined,
            };
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
