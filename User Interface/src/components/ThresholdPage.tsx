import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Zap, Droplets, Thermometer, Waves, Wind, Leaf } from "lucide-react";
import { useThresholds } from "./ThresholdContext";
import { useUnits } from "./UnitContext";
import { sendThresholdsAndSetpoints } from "../services/aws-data-service";
import { toast } from "sonner";

interface LocalThresholdValues {
  ec: { lower: string; upper: string };
  ph: { lower: string; upper: string };
  temperature: { lower: string; upper: string };
  o2: { lower: string; upper: string };
  waterLevel: { lower: string; upper: string };
  transpiration: { lower: string; upper: string };
}

interface LocalSetpointValues {
  ec: string;
  ph: string;
}

function celsiusToFahrenheit(value: number) {
  return (value * 9) / 5 + 32;
}

function fahrenheitToCelsius(value: number) {
  return ((value - 32) * 5) / 9;
}

function cmToInches(value: number) {
  return value / 2.54;
}

function inchesToCm(value: number) {
  return value * 2.54;
}

export function ThresholdPage() {
  const {
    thresholds: contextThresholds,
    setThresholds: setContextThresholds,
    setpoints: contextSetpoints,
    setSetpoints: setContextSetpoints,
    saveThresholdSettings,
    loading,
  } = useThresholds();

  const { tempUnit, setTempUnit, waterLevelUnit, setWaterLevelUnit } = useUnits();

  const [localThresholds, setLocalThresholds] = useState<LocalThresholdValues>({
    ec: { lower: "1000", upper: "1800" },
    ph: { lower: "6.5", upper: "8.5" },
    temperature: { lower: "18.3", upper: "26.7" },
    o2: { lower: "6", upper: "12" },
    waterLevel: { lower: "70", upper: "95" },
    transpiration: { lower: "2", upper: "5" },
  });

  const [localSetpoints, setLocalSetpoints] = useState<LocalSetpointValues>({
    ec: "1500",
    ph: "7.0",
  });

  useEffect(() => {
    const tempLower = contextThresholds.temperature.lower;
    const tempUpper = contextThresholds.temperature.upper;
    const waterLower = contextThresholds.waterLevel.lower;
    const waterUpper = contextThresholds.waterLevel.upper;

    setLocalThresholds({
      ec: {
        lower: contextThresholds.ec.lower.toString(),
        upper: contextThresholds.ec.upper.toString(),
      },
      ph: {
        lower: contextThresholds.ph.lower.toString(),
        upper: contextThresholds.ph.upper.toString(),
      },
      temperature: {
        lower: (tempUnit === "F" ? celsiusToFahrenheit(tempLower) : tempLower).toFixed(1),
        upper: (tempUnit === "F" ? celsiusToFahrenheit(tempUpper) : tempUpper).toFixed(1),
      },
      o2: {
        lower: contextThresholds.o2.lower.toString(),
        upper: contextThresholds.o2.upper.toString(),
      },
      waterLevel: {
        lower: (waterLevelUnit === "in" ? cmToInches(waterLower) : waterLower).toFixed(1),
        upper: (waterLevelUnit === "in" ? cmToInches(waterUpper) : waterUpper).toFixed(1),
      },
      transpiration: {
        lower: contextThresholds.transpiration.lower.toString(),
        upper: contextThresholds.transpiration.upper.toString(),
      },
    });

    setLocalSetpoints({
      ec: contextSetpoints.ec.toString(),
      ph: contextSetpoints.ph.toString(),
    });
  }, [contextThresholds, contextSetpoints, tempUnit, waterLevelUnit]);

  const validationErrors = useMemo(() => {
    const errors: Partial<Record<keyof LocalThresholdValues | 'ecSetpoint' | 'phSetpoint', string>> = {};
    const params: (keyof LocalThresholdValues)[] = ['ec', 'ph', 'temperature', 'o2', 'waterLevel', 'transpiration'];
    for (const param of params) {
      const lower = parseFloat(localThresholds[param].lower);
      const upper = parseFloat(localThresholds[param].upper);
      if (!isNaN(lower) && !isNaN(upper) && lower > upper) {
        errors[param] = 'Lower threshold cannot be greater than upper threshold';
      }
    }

    // Validate setpoints are within their threshold range
    const ecSetpoint = parseFloat(localSetpoints.ec);
    const ecLower = parseFloat(localThresholds.ec.lower);
    const ecUpper = parseFloat(localThresholds.ec.upper);
    if (!isNaN(ecSetpoint) && !isNaN(ecLower) && !isNaN(ecUpper)) {
      if (ecSetpoint < ecLower || ecSetpoint > ecUpper) {
        errors.ecSetpoint = `Setpoint must be between ${localThresholds.ec.lower} and ${localThresholds.ec.upper}`;
      }
    }

    const phSetpoint = parseFloat(localSetpoints.ph);
    const phLower = parseFloat(localThresholds.ph.lower);
    const phUpper = parseFloat(localThresholds.ph.upper);
    if (!isNaN(phSetpoint) && !isNaN(phLower) && !isNaN(phUpper)) {
      if (phSetpoint < phLower || phSetpoint > phUpper) {
        errors.phSetpoint = `Setpoint must be between ${localThresholds.ph.lower} and ${localThresholds.ph.upper}`;
      }
    }

    return errors;
  }, [localThresholds, localSetpoints]);

  const hasErrors = Object.keys(validationErrors).length > 0;

  const handleInputChange = (
    parameter: keyof LocalThresholdValues,
    type: "lower" | "upper",
    value: string
  ) => {
    setLocalThresholds((prev) => ({
      ...prev,
      [parameter]: {
        ...prev[parameter],
        [type]: value,
      },
    }));
  };

  const handleSaveAll = async () => {
    if (hasErrors) {
      toast.error('Please fix validation errors before saving.');
      return;
    }

    // Convert temperature from display unit to Celsius for storage
    let tempLower = parseFloat(localThresholds.temperature.lower) || 18.3;
    let tempUpper = parseFloat(localThresholds.temperature.upper) || 26.7;
    if (tempUnit === "F") {
      tempLower = fahrenheitToCelsius(tempLower);
      tempUpper = fahrenheitToCelsius(tempUpper);
    }

    // Convert water level from display unit to cm for storage
    let waterLower = parseFloat(localThresholds.waterLevel.lower) || 70;
    let waterUpper = parseFloat(localThresholds.waterLevel.upper) || 95;
    if (waterLevelUnit === "in") {
      waterLower = inchesToCm(waterLower);
      waterUpper = inchesToCm(waterUpper);
    }

    const thresholds = {
      ec: {
        lower: parseFloat(localThresholds.ec.lower) || 1000,
        upper: parseFloat(localThresholds.ec.upper) || 1800,
      },
      ph: {
        lower: parseFloat(localThresholds.ph.lower) || 6.5,
        upper: parseFloat(localThresholds.ph.upper) || 8.5,
      },
      temperature: {
        lower: tempLower,
        upper: tempUpper,
      },
      o2: {
        lower: parseFloat(localThresholds.o2.lower) || 6,
        upper: parseFloat(localThresholds.o2.upper) || 12,
      },
      waterLevel: {
        lower: waterLower,
        upper: waterUpper,
      },
      transpiration: {
        lower: parseFloat(localThresholds.transpiration.lower) || 2,
        upper: parseFloat(localThresholds.transpiration.upper) || 5,
      },
    };

    const setpoints = {
      ec: parseFloat(localSetpoints.ec) || 1500,
      ph: parseFloat(localSetpoints.ph) || 7.0,
    };

    setContextThresholds(thresholds);
    setContextSetpoints(setpoints);

    toast.loading("Saving to cloud...");

    const dbSuccess = await saveThresholdSettings(thresholds, setpoints);

    if (!dbSuccess) {
      toast.dismiss();
      toast.error("Failed to save settings to database");
      return;
    }

    const result = await sendThresholdsAndSetpoints(thresholds, setpoints);

    toast.dismiss();

    if (result.success) {
      toast.success("All settings saved and sent to microcontroller successfully!");
    } else {
      toast.error(`Saved to database, but failed to send to device: ${result.error}`);
    }
  };

  const handleReset = () => {
    setLocalThresholds({
      ec: { lower: "1000", upper: "1800" },
      ph: { lower: "6.5", upper: "8.5" },
      temperature: { lower: "18.3", upper: "26.7" },
      o2: { lower: "6", upper: "12" },
      waterLevel: { lower: "70", upper: "95" },
      transpiration: { lower: "2", upper: "5" },
    });

    setLocalSetpoints({
      ec: "1500",
      ph: "7.0",
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl">Controls</h2>
        <p className="text-muted-foreground">
          Configure setpoints and threshold boundaries for water quality parameters.
        </p>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">
          Loading settings from cloud...
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg">Setpoints</h3>
        <p className="text-sm text-muted-foreground">
          Set target values for automated dosing control
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-primary" />
                pH Setpoint
              </CardTitle>
              <CardDescription>Target pH value for dosing control</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="ph-setpoint">pH Setpoint</Label>
                <Input
                  id="ph-setpoint"
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  value={localSetpoints.ph}
                  onChange={(e) =>
                    setLocalSetpoints((prev) => ({ ...prev, ph: e.target.value }))
                  }
                  placeholder="e.g., 7.0"
                />
              </div>
              {validationErrors.phSetpoint && (
                <p className="text-sm text-destructive">{validationErrors.phSetpoint}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                EC Setpoint
              </CardTitle>
              <CardDescription>Electrical Conductivity (μS/cm)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ec-setpoint">EC Setpoint (μS/cm)</Label>
                <Input
                  id="ec-setpoint"
                  type="number"
                  step="0.1"
                  min="0"
                  value={localSetpoints.ec}
                  onChange={(e) =>
                    setLocalSetpoints((prev) => ({ ...prev, ec: e.target.value }))
                  }
                  placeholder="e.g., 1500"
                />
              </div>
              {validationErrors.ecSetpoint && (
                <p className="text-sm text-destructive">{validationErrors.ecSetpoint}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-border">
        <h3 className="text-lg">Threshold Settings</h3>
        <p className="text-sm text-muted-foreground">
          Set the lower and upper boundaries for each water quality parameter.
          The system will trigger alerts when values fall outside these ranges.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                EC
              </CardTitle>
              <CardDescription>Electrical Conductivity (μS/cm)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ec-lower">Lower Threshold</Label>
                <Input
                  id="ec-lower"
                  type="number"
                  value={localThresholds.ec.lower}
                  onChange={(e) => handleInputChange("ec", "lower", e.target.value)}
                  placeholder="e.g., 1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ec-upper">Upper Threshold</Label>
                <Input
                  id="ec-upper"
                  type="number"
                  value={localThresholds.ec.upper}
                  onChange={(e) => handleInputChange("ec", "upper", e.target.value)}
                  placeholder="e.g., 1800"
                />
              </div>
              {validationErrors.ec && (
                <p className="text-sm text-destructive">{validationErrors.ec}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-primary" />
                pH
              </CardTitle>
              <CardDescription>pH Level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ph-lower">Lower Threshold</Label>
                <Input
                  id="ph-lower"
                  type="number"
                  step="0.1"
                  value={localThresholds.ph.lower}
                  onChange={(e) => handleInputChange("ph", "lower", e.target.value)}
                  placeholder="e.g., 6.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ph-upper">Upper Threshold</Label>
                <Input
                  id="ph-upper"
                  type="number"
                  step="0.1"
                  value={localThresholds.ph.upper}
                  onChange={(e) => handleInputChange("ph", "upper", e.target.value)}
                  placeholder="e.g., 8.5"
                />
              </div>
              {validationErrors.ph && (
                <p className="text-sm text-destructive">{validationErrors.ph}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-primary" />
                Temperature
              </CardTitle>
              <CardDescription>Water Temperature</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Unit:</span>
                <ToggleGroup
                  type="single"
                  value={tempUnit}
                  onValueChange={(value) => value && setTempUnit(value as "F" | "C")}
                  size="sm"
                >
                  <ToggleGroupItem value="F" aria-label="Fahrenheit">
                    °F
                  </ToggleGroupItem>
                  <ToggleGroupItem value="C" aria-label="Celsius">
                    °C
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="temp-lower">Lower Threshold (°{tempUnit})</Label>
                <Input
                  id="temp-lower"
                  type="number"
                  step="0.1"
                  value={localThresholds.temperature.lower}
                  onChange={(e) => handleInputChange("temperature", "lower", e.target.value)}
                  placeholder={tempUnit === "C" ? "e.g., 18.3" : "e.g., 65"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temp-upper">Upper Threshold (°{tempUnit})</Label>
                <Input
                  id="temp-upper"
                  type="number"
                  step="0.1"
                  value={localThresholds.temperature.upper}
                  onChange={(e) => handleInputChange("temperature", "upper", e.target.value)}
                  placeholder={tempUnit === "C" ? "e.g., 26.7" : "e.g., 80"}
                />
              </div>
              {validationErrors.temperature && (
                <p className="text-sm text-destructive">{validationErrors.temperature}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Waves className="w-5 h-5 text-primary" />
                Water Level
              </CardTitle>
              <CardDescription>Reservoir Level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Unit:</span>
                <ToggleGroup
                  type="single"
                  value={waterLevelUnit}
                  onValueChange={(value) =>
                    value && setWaterLevelUnit(value as "cm" | "in")
                  }
                  size="sm"
                >
                  <ToggleGroupItem value="cm" aria-label="Centimeters">
                    cm
                  </ToggleGroupItem>
                  <ToggleGroupItem value="in" aria-label="Inches">
                    in
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="water-lower">Lower Threshold ({waterLevelUnit})</Label>
                <Input
                  id="water-lower"
                  type="number"
                  step="0.1"
                  value={localThresholds.waterLevel.lower}
                  onChange={(e) => handleInputChange("waterLevel", "lower", e.target.value)}
                  placeholder={waterLevelUnit === "cm" ? "e.g., 70" : "e.g., 27.6"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="water-upper">Upper Threshold ({waterLevelUnit})</Label>
                <Input
                  id="water-upper"
                  type="number"
                  step="0.1"
                  value={localThresholds.waterLevel.upper}
                  onChange={(e) => handleInputChange("waterLevel", "upper", e.target.value)}
                  placeholder={waterLevelUnit === "cm" ? "e.g., 95" : "e.g., 37.4"}
                />
              </div>
              {validationErrors.waterLevel && (
                <p className="text-sm text-destructive">{validationErrors.waterLevel}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex gap-4 pt-6">
        <Button onClick={handleSaveAll} size="lg" className="flex-1" disabled={loading || hasErrors}>
          Save All Settings
        </Button>
        <Button onClick={handleReset} variant="outline" size="lg" disabled={loading}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
