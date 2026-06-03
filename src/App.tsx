import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { LoginPage } from "@/components/login-page";
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  login,
  storeAuthToken,
  subscribeAuthExpired,
  type LoginCredentials,
} from "@/lib/auth-api";
import type { ThemeMode } from "@/types/theme";

const StockDashboard = lazy(() => import("@/features/stock-board/stock-dashboard"));
const themeStorageKey = "stockpick-theme";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(getStoredAuthToken()));
  const [isLoginPending, setIsLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
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

  useEffect(() => subscribeAuthExpired(() => {
    setIsLoggedIn(false);
    setLoginError("登录状态已失效，请重新登录。");
  }), []);

  const toggleThemeMode = useCallback(() => {
    setThemeMode((mode) => (mode === "dark" ? "light" : "dark"));
  }, []);

  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    setIsLoginPending(true);
    setLoginError(null);

    try {
      const { token } = await login(credentials);

      if (!storeAuthToken(token)) {
        throw new Error("无法保存登录状态，请检查浏览器存储权限。");
      }

      setIsLoggedIn(true);
    } catch (error) {
      clearStoredAuthToken();
      setIsLoggedIn(false);
      setLoginError(error instanceof Error ? error.message : "登录失败，请稍后重试。");
    } finally {
      setIsLoginPending(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearStoredAuthToken();
    setIsLoggedIn(false);
  }, []);

  if (!isLoggedIn) {
    return (
      <LoginPage
        themeMode={themeMode}
        onThemeToggle={toggleThemeMode}
        onLogin={handleLogin}
        isLoginPending={isLoginPending}
        loginError={loginError}
      />
    );
  }

  return (
    <Suspense fallback={<DashboardFallback />}>
      <StockDashboard
        themeMode={themeMode}
        onThemeToggle={toggleThemeMode}
        onLogout={handleLogout}
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
