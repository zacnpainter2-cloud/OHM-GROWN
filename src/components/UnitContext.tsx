import { createContext, useContext, useState, ReactNode } from "react";

interface UnitContextType {
  tempUnit: "F" | "C";
  waterLevelUnit: "cm" | "in";
  setTempUnit: (unit: "F" | "C") => void;
  setWaterLevelUnit: (unit: "cm" | "in") => void;
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export function UnitProvider({ children }: { children: ReactNode }) {
  const [tempUnit, setTempUnitState] = useState<"F" | "C">(() => {
    const saved = localStorage.getItem("hydro-temp-unit");
    return saved === "F" || saved === "C" ? saved : "C";
  });
  const [waterLevelUnit, setWaterLevelUnitState] = useState<"cm" | "in">(() => {
    const saved = localStorage.getItem("hydro-water-unit");
    return saved === "cm" || saved === "in" ? saved : "in";
  });

  const setTempUnit = (unit: "F" | "C") => {
    setTempUnitState(unit);
    localStorage.setItem("hydro-temp-unit", unit);
  };

  const setWaterLevelUnit = (unit: "cm" | "in") => {
    setWaterLevelUnitState(unit);
    localStorage.setItem("hydro-water-unit", unit);
  };

  return (
    <UnitContext.Provider
      value={{
        tempUnit,
        waterLevelUnit,
        setTempUnit,
        setWaterLevelUnit,
      }}
    >
      {children}
    </UnitContext.Provider>
  );
}

export function useUnits() {
  const context = useContext(UnitContext);
  if (context === undefined) {
    throw new Error("useUnits must be used within a UnitProvider");
  }
  return context;
}