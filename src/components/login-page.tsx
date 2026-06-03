import { lazy, Suspense, type FormEvent } from "react";
import { LockKeyhole, LogIn, Moon, Sun, UserRound } from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LoginCredentials } from "@/lib/auth-api";
import { isThemeToggleVisible, type ThemeMode } from "@/types/theme";

const Threads = lazy(() => import("@/components/threads"));
const darkThreadsColor: [number, number, number] = [0.92, 0.18, 0.12];
const lightThreadsColor: [number, number, number] = [0.74, 0.11, 0.08];

type LoginPageProps = {
  themeMode: ThemeMode;
  onThemeToggle: () => void;
  onLogin: (credentials: LoginCredentials) => void;
  isLoginPending: boolean;
  loginError: string | null;
};

export function LoginPage({
  themeMode,
  onThemeToggle,
  onLogin,
  isLoginPending,
  loginError,
}: LoginPageProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    onLogin({ username, password });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative flex min-h-screen items-center justify-center px-4 py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,66,46,0.24),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_48%)]" />
        <Suspense fallback={null}>
          <Threads
            className="absolute inset-0 opacity-70"
            color={themeMode === "dark" ? darkThreadsColor : lightThreadsColor}
            amplitude={1.4}
            distance={0.18}
          />
        </Suspense>
        <form className="relative z-10 w-full max-w-[420px]" onSubmit={handleSubmit}>
          <Card className="border-white/10 bg-card/82 shadow-[0_28px_110px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
            <CardHeader className="gap-4">
              <div className="flex items-start justify-between gap-4">
                <BrandLockup />
                {isThemeToggleVisible(themeMode) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={themeMode === "dark" ? "切换亮色模式" : "切换暗色模式"}
                    onClick={onThemeToggle}
                  >
                    {themeMode === "dark" ? <Sun /> : <Moon />}
                  </Button>
                ) : null}
              </div>
              <div>
                <CardTitle className="text-2xl">登录</CardTitle>
                <CardDescription>使用账号密码进入股票筛选工作台</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Label htmlFor="login-username" className="flex flex-col gap-2 text-sm font-medium">
                账号
                <span className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-username"
                    className="bg-background/45 pl-9"
                    name="username"
                    placeholder="stockpick"
                    autoComplete="username"
                    required
                    disabled={isLoginPending}
                    aria-invalid={loginError ? true : undefined}
                  />
                </span>
              </Label>
              <Label htmlFor="login-password" className="flex flex-col gap-2 text-sm font-medium">
                密码
                <span className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    className="bg-background/45 pl-9"
                    name="password"
                    type="password"
                    placeholder="password"
                    autoComplete="current-password"
                    required
                    disabled={isLoginPending}
                    aria-invalid={loginError ? true : undefined}
                  />
                </span>
              </Label>
              {loginError ? (
                <p
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {loginError}
                </p>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={isLoginPending}>
                <LogIn data-icon="inline-start" />
                {isLoginPending ? "登录中..." : "进入看板"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </section>
    </main>
  );
}
