import { Dashboard } from "./components/Dashboard";
import { LoginPage } from "./components/LoginPage";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { ThemeProvider } from "./components/ThemeContext";
import { Toaster } from "./components/ui/sonner";

function AppContent() {
  const { isAuthenticated } = useAuth();
  
  return isAuthenticated ? <Dashboard /> : <LoginPage />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
