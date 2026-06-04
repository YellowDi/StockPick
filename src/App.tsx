import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Skeleton, toast } from "@heroui/react";

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
  const themeMode: ThemeMode = "dark";

  useEffect(() => {
    document.documentElement.classList.add("dark");

    try {
      window.localStorage.setItem(themeStorageKey, "dark");
    } catch {
      // Keep the app usable if browser storage is unavailable.
    }
  }, []);

  useEffect(() => subscribeAuthExpired(() => {
    toast.warning("登录状态已失效", {
      description: "请重新登录。",
    });
    setIsLoggedIn(false);
    setLoginError("登录状态已失效，请重新登录。");
  }), []);

  const toggleThemeMode = useCallback(() => {}, []);

  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    setIsLoginPending(true);
    setLoginError(null);

    try {
      const { token } = await login(credentials);

      if (!storeAuthToken(token)) {
        throw new Error("无法保存登录状态，请检查浏览器存储权限。");
      }

      setIsLoggedIn(true);
      toast.success("登录成功");
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败，请稍后重试。";

      clearStoredAuthToken();
      setIsLoggedIn(false);
      setLoginError(message);
      toast.danger("登录失败", {
        description: message,
      });
    } finally {
      setIsLoginPending(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearStoredAuthToken();
    setIsLoggedIn(false);
    toast.info("已退出登录");
  }, []);

  const content = !isLoggedIn ? (
    <LoginPage
      themeMode={themeMode}
      onThemeToggle={toggleThemeMode}
      onLogin={handleLogin}
      isLoginPending={isLoginPending}
      loginError={loginError}
    />
  ) : (
    <Suspense fallback={<DashboardFallback />}>
      <StockDashboard
        themeMode={themeMode}
        onThemeToggle={toggleThemeMode}
        onLogout={handleLogout}
      />
    </Suspense>
  );

  return content;
}

function DashboardFallback() {
  return (
    <main className="min-h-screen bg-background p-4 text-muted-foreground">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[1680px] gap-4 md:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-h-[520px] flex-col gap-5 rounded-lg border border-border/60 bg-surface/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-7 w-36 rounded-md" />
            <Skeleton className="size-10 rounded-md" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-9 w-48 rounded-md" />
            <Skeleton className="h-4 w-64 max-w-full rounded" />
          </div>
          <Skeleton className="min-h-0 flex-1 rounded-lg" />
          <div className="grid gap-3 md:grid-cols-3">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        </section>
        <aside className="hidden flex-col gap-3 md:flex">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </aside>
      </div>
      <span className="sr-only">加载看板...</span>
    </main>
  );
}

export default App;
