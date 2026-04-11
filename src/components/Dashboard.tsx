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
import { CorrelationPage } from "./CorrelationPage";
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
  FolderPlus,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { UnitProvider, useUnits } from "./UnitContext";
import { ThresholdProvider, useThresholds } from "./ThresholdContext";
import { AlertProvider, useAlerts } from "./AlertContext";
import { DosingProvider, useDosing } from "./DosingContext";
import { ProjectProvider, useProject } from "./ProjectContext";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";
import { useLatestReading } from "../hooks/useSensorData";

function DashboardContent() {
  const [activeTab, setActiveTab] = useState("home");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isParametersExpanded, setIsParametersExpanded] = useState(true);
  const [isSystemSettingsExpanded, setIsSystemSettingsExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const { logout } = useAuth();
  const { alerts, checkAlerts, maintenanceMode } = useAlerts();
  const { checkDosingEvents } = useDosing();
  const { thresholds } = useThresholds();
  const { projects, activeProject, viewingProject, setViewingProject, createNewProject, deleteProject, isViewingOldProject } = useProject();
  const { reading: latestReading, lastChanged } = useLatestReading(activeProject?.id);
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

        {/* Project Selector */}
        <div className="p-4 border-b border-sidebar-border space-y-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            <select
              value={viewingProject?.id ?? ""}
              onChange={(e) => {
                const p = projects.find((proj) => proj.id === Number(e.target.value));
                if (p) setViewingProject(p);
              }}
              className="flex-1 bg-sidebar text-sidebar-foreground text-sm border border-sidebar-border rounded px-2 py-1"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.is_active ? " (active)" : ""}
                </option>
              ))}
            </select>
          </div>

          {isViewingOldProject && (
            <div className="text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1 flex items-center justify-between">
              <span>Viewing old project — read-only</span>
              <button
                onClick={async () => {
                  if (viewingProject && confirm(`Delete "${viewingProject.name}" and all its data? This cannot be undone.`)) {
                    await deleteProject(viewingProject.id);
                  }
                }}
                className="ml-2 text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-red-500/20"
                title="Delete this project"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          {!showNewProjectInput ? (
            <Button
              onClick={() => setShowNewProjectInput(true)}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              <FolderPlus className="w-3 h-3 mr-1" />
              New Project
            </Button>
          ) : (
            <div className="space-y-1">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                className="w-full bg-sidebar text-sidebar-foreground text-sm border border-sidebar-border rounded px-2 py-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowNewProjectInput(false);
                    setNewProjectName("");
                  }
                }}
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  disabled={!newProjectName.trim()}
                  onClick={async () => {
                    const ok = await createNewProject(newProjectName.trim());
                    if (ok) {
                      setNewProjectName("");
                      setShowNewProjectInput(false);
                    }
                  }}
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    setShowNewProjectInput(false);
                    setNewProjectName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

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
                  onClick={() => setActiveTab("o2")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                    activeTab === "o2"
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                  }`}
                >
                  <Wind className="w-4 h-4 text-emerald-400" />
                  O2
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

                <button
                  onClick={() => setActiveTab("transpiration")}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 transition-colors text-sm ${
                    activeTab === "transpiration"
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/20"
                  }`}
                >
                  <Leaf className="w-4 h-4 text-emerald-400" />
                  Transpiration Rate
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
            onClick={() => setActiveTab("correlation")}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
              activeTab === "correlation"
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground hover:bg-sidebar-accent/20"
            }`}
          >
            <Activity className="w-5 h-5 text-cyan-400" />
            Correlation Analysis
          </button>

          <button
            onClick={() => setActiveTab("manual")}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
              activeTab === "manual"
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground hover:bg-sidebar-accent/20"
            }`}
          >
            <BookOpen className="w-5 h-5 text-emerald-400" />
            User Manual
          </button>

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
          {maintenanceMode && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 py-2">
              <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-amber-900 dark:text-amber-300 text-sm">
                Maintenance mode on
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                All alerts are currently disabled for system maintenance
              </AlertDescription>
            </Alert>
          )}

          {!maintenanceMode &&
            hasAlerts &&
            alerts.map((alert, index) => (
              <Alert
                key={`${alert.type}-${index}-${alertMessages}`}
                className="border-destructive bg-destructive/10 py-2"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">{alert.type}</AlertTitle>
                <AlertDescription className="text-sm">{alert.message}</AlertDescription>
              </Alert>
            ))}

          {!maintenanceMode &&
            !hasAlerts && (
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
          {activeTab === "o2" && <O2Page />}
          {activeTab === "water" && <WaterLevelPage />}
          {activeTab === "transpiration" && <TranspirationRatePage />}
          {activeTab === "thresholds" && <ThresholdPage />}
          {activeTab === "manual" && <UserManualPage />}
          {activeTab === "export" && <ExportPage />}
          {activeTab === "dosingHistory" && <DosingHistoryPage />}
          {activeTab === "alertHistory" && <AlertHistoryPage />}
          {activeTab === "correlation" && <CorrelationPage />}
        </div>
      </main>
    </div>
  );
}

export function Dashboard() {
  return (
    <UnitProvider>
      <ProjectProvider>
        <ThresholdProvider>
          <AlertProvider>
            <DosingProvider>
                <DashboardContent />
            </DosingProvider>
          </AlertProvider>
        </ThresholdProvider>
      </ProjectProvider>
    </UnitProvider>
  );
}
