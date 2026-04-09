import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { Moon, Sun } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import tigerPawLogo from "figma:asset/742ba61785bcf78e696e6c5e4cb920988f908f87.png";

export function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(password);
    
    if (!success) {
      setError(true);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 dark:from-gray-950 dark:via-teal-950 dark:to-emerald-950 flex items-center justify-center p-4 relative">
      {/* Dark Mode Toggle Button - Top Right */}
      <Button
        onClick={toggleTheme}
        variant="outline"
        size="icon"
        className="absolute top-4 right-4 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-2 border-teal-200 dark:border-teal-700 shadow-lg hover:scale-110 transition-transform"
      >
        {theme === "dark" ? (
          <Sun className="h-5 w-5 text-amber-500" />
        ) : (
          <Moon className="h-5 w-5 text-indigo-600" />
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>

      <Card className="w-full max-w-md shadow-lg border-2 border-teal-100 dark:border-teal-800">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <img 
              src={tigerPawLogo} 
              alt="Clemson Tiger Paw Logo" 
              className="w-24 h-24 object-contain"
            />
          </div>
          <div>
            <CardTitle className="text-2xl">Hydroponics System</CardTitle>
            <CardDescription className="mt-2">
              Enter your password to access the dashboard
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="Enter password"
                autoFocus
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  Incorrect password. Please try again.
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600">
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}