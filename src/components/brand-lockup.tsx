import { cn } from "@/lib/utils";

const logoSrc = "/stockpick-logo.png";

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoSrc}
        alt="StockPick"
        className="size-11 rounded-xl border border-white/15 bg-white/10 object-contain p-1.5 shadow-sm"
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">StockPick</p>
        <p className="mt-0.5 truncate text-lg font-semibold text-foreground">股票筛选看板</p>
      </div>
    </div>
  );
}
