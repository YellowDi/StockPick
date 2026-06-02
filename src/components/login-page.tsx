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
import type { ThemeMode } from "@/types/theme";

const Threads = lazy(() => import("@/components/threads"));

type LoginPageProps = {
  themeMode: ThemeMode;
  onThemeToggle: () => void;
  onLogin: () => void;
};

export function LoginPage({
  themeMode,
  onThemeToggle,
  onLogin,
}: LoginPageProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onLogin();
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative flex min-h-screen items-center justify-center px-4 py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,66,46,0.24),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_48%)]" />
        <Suspense fallback={null}>
          <Threads
            className="absolute inset-0 opacity-70"
            color={themeMode === "dark" ? [0.92, 0.18, 0.12] : [0.74, 0.11, 0.08]}
            amplitude={1.4}
            distance={0.18}
          />
        </Suspense>
        <form className="relative z-10 w-full max-w-[420px]" onSubmit={handleSubmit}>
          <Card className="border-white/10 bg-card/82 shadow-[0_28px_110px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
            <CardHeader className="gap-4">
              <div className="flex items-start justify-between gap-4">
                <BrandLockup />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={themeMode === "dark" ? "切换亮色模式" : "切换暗色模式"}
                  onClick={onThemeToggle}
                >
                  {themeMode === "dark" ? <Sun /> : <Moon />}
                </Button>
              </div>
              <div>
                <CardTitle className="text-2xl">登录</CardTitle>
                <CardDescription>使用演示账号进入股票筛选工作台</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium">
                账号
                <span className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="h-11 w-full rounded-md border bg-background/45 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
                    name="username"
                    placeholder="stockpick"
                    autoComplete="username"
                  />
                </span>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                密码
                <span className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="h-11 w-full rounded-md border bg-background/45 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
                    name="password"
                    type="password"
                    placeholder="password"
                    autoComplete="current-password"
                  />
                </span>
              </label>
            </CardContent>
            <CardFooter>
              <Button type="submit" size="lg" className="h-11 w-full text-base">
                <LogIn data-icon="inline-start" />
                进入看板
              </Button>
            </CardFooter>
          </Card>
        </form>
      </section>
    </main>
  );
}
