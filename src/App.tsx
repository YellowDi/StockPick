import { lazy, Suspense, useEffect, useState } from "react";

import { LoginPage } from "@/components/login-page";
import type { ThemeMode } from "@/types/theme";

const StockDashboard = lazy(() => import("@/features/stock-board/stock-dashboard"));
const themeStorageKey = "stockpick-theme";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const storedTheme = window.localStorage.getItem(themeStorageKey);

      return storedTheme === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");

    try {
      window.localStorage.setItem(themeStorageKey, themeMode);
    } catch {
      // Keep theme switching usable if browser storage is unavailable.
    }
  }, [themeMode]);

  function toggleThemeMode() {
    setThemeMode((mode) => (mode === "dark" ? "light" : "dark"));
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        themeMode={themeMode}
        onThemeToggle={toggleThemeMode}
        onLogin={() => setIsLoggedIn(true)}
      />
    );
  }

  return (
    <Suspense fallback={<DashboardFallback />}>
      <StockDashboard
        themeMode={themeMode}
        onThemeToggle={toggleThemeMode}
        onLogout={() => setIsLoggedIn(false)}
      />
    </Suspense>
  );
}

function DashboardFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      加载看板...
    </main>
  );
}

export default App;
