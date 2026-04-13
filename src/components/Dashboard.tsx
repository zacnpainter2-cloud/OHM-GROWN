import { useState, useEffect, useMemo } from "react";
import { HomePage } from "./HomePage";
import { ECPage } from "./ECPage";
import { PHPage } from "./PHPage";
import { TemperaturePage } from "./TemperaturePage";
import { O2Page } from "./O2Page";
import { WaterLevelPage } from "./WaterLevelPage";
import { TranspirationRatePage } from "./TranspirationRatePage";
import { UserManualPage } from "./UserManualPage";
import { ThresholdPage } from "./ThresholdPage";
import { ExportPage } from "./ExportPage";
import { DosingHistoryPage } from "./DosingHistoryPage";
import { AlertHistoryPage } from "./AlertHistoryPage";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Home,
  Zap,
  Droplets,
  Thermometer,
  Wind,
  Waves,
  Leaf,
  BookOpen,
  Settings,
  Download,
  History,
  LogOut,
  Beaker,
  Sun,
  Moon,
  Wrench,
  Activity,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { UnitProvider, useUnits } from "./UnitContext";
import { ThresholdProvider, useThresholds } from "./ThresholdContext";
import { AlertProvider, useAlerts } from "./AlertContext";
import { DosingProvider, useDosing } from "./DosingContext";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";
import { useLatestReading } from "../hooks/useSensorData";

