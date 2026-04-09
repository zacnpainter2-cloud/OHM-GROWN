import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";

export interface ThresholdValues {
  ec: { lower: number; upper: number };
  ph: { lower: number; upper: number };
  temperature: { lower: number; upper: number }; // stored in Celsius
  o2: { lower: number; upper: number }; // stored in %
  waterLevel: { lower: number; upper: number }; // stored in cm
  transpiration: { lower: number; upper: number }; // stored in L/m²/day
}

export interface SetpointValues {
  ec: number;
  ph: number;
}

interface ThresholdContextType {
  thresholds: ThresholdValues;
  setThresholds: (thresholds: ThresholdValues) => void;
  setpoints: SetpointValues;
  setSetpoints: (setpoints: SetpointValues) => void;
  settingsId: number | null;
  saveThresholdSettings: (
    nextThresholds?: ThresholdValues,
    nextSetpoints?: SetpointValues
  ) => Promise<boolean>;
  loading: boolean;
}

const defaultThresholds: ThresholdValues = {
  ec: { lower: 1000, upper: 1800 },
  ph: { lower: 6.5, upper: 8.5 },
  temperature: { lower: 18.3, upper: 26.7 },
  o2: { lower: 6, upper: 12 },
  waterLevel: { lower: 70, upper: 95 },
  transpiration: { lower: 2, upper: 5 },
};

const defaultSetpoints: SetpointValues = {
  ec: 1500,
  ph: 7.0,
};

const ThresholdContext = createContext<ThresholdContextType | undefined>(undefined);

export function ThresholdProvider({ children }: { children: ReactNode }) {
  const [thresholds, setThresholds] = useState<ThresholdValues>(defaultThresholds);
  const [setpoints, setSetpoints] = useState<SetpointValues>(defaultSetpoints);
  const [settingsId, setSettingsId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadThresholdSettings() {
      setLoading(true);

      const { data, error } = await supabase
        .from("control_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("Error loading control settings:", error);
        setLoading(false);
        return;
      }

      setSettingsId(data.id);

      setSetpoints({
        ec: Number(data.ec_setpoint ?? 1500),
        ph: Number(data.ph_setpoint ?? 7.0),
      });

      setThresholds({
        ec: {
          lower: Number(data.ec_lower_threshold ?? 1000),
          upper: Number(data.ec_upper_threshold ?? 1800),
        },
        ph: {
          lower: Number(data.ph_lower_threshold ?? 6.5),
          upper: Number(data.ph_upper_threshold ?? 8.5),
        },
        temperature: {
          lower: Number(data.temperature_lower_threshold ?? 18.3),
          upper: Number(data.temperature_upper_threshold ?? 26.7),
        },
        o2: {
          lower: Number(data.o2_lower_threshold ?? 6),
          upper: Number(data.o2_upper_threshold ?? 12),
        },
        waterLevel: {
          lower: Number(data.water_level_lower_threshold ?? 70),
          upper: Number(data.water_level_upper_threshold ?? 95),
        },
        transpiration: {
          lower: Number(data.transpiration_lower_threshold ?? 2),
          upper: Number(data.transpiration_upper_threshold ?? 5),
        },
      });

      setLoading(false);
    }

    loadThresholdSettings();
  }, []);

  async function saveThresholdSettings(
    nextThresholds?: ThresholdValues,
    nextSetpoints?: SetpointValues
  ) {
    if (!settingsId) {
      console.error("No settings row found to update.");
      return false;
    }

    const thresholdsToSave = nextThresholds ?? thresholds;
    const setpointsToSave = nextSetpoints ?? setpoints;

    const { error } = await supabase
      .from("control_settings")
      .update({
        ph_setpoint: setpointsToSave.ph,
        ec_setpoint: setpointsToSave.ec,
        ec_lower_threshold: thresholdsToSave.ec.lower,
        ec_upper_threshold: thresholdsToSave.ec.upper,
        ph_lower_threshold: thresholdsToSave.ph.lower,
        ph_upper_threshold: thresholdsToSave.ph.upper,
        temperature_lower_threshold: thresholdsToSave.temperature.lower,
        temperature_upper_threshold: thresholdsToSave.temperature.upper,
        o2_lower_threshold: thresholdsToSave.o2.lower,
        o2_upper_threshold: thresholdsToSave.o2.upper,
        water_level_lower_threshold: thresholdsToSave.waterLevel.lower,
        water_level_upper_threshold: thresholdsToSave.waterLevel.upper,
        transpiration_lower_threshold: thresholdsToSave.transpiration.lower,
        transpiration_upper_threshold: thresholdsToSave.transpiration.upper,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settingsId);

    if (error) {
      console.error("Error saving control settings:", error);
      return false;
    }

    return true;
  }

  return (
    <ThresholdContext.Provider
      value={{
        thresholds,
        setThresholds,
        setpoints,
        setSetpoints,
        settingsId,
        saveThresholdSettings,
        loading,
      }}
    >
      {children}
    </ThresholdContext.Provider>
  );
}

export function useThresholds() {
  const context = useContext(ThresholdContext);
  if (!context) {
    throw new Error("useThresholds must be used within ThresholdProvider");
  }
  return context;
}