function DashboardContent() {
  const [activeTab, setActiveTab] = useState("home");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isParametersExpanded, setIsParametersExpanded] = useState(true);
  const [isSystemSettingsExpanded, setIsSystemSettingsExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const { logout } = useAuth();
  const { alerts, checkAlerts } = useAlerts();
  const { checkDosingEvents } = useDosing();
  const { thresholds } = useThresholds();
  const { reading: latestReading, lastChanged } = useLatestReading();
  const { theme, toggleTheme } = useTheme();

  const lastUpdatedText = useMemo(() => {
    if (!lastChanged) return "No data";

    const now = Date.now();
    const diff = now - lastChanged;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(lastChanged).toLocaleString();
  }, [lastChanged, currentTime]);

  const isDataStale = useMemo(() => {
    if (!lastChanged) return false;
    const diff = Date.now() - lastChanged;
    return diff > 10 * 60 * 1000;
  }, [lastChanged, currentTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (latestReading) {
      // Thresholds and sensor readings are both stored in Celsius now
      checkAlerts(latestReading, thresholds);
      checkDosingEvents(latestReading);
    }
  }, [latestReading, thresholds, checkAlerts, checkDosingEvents]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const hasAlerts = alerts.length > 0;
  const alertMessages = alerts.map((a) => a.message).join("|");

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="flex items-center gap-2 text-sidebar-foreground">
            <Beaker className="w-6 h-6 text-emerald-400" />
            Menu
          </h1>
        </div>

        {/* Navigation */}

        <nav className="flex-1 p-4 overflow-y-auto space-y-2">
          <button
            onClick={() => setActiveTab("home")}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
              activeTab === "home"
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground hover:bg-sidebar-accent/20"
            }`}
          >
            <Home className="w-5 h-5 text-emerald-400" />
            Home Page
          </button>

          <div className="space-y-1">
            <button
              onClick={() => setIsParametersExpanded(!isParametersExpanded)}
              className="w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-colors text-sidebar-foreground hover:bg-sidebar-accent/20"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-emerald-400" />
                <span>Parameters</span>
              </div>
              {isParametersExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {isParametersExpanded && (
              <div className="ml-4 space-y-1 border-l-2 border-sidebar-border pl-2">
                <button
                  onClick={() => setActiveTab("ec")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                    activeTab === "ec"
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                  }`}
                >
                  <Zap className="w-4 h-4 text-emerald-400" />
                  EC
                </button>

                <button
                  onClick={() => setActiveTab("ph")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                    activeTab === "ph"
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                  }`}
                >
                  <Droplets className="w-4 h-4 text-emerald-400" />
                  pH
                </button>

                <button
                  onClick={() => setActiveTab("temp")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                    activeTab === "temp"
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                  }`}
                >
                  <Thermometer className="w-4 h-4 text-emerald-400" />
                  Temperature
                </button>

                <button
                  onClick={() => setActiveTab("water")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                    activeTab === "water"
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                  }`}
                >
                  <Waves className="w-4 h-4 text-emerald-400" />
                  Water Level
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveTab("thresholds")}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
              activeTab === "thresholds"
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground hover:bg-sidebar-accent/20"
            }`}
          >
            <Wrench className="w-5 h-5 text-emerald-400" />
            Controls
          </button>

          <div className="space-y-1">
            <button
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-colors text-sidebar-foreground hover:bg-sidebar-accent/20"
            >
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-emerald-400" />
                <span>History & Logs</span>
              </div>
              {isHistoryExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {isHistoryExpanded && (
              <div className="ml-4 space-y-1 border-l-2 border-sidebar-border pl-2">
                <button
                  onClick={() => setActiveTab("dosingHistory")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                    activeTab === "dosingHistory"
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                  }`}
                >
                  <History className="w-4 h-4 text-emerald-400" />
                  Dosing History
                </button>

                <button
                  onClick={() => setActiveTab("alertHistory")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                    activeTab === "alertHistory"
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 text-emerald-400" />
                  Alert History
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveTab("export")}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
              activeTab === "export"
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground hover:bg-sidebar-accent/20"
            }`}
          >
            <Download className="w-5 h-5 text-emerald-400" />
            Export
          </button>

          <hr className="my-4 border-sidebar-border" />

          <button
            onClick={logout}
            className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-sidebar-foreground hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-5 h-5 text-red-400" />
            Logout
          </button>
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border shadow-sm">
          <div className="p-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl text-foreground">Hydroponics Dashboard</h2>
              <p className="text-sm text-muted-foreground">{formatDate(currentTime)}</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={toggleTheme}
                variant="outline"
                size="icon"
                className="rounded-full border-2 border-teal-300 dark:border-teal-700 hover:scale-110 transition-transform"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5 text-amber-500" />
                ) : (
                  <Moon className="h-5 w-5 text-indigo-600" />
                )}
                <span className="sr-only">Toggle theme</span>
              </Button>

              <div className="text-right">
                <div className="text-2xl font-mono text-foreground tabular-nums">
                  {formatTime(currentTime)}
                </div>
                <p className={`text-xs ${isDataStale ? "text-destructive" : "text-muted-foreground"}`}>
                  Updated: {lastUpdatedText}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 space-y-2 bg-gradient-to-r from-white via-teal-50/50 to-cyan-50/50 dark:from-gray-950 dark:via-teal-950/50 dark:to-cyan-950/50 border-b border-teal-100 dark:border-teal-800">
          {hasAlerts &&
            alerts.map((alert, index) => (
              <Alert
                key={`${alert.type}-${index}-${alertMessages}`}
                className="border-destructive bg-destructive/10 py-2"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">Alert</AlertTitle>
                <AlertDescription className="text-sm">{alert.message}</AlertDescription>
              </Alert>
            ))}

          {!hasAlerts && (
              <Alert className="border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 py-2">
                <AlertCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertTitle className="text-emerald-900 dark:text-emerald-300 text-sm">
                  All systems normal
                </AlertTitle>
                <AlertDescription className="text-emerald-700 dark:text-emerald-400 text-sm">
                  No active alerts. All parameters within acceptable ranges.
                </AlertDescription>
              </Alert>
            )}
        </div>

        <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-white/50 via-transparent to-teal-50/20 dark:from-gray-950/50 dark:via-transparent dark:to-teal-950/20">
          {activeTab === "home" && <HomePage />}
          {activeTab === "ec" && <ECPage />}
          {activeTab === "ph" && <PHPage />}
          {activeTab === "temp" && <TemperaturePage />}
          {activeTab === "water" && <WaterLevelPage />}
          {activeTab === "thresholds" && <ThresholdPage />}
          {activeTab === "manual" && <div className="max-w-7xl mx-auto"><p>Page removed.</p></div>}
          {activeTab === "export" && <ExportPage />}
          {activeTab === "dosingHistory" && <DosingHistoryPage />}
          {activeTab === "alertHistory" && <AlertHistoryPage />}
        </div>
      </main>
    </div>
  );
}

export function Dashboard() {
  return (
    <UnitProvider>
      <ThresholdProvider>
        <AlertProvider>
          <DosingProvider>
              <DashboardContent />
          </DosingProvider>
        </AlertProvider>
      </ThresholdProvider>
    </UnitProvider>
  );
}
