import {
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Ban,
  ChevronDown,
  CheckCircle2,
  Database,
  ListFilter,
  LogOut,
  Moon,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ShieldX,
  Sun,
} from "lucide-react";
import { Liveline, type CandlePoint, type LivelinePoint } from "liveline";

import { BrandLockup } from "@/components/brand-lockup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { defaultStrategyConfig, StrategySwitchButton, type StrategyConfig } from "@/features/strategy-switch/strategy-switch-button";
import { mockStockGroups, stockListMeta } from "@/data/mock-stocks";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/types/theme";
import type { StockCandidate, StockDailyRecord, StockListKey } from "@/types/stock";

const listOrder: StockListKey[] = ["initial", "selected", "whitelist", "blacklist"];
const intradayBarsPerDay = 60;
const candleWidthSecs = 240;
const tradingSessionSecs = intradayBarsPerDay * candleWidthSecs;
const dayGapSecs = 900;
const packedDaySecs = tradingSessionSecs + dayGapSecs;
const mockDaySecs = 24 * 60 * 60;
const liveTicksPerCandle = 3;
const realtimeSeedBars = 2;
const realtimeWindowBars = 60;
const weekWindowOffsetSecs = 0.05;
const heroChartPadding = { top: 260, right: 86, bottom: 72, left: 24 };
const compactHeroChartPadding = { top: 292, right: 52, bottom: 54, left: 12 };
const compactViewportQuery = "(max-width: 639px)";
const mobileViewportQuery = "(max-width: 767px)";
const dayRangeOptions = [
  { id: "today", label: "当日", offset: 0 },
  { id: "prev-1", label: "前1日", offset: 1 },
  { id: "prev-2", label: "前2日", offset: 2 },
  { id: "prev-3", label: "前3日", offset: 3 },
  { id: "prev-4", label: "前4日", offset: 4 },
  { id: "prev-5", label: "前5日", offset: 5 },
  { id: "prev-6", label: "前6日", offset: 6 },
  { id: "prev-7", label: "前7日", offset: 7 },
] as const;
type ChartRangeId = "realtime" | (typeof dayRangeOptions)[number]["id"] | "week";
type ChartMode = "line" | "candle";
const chartModeOptions = [
  { id: "candle" as const, label: "K线" },
  { id: "line" as const, label: "折线" },
];

type DraggedStock = {
  code: string;
  fromList: StockListKey;
};

const listIcons = {
  initial: ListFilter,
  selected: CheckCircle2,
  whitelist: ShieldCheck,
  blacklist: ShieldX,
} satisfies Record<StockListKey, typeof ListFilter>;

type StockDashboardProps = {
  themeMode: ThemeMode;
  onThemeToggle: () => void;
  onLogout: () => void;
};

export default function StockDashboard({
  themeMode,
  onThemeToggle,
  onLogout,
}: StockDashboardProps) {
  const stockBoardRef = useRef<HTMLDivElement>(null);
  const [stockGroups, setStockGroups] = useState(mockStockGroups);
  const [selectedChartCode, setSelectedChartCode] = useState<string | null>(null);
  const [draggedStock, setDraggedStock] = useState<DraggedStock | null>(null);
  const [dropTarget, setDropTarget] = useState<StockListKey | null>(null);
  const [mobileListKey, setMobileListKey] = useState<StockListKey>("selected");
  const [strategyConfig, setStrategyConfig] = useState<StrategyConfig>(defaultStrategyConfig);
  const selectedStock = selectedChartCode
    ? stockGroups.selected.find((stock) => stock.code === selectedChartCode) ?? null
    : null;
  const selectedStockCodes = useMemo(
    () => new Set(stockGroups.selected.map((stock) => stock.code)),
    [stockGroups.selected],
  );

  function scrollBoardIntoViewOnMobile() {
    if (!window.matchMedia(mobileViewportQuery).matches) {
      return;
    }

    window.requestAnimationFrame(() => {
      stockBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleSelectedStock(code: string) {
    if (selectedChartCode === code) {
      setSelectedChartCode(null);
      scrollBoardIntoViewOnMobile();
      return;
    }

    setSelectedChartCode(code);
    scrollBoardIntoViewOnMobile();
  }

  function addToSelected(stock: StockCandidate) {
    setStockGroups((currentGroups) => {
      if (currentGroups.selected.some((item) => item.code === stock.code)) {
        return currentGroups;
      }

      return {
        ...currentGroups,
        selected: [
          ...currentGroups.selected,
          {
            ...stock,
            list: "selected",
          },
        ],
      };
    });
  }

  function canDropStock(targetList: StockListKey, stock = draggedStock) {
    if (!stock || stock.fromList === targetList) {
      return false;
    }

    if (targetList === "selected") {
      return stock.fromList !== "selected" && !selectedStockCodes.has(stock.code);
    }

    return stock.fromList === "selected";
  }

  function moveDroppedStock(stock: DraggedStock, targetList: StockListKey) {
    if (targetList === "selected") {
      const sourceStock = stockGroups[stock.fromList].find((item) => item.code === stock.code);

      if (sourceStock) {
        addToSelected(sourceStock);
      }

      return;
    }

    if (stock.fromList !== "selected") {
      return;
    }

    setStockGroups((currentGroups) => {
      const selectedStock = currentGroups.selected.find((item) => item.code === stock.code);

      if (!selectedStock) {
        return currentGroups;
      }

      const targetStocks = currentGroups[targetList];

      return {
        ...currentGroups,
        selected: currentGroups.selected.filter((item) => item.code !== stock.code),
        [targetList]: targetStocks.some((item) => item.code === stock.code)
          ? targetStocks
          : [
              ...targetStocks,
              {
                ...selectedStock,
                list: targetList,
              },
            ],
      };
    });
    setSelectedChartCode((code) => (code === stock.code ? null : code));
  }

  function handleStockDragStart(
    stock: StockCandidate,
    fromList: StockListKey,
    event: DragEvent<HTMLButtonElement>,
  ) {
    const nextDraggedStock = {
      code: stock.code,
      fromList,
    };

    event.dataTransfer.effectAllowed = fromList === "selected" ? "move" : "copy";
    event.dataTransfer.setData("text/plain", fromList + ":" + stock.code);
    setDraggedStock(nextDraggedStock);
  }

  function handleColumnDragOver(listKey: StockListKey, event: DragEvent<HTMLDivElement>) {
    if (!canDropStock(listKey)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = draggedStock?.fromList === "selected" ? "move" : "copy";
    setDropTarget((current) => (current === listKey ? current : listKey));
  }

  function handleColumnDragLeave(listKey: StockListKey, event: DragEvent<HTMLDivElement>) {
    const relatedTarget = event.relatedTarget;

    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return;
    }

    setDropTarget((current) => (current === listKey ? null : current));
  }

  function handleColumnDrop(listKey: StockListKey, event: DragEvent<HTMLDivElement>) {
    if (!draggedStock || !canDropStock(listKey, draggedStock)) {
      return;
    }

    event.preventDefault();
    moveDroppedStock(draggedStock, listKey);
    setDraggedStock(null);
    setDropTarget(null);
  }

  function handleDragEnd() {
    setDraggedStock(null);
    setDropTarget(null);
  }

  const sharedStockListProps = {
    selectedCode: selectedChartCode,
    selectedStockCodes,
    onToggleChart: toggleSelectedStock,
    onAddToSelected: addToSelected,
  };

  return (
    <main className="min-h-screen overflow-x-hidden text-foreground">
      <div className="flex flex-col">
        <div ref={stockBoardRef}>
          <StockBoard
            stock={selectedStock}
            themeMode={themeMode}
            onThemeToggle={onThemeToggle}
            onLogout={onLogout}
          />
        </div>

        <div className="mx-auto w-full max-w-[1680px] px-4 pb-6 sm:px-6 lg:px-8">
          <StrategySwitchButton
            config={strategyConfig}
            onSave={setStrategyConfig}
          />

          <MobileStockTabs
            activeListKey={mobileListKey}
            stockGroups={stockGroups}
            onActiveListChange={setMobileListKey}
            {...sharedStockListProps}
          />

          <section className="mt-4 hidden gap-4 md:grid xl:grid-cols-4">
            {listOrder.map((key) => (
              <StockColumn
                key={key}
                listKey={key}
                stocks={stockGroups[key]}
                {...sharedStockListProps}
                canDrop={canDropStock(key)}
                isDropTarget={dropTarget === key}
                onDragStart={handleStockDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleColumnDragOver}
                onDragLeave={handleColumnDragLeave}
                onDrop={handleColumnDrop}
              />
            ))}
          </section>

          <MobileAccountActions
            themeMode={themeMode}
            onThemeToggle={onThemeToggle}
            onLogout={onLogout}
          />
        </div>
      </div>
    </main>
  );
}
type StockBoardProps = {
  stock: StockCandidate | null;
  themeMode: ThemeMode;
  onThemeToggle: () => void;
  onLogout: () => void;
};

function StockBoard({
  stock,
  themeMode,
  onThemeToggle,
  onLogout,
}: StockBoardProps) {
  if (!stock) {
    return (
      <StockBoardLoading
        themeMode={themeMode}
        onThemeToggle={onThemeToggle}
        onLogout={onLogout}
      />
    );
  }

  return (
    <ActiveStockBoard
      key={stock.code}
      stock={stock}
      themeMode={themeMode}
      onThemeToggle={onThemeToggle}
      onLogout={onLogout}
    />
  );
}

function useIsCompactViewport() {
  const [isCompact, setIsCompact] = useState(() => window.matchMedia(compactViewportQuery).matches);

  useEffect(() => {
    const media = window.matchMedia(compactViewportQuery);
    const handleChange = () => setIsCompact(media.matches);

    handleChange();
    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, []);

  return isCompact;
}
function ActiveStockBoard({
  stock,
  themeMode,
  onThemeToggle,
  onLogout,
}: Omit<StockBoardProps, "stock"> & {
  stock: StockCandidate;
}) {
  const [chartRangeId, setChartRangeId] = useState<ChartRangeId>("realtime");
  const [chartMode, setChartMode] = useState<ChartMode>("candle");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [liveResetKey, setLiveResetKey] = useState(0);
  const live = useLiveMockStock(stock, liveResetKey, isLoading, chartRangeId === "realtime");
  const chartView = useMemo(
    () => createChartView(live, chartRangeId),
    [chartRangeId, live],
  );
  const records = chartView.records;
  const latest = records.at(-1);
  const previous = records.at(-2);
  const change = latest && previous ? latest.close - previous.close : 0;
  const changePct = previous ? (change / previous.close) * 100 : 0;
  const chartLiveCandle = chartView.candles.at(-1);
  const closedCandles = chartLiveCandle ? chartView.candles.slice(0, -1) : chartView.candles;
  const chartColor = change >= 0
    ? themeMode === "light" ? "#b94545" : "#ef4444"
    : themeMode === "light" ? "#2f7f59" : "#22c55e";
  const momentum = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const chartRangeOptions = useMemo(() => {
    const weekDays = getCurrentWeekTradingDayCount(live.historicalRecords);

    return [
      {
        id: "realtime" as const,
        label: "实时",
        secs: realtimeWindowBars * candleWidthSecs,
      },
      ...dayRangeOptions.map((option) => ({
        id: option.id,
        label: option.label,
        secs: tradingSessionSecs + (option.offset + 2) * 0.001,
      })),
      {
        id: "week" as const,
        label: "本周",
        secs: getPackedRangeWindowSecs(weekDays) + weekWindowOffsetSecs,
      },
    ];
  }, [live.historicalRecords]);
  const selectedRange = chartRangeOptions.find((option) => option.id === chartRangeId) ?? chartRangeOptions[0];
  const chartPadding = useIsCompactViewport() ? compactHeroChartPadding : heroChartPadding;

  function selectChartRange(rangeId: ChartRangeId) {
    setChartRangeId(rangeId);
    setChartMode(rangeId === "realtime" || rangeId === "today" ? "candle" : "line");
  }

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const timer = window.setTimeout(() => setIsLoading(false), 520);

    return () => window.clearTimeout(timer);
  }, [isLoading, liveResetKey]);

  function reloadStock() {
    setIsLoading(true);
    setLiveResetKey((key) => key + 1);
  }

  const positive = change >= 0;
  const trend = !latest
    ? "暂无行情"
    : change > 0
      ? "多头走强"
      : change < 0
        ? "回落整理"
        : "横盘震荡";
  const strength = !latest
    ? "--"
    : Math.abs(changePct) >= 2
      ? "强"
      : Math.abs(changePct) >= 1
        ? "中"
        : "弱";
  return (
    <>
      <section className="relative">
      <div
        className="relative min-h-[560px] overflow-hidden sm:min-h-[620px] lg:min-h-[700px]"
        style={{ background: "var(--chart-hero-background)" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-48 bg-gradient-to-b from-background/75 to-transparent" />
        <div className="chart-hero-bottom-mask pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36" />

        <div className="relative z-20 mx-auto grid max-w-[1680px] gap-3 px-4 pt-4 sm:gap-4 sm:px-6 sm:pt-5 lg:grid-cols-[minmax(240px,1fr)_minmax(0,auto)_minmax(240px,1fr)] lg:items-start lg:px-8">
          <div className="min-w-0">
            <BrandLockup />
            <button
              type="button"
              className="group mt-3 flex min-h-10 min-w-0 flex-wrap items-center gap-2 text-left transition-[color,transform] active:scale-[0.96]"
              aria-expanded={detailsOpen}
              aria-controls="stock-details-panel"
              onClick={() => setDetailsOpen((open) => !open)}
            >
              <h1 className="text-[1.75rem] font-semibold leading-tight tracking-normal text-foreground text-balance sm:text-3xl">
                {stock.name}
              </h1>
              <span className="text-sm text-muted-foreground">{stock.code}</span>
              <Badge variant="outline" className="bg-background/35 backdrop-blur">
                {stockListMeta[stock.list].label}
              </Badge>
              <Badge
                variant={latest ? "secondary" : "destructive"}
                className="bg-background/55 backdrop-blur"
              >
                {latest ? "行情正常" : "无数据"}
              </Badge>
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
                  detailsOpen && "rotate-180",
                )}
              />
            </button>
            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span
                className={cn(
                  "text-4xl font-semibold leading-none tabular-nums sm:text-5xl",
                  latest ? positive ? "text-stock-up" : "text-stock-down" : "text-muted-foreground",
                )}
              >
                <AnimatedDigits
                  key={`price-${stock.code}:${liveResetKey}`}
                  value={latest ? latest.close.toFixed(2) : "--"}
                />
              </span>
              <span
                className={cn(
                  "pb-1 text-base font-semibold tabular-nums sm:text-lg",
                  latest ? positive ? "text-stock-up" : "text-stock-down" : "text-muted-foreground",
                )}
              >
                <AnimatedDigits
                  key={`change-${stock.code}:${liveResetKey}`}
                  value={latest ? `${formatSigned(change)}  ${formatSigned(changePct)}%` : "--"}
                />
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 min-[430px]:grid-cols-3 sm:flex sm:flex-wrap">
              <HeroMetric label="趋势" value={trend} tone={latest ? positive ? "up" : "down" : undefined} />
              <HeroMetric label="强度" value={strength} />
              <HeroMetric label="最高" value={latest ? latest.high.toFixed(2) : "--"} />
              <HeroMetric label="最低" value={latest ? latest.low.toFixed(2) : "--"} />
              <HeroMetric label="昨收" value={latest?.last ? latest.last.toFixed(2) : "--"} />
              <HeroMetric label="成交量" value={latest ? formatVolume(latest.volume) : "--"} />
              <HeroMetric label="成交额" value={latest ? formatAmount(latest.amount) : "--"} />
            </div>
          </div>

          <ChartRangeControls
            className="hidden md:block"
            options={chartRangeOptions}
            activeId={chartRangeId}
            onSelect={selectChartRange}
          />

          <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
            <div className="flex rounded-lg bg-background/45 p-1 shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
              {chartModeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    "h-8 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors",
                    option.id === chartMode
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground",
                  )}
                  aria-pressed={option.id === chartMode}
                  onClick={() => setChartMode(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden bg-background/45 backdrop-blur-xl md:inline-flex"
              aria-label={themeMode === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
              title={themeMode === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
              onClick={onThemeToggle}
            >
              {themeMode === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
              {themeMode === "dark" ? "亮色" : "暗色"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden bg-background/45 backdrop-blur-xl md:inline-flex"
              aria-label="退出登录"
              title="退出登录"
              onClick={onLogout}
            >
              <LogOut data-icon="inline-start" />
              退出登录
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-background/45 backdrop-blur-xl max-[420px]:w-8 max-[420px]:px-0"
              aria-label={isLoading ? "加载中" : "重载"}
              title={isLoading ? "加载中" : "重载"}
              disabled={isLoading}
              onClick={reloadStock}
            >
              <RefreshCcw data-icon="inline-start" className={cn(isLoading && "animate-spin")} />
              <span className="max-[420px]:hidden">{isLoading ? "加载中" : "重载"}</span>
            </Button>
          </div>

          <StockDetailsPanel
            id="stock-details-panel"
            open={detailsOpen}
            records={records}
          />
        </div>

        <div className="absolute inset-0 z-0">
          {latest || isLoading ? (
            <Liveline
              data={latest ? chartView.lineData : []}
              value={latest?.close ?? 0}
              mode="candle"
              candles={closedCandles}
              liveCandle={chartLiveCandle}
              candleWidth={candleWidthSecs}
              lineMode={chartMode === "line"}
              lineData={chartView.lineData}
              lineValue={latest?.close}
              theme={themeMode}
              color={chartColor}
              window={selectedRange.secs}
              grid
              scrub
              badge={true}
              badgeVariant="minimal"
              badgeTail
              momentum={momentum}
              pulse
              loading={isLoading}
              showValue
              valueMomentumColor
              referenceLine={
                latest?.last
                  ? {
                      value: latest.last,
                      label: "昨收",
                    }
                  : undefined
              }
              formatValue={(value) => value.toFixed(2)}
              formatTime={formatChartTime}
              padding={chartPadding}
              className="size-full"
            />
          ) : (
            <EmptyChart error={stock.records[0]?.error} />
          )}
        </div>

      </div>
      </section>

      <ChartRangeControls
        className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-[1680px] md:hidden"
        options={chartRangeOptions}
        activeId={chartRangeId}
        onSelect={selectChartRange}
      />
    </>
  );
}

function StockBoardLoading({
  themeMode,
  onThemeToggle,
  onLogout,
}: {
  themeMode: ThemeMode;
  onThemeToggle: () => void;
  onLogout: () => void;
}) {
  const chartColor = themeMode === "light" ? "#4f6f8f" : "#8fb6d8";
  const chartPadding = useIsCompactViewport() ? compactHeroChartPadding : heroChartPadding;

  return (
    <section className="relative">
      <div
        className="relative min-h-[560px] overflow-hidden sm:min-h-[620px] lg:min-h-[700px]"
        style={{ background: "var(--chart-hero-background)" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-48 bg-gradient-to-b from-background/75 to-transparent" />
        <div className="chart-hero-bottom-mask pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36" />

        <div className="relative z-20 mx-auto grid max-w-[1680px] gap-3 px-4 pt-4 sm:gap-4 sm:px-6 sm:pt-5 lg:grid-cols-[minmax(240px,1fr)_minmax(0,auto)_minmax(240px,1fr)] lg:items-start lg:px-8">
          <div className="min-w-0">
            <BrandLockup />
            <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-normal text-foreground text-balance sm:text-3xl">
              欢迎回来
            </h1>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 lg:col-start-3 lg:justify-end lg:justify-self-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden bg-background/45 backdrop-blur-xl md:inline-flex"
              aria-label={themeMode === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
              title={themeMode === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
              onClick={onThemeToggle}
            >
              {themeMode === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
              {themeMode === "dark" ? "亮色" : "暗色"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden bg-background/45 backdrop-blur-xl md:inline-flex"
              aria-label="退出登录"
              title="退出登录"
              onClick={onLogout}
            >
              <LogOut data-icon="inline-start" />
              退出登录
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden bg-background/45 backdrop-blur-xl md:inline-flex"
              aria-label="重载"
              title="重载"
              disabled
            >
              <RefreshCcw data-icon="inline-start" />
              重载
            </Button>
          </div>
        </div>

        <div className="absolute inset-0 z-0">
          <Liveline
            data={[]}
            value={0}
            mode="candle"
            candles={[]}
            candleWidth={candleWidthSecs}
            theme={themeMode}
            color={chartColor}
            window={realtimeWindowBars * candleWidthSecs}
            grid
            loading
            momentum="flat"
            padding={chartPadding}
            className="size-full"
          />
        </div>
      </div>
    </section>
  );
}

function AnimatedDigits({ value }: { value: string }) {
  return (
    <span className="stock-digit-pop">
      <span className="sr-only">{value}</span>
      {value.split("").map((char, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="stock-digit-pop__char"
          style={{ animationDelay: `${Math.min(index, 10) * 42}ms` }}
        >
          {char === " " ? "\u00a0" : char}
        </span>
      ))}
    </span>
  );
}

function HeroMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <span className="flex min-w-0 items-center justify-between gap-1 rounded-md bg-background/35 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur-xl sm:inline-flex sm:justify-start">
      <span className="shrink-0">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate font-medium text-foreground tabular-nums",
          tone === "up" && "text-stock-up",
          tone === "down" && "text-stock-down",
        )}
      >
        {value}
      </span>
    </span>
  );
}

function ChartRangeControls({
  options,
  activeId,
  onSelect,
  className,
}: {
  options: Array<{ id: ChartRangeId; label: string }>;
  activeId: ChartRangeId;
  onSelect: (id: ChartRangeId) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-x-auto rounded-lg bg-background/45 p-1 shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl [-webkit-overflow-scrolling:touch]",
        className,
      )}
    >
      <div className="flex min-w-max items-center gap-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={cn(
              "h-8 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors",
              option.id === activeId
                ? "bg-secondary text-secondary-foreground"
                : "hover:bg-accent hover:text-accent-foreground",
            )}
            aria-pressed={option.id === activeId}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
function MobileStockTabs({
  activeListKey,
  stockGroups,
  selectedCode,
  selectedStockCodes,
  onActiveListChange,
  onToggleChart,
  onAddToSelected,
}: {
  activeListKey: StockListKey;
  stockGroups: Record<StockListKey, StockCandidate[]>;
  selectedCode: string | null;
  selectedStockCodes: Set<string>;
  onActiveListChange: (key: StockListKey) => void;
  onToggleChart: (code: string) => void;
  onAddToSelected: (stock: StockCandidate) => void;
}) {
  const stocks = stockGroups[activeListKey];
  const meta = stockListMeta[activeListKey];
  const opensChart = activeListKey === "selected";

  return (
    <Card className="mt-4 bg-card/88 shadow-[0_16px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl md:hidden">
      <CardHeader className="gap-3">
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-background/45 p-1">
          {listOrder.map((key) => (
            <button
              key={key}
              type="button"
              className={cn(
                "h-9 min-w-0 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors",
                key === activeListKey
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground",
              )}
              aria-pressed={key === activeListKey}
              onClick={() => onActiveListChange(key)}
            >
              <span className="block truncate">{stockListMeta[key].label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <CardDescription>{meta.description}</CardDescription>
          <Badge variant="secondary">{stocks.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pb-5">
        {stocks.length > 0 ? (
          stocks.map((stock) => (
            <StockListButton
              key={stock.code}
              stock={stock}
              active={opensChart && stock.code === selectedCode}
              action={opensChart ? "open" : selectedStockCodes.has(stock.code) ? "added" : "add"}
              draggable={false}
              onClick={() => {
                if (opensChart) {
                  onToggleChart(stock.code);
                  return;
                }

                onAddToSelected(stock);
              }}
            />
          ))
        ) : (
          <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
            暂无股票
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MobileAccountActions({
  themeMode,
  onThemeToggle,
  onLogout,
}: {
  themeMode: ThemeMode;
  onThemeToggle: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 pb-4 md:hidden">
      <Button
        type="button"
        variant="outline"
        className="h-10 bg-card/88 backdrop-blur-xl"
        aria-label={themeMode === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
        onClick={onThemeToggle}
      >
        {themeMode === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
        {themeMode === "dark" ? "亮色模式" : "暗色模式"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-10 bg-card/88 backdrop-blur-xl"
        onClick={onLogout}
      >
        <LogOut data-icon="inline-start" />
        退出登录
      </Button>
    </div>
  );
}

function StockDetailsPanel({
  id,
  open,
  records,
}: {
  id: string;
  open: boolean;
  records: StockDailyRecord[];
}) {
  return (
    <div
      id={id}
      className={cn(
        "pointer-events-none absolute left-4 top-[calc(100%+8px)] z-30 w-[calc(100%-2rem)] max-w-[820px] transition-[opacity,transform] duration-200 ease-out sm:left-6 sm:w-[calc(100%-3rem)] lg:left-8 lg:w-[820px]",
        open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
      )}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "pointer-events-auto overflow-hidden rounded-lg border bg-card/90 shadow-[0_18px_64px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-[max-height] duration-200 ease-out",
          open ? "max-h-[360px] sm:max-h-[430px]" : "max-h-0",
        )}
      >
        <div className="max-h-[360px] overflow-y-auto p-4 sm:max-h-[430px]">
          <RecentRecordsSection records={records} />
        </div>
      </div>
    </div>
  );
}

function RecentRecordsSection({ records }: { records: StockDailyRecord[] }) {
  const visibleRecords = records.slice(-7);

  return (
    <section>
      <div className="mb-3 gap-1 lg:flex lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold">最近 7 日 OHLC</h2>
          <p className="mt-1 text-sm text-muted-foreground">用于快速校验当前走势和日线位置</p>
        </div>
        <span className="text-xs text-muted-foreground">数据为模拟行情，仅供参考</span>
      </div>
      <div>
        {visibleRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[560px] sm:min-w-[620px]">
              <div className="grid grid-cols-[1.1fr_repeat(5,0.8fr)] border-b px-3 py-2 text-xs text-muted-foreground">
                <span>日期</span>
                <span className="text-right">开盘</span>
                <span className="text-right">最高</span>
                <span className="text-right">最低</span>
                <span className="text-right">收盘</span>
                <span className="text-right">涨跌幅</span>
              </div>
              {visibleRecords.map((record) => {
                const recordIndex = records.findIndex((item) => item.date === record.date);
                const previous = recordIndex > 0 ? records[recordIndex - 1] : undefined;
                const dailyChangePct = previous ? ((record.close - previous.close) / previous.close) * 100 : 0;
                const dailyPositive = dailyChangePct >= 0;

                return (
                  <div
                    key={record.date}
                    className="grid grid-cols-[1.1fr_repeat(5,0.8fr)] border-b border-border/60 px-3 py-2.5 text-sm last:border-b-0"
                  >
                    <span className="truncate text-muted-foreground">{record.date}</span>
                    <span className="text-right tabular-nums">{record.open.toFixed(2)}</span>
                    <span className="text-right tabular-nums">{record.high.toFixed(2)}</span>
                    <span className="text-right tabular-nums">{record.low.toFixed(2)}</span>
                    <span className={cn("text-right tabular-nums", record.close >= record.open ? "text-stock-up" : "text-stock-down")}>
                      {record.close.toFixed(2)}
                    </span>
                    <span className={cn("text-right tabular-nums", dailyPositive ? "text-stock-up" : "text-stock-down")}>
                      {previous ? `${formatSigned(dailyChangePct)}%` : "--"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
            暂无日线数据
          </div>
        )}
      </div>
    </section>
  );
}

function useLiveMockStock(
  stock: StockCandidate,
  resetKey: number,
  isLoading: boolean,
  shouldStream: boolean,
) {
  const sourceRecords = useMemo(
    () => stock.records.filter((record) => record.status === "成功"),
    [stock],
  );
  const liveKey = `${stock.code}:${resetKey}`;
  const [liveState, setLiveState] = useState(() => ({
    key: liveKey,
    live: createLiveSnapshot(sourceRecords),
  }));

  let live = liveState.live;

  if (liveState.key !== liveKey) {
    const nextLiveState = {
      key: liveKey,
      live: createLiveSnapshot(sourceRecords),
    };

    setLiveState(nextLiveState);
    live = nextLiveState.live;
  }

  useEffect(() => {
    if (isLoading || !shouldStream || sourceRecords.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setLiveState((current) => ({
        ...current,
        live: advanceLiveSnapshot(current.live),
      }));
    }, 850);

    return () => window.clearInterval(timer);
  }, [isLoading, shouldStream, sourceRecords.length, liveKey]);

  return live;
}

function createLiveSnapshot(records: StockDailyRecord[]) {
  const historicalRecords = records.map((record) => ({ ...record }));
  const liveRecords = createInitialRealtimeRecords(historicalRecords);
  const baseTime = Math.floor(Date.now() / 1000) - historicalRecords.length * mockDaySecs;
  const historicalCandles = createIntradayCandles(historicalRecords, baseTime);
  const latest = liveRecords.at(-1);
  const now = Date.now() / 1000;
  const liveCandles = latest
    ? [
        ...createRealtimeSeedCandles(now, latest),
        createLiveCandle(getRealtimeLiveStart(now), latest.open, latest.close, latest),
      ]
    : [];

  return {
    records: liveRecords,
    historicalRecords,
    historicalCandles,
    liveCandles,
    lineData: createLineDataFromCandles(liveCandles),
    liveTickCount: 0,
  };
}

function advanceLiveSnapshot(live: ReturnType<typeof createLiveSnapshot>) {
  const latest = live.records.at(-1);

  if (!latest) {
    return live;
  }

  const previous = live.records.at(-2);
  const sourceLatest = live.historicalRecords.at(-1) ?? latest;
  const previousClose = previous?.close ?? latest.last ?? latest.open;
  const targetClose = sourceLatest.close;
  const drift = (targetClose - latest.close) * 0.035 + (previousClose - latest.close) * 0.006;
  const noise = latest.close * ((Math.random() - 0.48) * 0.0026);
  const nextClose = roundPrice(clampPrice(latest.close + drift + noise, latest));
  const addedVolume = Math.max(
    1,
    Math.round((sourceLatest.volume / intradayBarsPerDay) * (0.35 + Math.random() * 1.3)),
  );
  const nextTickCount = live.liveTickCount + 1;

  const nextRecord: StockDailyRecord = {
    ...latest,
    close: nextClose,
    high: roundPrice(Math.max(latest.high, nextClose)),
    low: roundPrice(Math.min(latest.low, nextClose)),
    volume: latest.volume + addedVolume,
    amount: latest.amount + Math.round(addedVolume * nextClose * 100),
  };
  const records = [...live.records.slice(0, -1), nextRecord];
  const seedCandles = live.liveCandles.slice(0, realtimeSeedBars);
  const visibleCandles = live.liveCandles.slice(realtimeSeedBars);
  const lastCandle = visibleCandles.at(-1);
  const shouldStartNextCandle = nextTickCount % liveTicksPerCandle === 0;
  const nextVisibleCandles = createNextRealtimeCandles(
    visibleCandles,
    lastCandle,
    nextClose,
    nextRecord,
    shouldStartNextCandle,
  );
  const liveCandles = [...seedCandles, ...nextVisibleCandles];

  return {
    records,
    historicalRecords: live.historicalRecords,
    historicalCandles: live.historicalCandles,
    liveCandles,
    lineData: createLineDataFromCandles(liveCandles),
    liveTickCount: nextTickCount,
  };
}

function createInitialRealtimeRecords(records: StockDailyRecord[]) {
  return records.map((record, index) => {
    if (index !== records.length - 1) {
      return { ...record };
    }

    return createInitialRealtimeRecord(record);
  });
}

function createInitialRealtimeRecord(record: StockDailyRecord): StockDailyRecord {
  const openingVolume = Math.max(1, Math.round(record.volume * 0.02));

  return {
    ...record,
    high: record.open,
    low: record.open,
    close: record.open,
    volume: openingVolume,
    amount: Math.round(openingVolume * record.open * 100),
  };
}

function createRealtimeSeedCandles(now: number, record: StockDailyRecord) {
  const startTime = now - realtimeWindowBars * candleWidthSecs - (realtimeSeedBars + 3) * candleWidthSecs;

  return Array.from({ length: realtimeSeedBars }, (_, index) => (
    createLiveCandle(startTime + index * candleWidthSecs, record.open, record.open, record)
  ));
}

function createNextRealtimeCandles(
  visibleCandles: CandlePoint[],
  lastCandle: CandlePoint | undefined,
  nextClose: number,
  nextRecord: StockDailyRecord,
  shouldStartNextCandle: boolean,
) {
  if (!lastCandle) {
    return [
      createLiveCandle(getRealtimeLiveStart(Date.now() / 1000), nextRecord.open, nextClose, nextRecord),
    ];
  }

  if (!shouldStartNextCandle) {
    return [
      ...visibleCandles.slice(0, -1),
      updateLiveCandle(lastCandle, nextClose),
    ];
  }

  const completedCandle = updateLiveCandle(lastCandle, nextClose);
  const nextLiveCandle = createLiveCandle(
    getRealtimeLiveStart(Date.now() / 1000),
    completedCandle.close,
    completedCandle.close,
    nextRecord,
  );

  return rebalanceRealtimeCandles([
    ...visibleCandles.slice(0, -1),
    completedCandle,
    nextLiveCandle,
  ].slice(-realtimeWindowBars));
}

function rebalanceRealtimeCandles(candles: CandlePoint[]) {
  const liveStart = getRealtimeLiveStart(Date.now() / 1000);
  const startTime = liveStart - Math.max(0, candles.length - 1) * candleWidthSecs;

  return candles.map((candle, index) => ({
    ...candle,
    time: startTime + index * candleWidthSecs,
  }));
}

function getRealtimeLiveStart(now: number) {
  return now - candleWidthSecs / 2;
}

function StockColumn({
  listKey,
  stocks,
  selectedCode,
  selectedStockCodes,
  canDrop,
  isDropTarget,
  onToggleChart,
  onAddToSelected,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  listKey: StockListKey;
  stocks: StockCandidate[];
  selectedCode: string | null;
  selectedStockCodes: Set<string>;
  canDrop: boolean;
  isDropTarget: boolean;
  onToggleChart: (code: string) => void;
  onAddToSelected: (stock: StockCandidate) => void;
  onDragStart: (
    stock: StockCandidate,
    fromList: StockListKey,
    event: DragEvent<HTMLButtonElement>,
  ) => void;
  onDragEnd: () => void;
  onDragOver: (listKey: StockListKey, event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (listKey: StockListKey, event: DragEvent<HTMLDivElement>) => void;
  onDrop: (listKey: StockListKey, event: DragEvent<HTMLDivElement>) => void;
}) {
  const Icon = listIcons[listKey];
  const meta = stockListMeta[listKey];
  const opensChart = listKey === "selected";

  return (
    <Card
      className={cn(
        "min-h-[260px] bg-card/88 shadow-[0_16px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-[background-color,border-color,box-shadow] sm:min-h-[360px]",
        canDrop && "border-dashed border-ring/60",
        isDropTarget && "bg-secondary/35 shadow-[0_18px_70px_rgba(0,0,0,0.22)] ring-2 ring-ring/35",
      )}
      onDragOver={(event) => onDragOver(listKey, event)}
      onDragLeave={(event) => onDragLeave(listKey, event)}
      onDrop={(event) => onDrop(listKey, event)}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="size-4 text-muted-foreground" />
            <CardTitle className="truncate text-base">{meta.label}</CardTitle>
          </div>
          <Badge variant="secondary">{stocks.length}</Badge>
        </div>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pb-5">
        {stocks.map((stock) => (
          <StockListButton
            key={stock.code}
            stock={stock}
            active={opensChart && stock.code === selectedCode}
            action={opensChart ? "open" : selectedStockCodes.has(stock.code) ? "added" : "add"}
            onDragStart={(event) => onDragStart(stock, listKey, event)}
            onDragEnd={onDragEnd}
            onClick={() => {
              if (opensChart) {
                onToggleChart(stock.code);
                return;
              }

              onAddToSelected(stock);
            }}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function StockListButton({
  stock,
  active,
  action,
  draggable = true,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  stock: StockCandidate;
  active: boolean;
  action: "open" | "add" | "added";
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  onClick: () => void;
}) {
  const latest = latestSuccessRecord(stock);
  const previous = previousSuccessRecord(stock);
  const changePct = latest && previous ? ((latest.close - previous.close) / previous.close) * 100 : 0;
  const positive = changePct >= 0;
  const disabled = action === "added";

  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      className={cn(
        "h-auto justify-start rounded-lg border px-3 py-3 text-left transition-[background-color,border-color,color,transform] active:scale-[0.96]",
        active
          ? "border-ring bg-secondary shadow-[0_10px_32px_rgba(0,0,0,0.18)] ring-2 ring-ring/35"
          : "border-transparent bg-background/40 hover:border-border",
        draggable && !disabled && "cursor-grab active:cursor-grabbing",
      )}
      aria-pressed={active}
      disabled={disabled}
      draggable={draggable && !disabled}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onClick={onClick}
    >
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium">{stock.name}</span>
          <span className="truncate text-xs tabular-nums text-muted-foreground">{stock.code}</span>
        </span>
        {latest ? (
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-sm font-semibold tabular-nums text-foreground">{latest.close.toFixed(2)}</span>
            <span className={cn("text-xs tabular-nums", positive ? "text-stock-up" : "text-stock-down")}>
              {formatSigned(changePct)}%
            </span>
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 text-xs text-destructive">
            <Ban className="size-3" />
            无数据
          </span>
        )}
      </span>
      <span
        className={cn(
          "ml-2 flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground",
          active && "border-ring/60 bg-background/35 text-foreground",
          action === "add" && "border-border/80 bg-background/35",
          action === "added" && "border-transparent bg-secondary/70 text-secondary-foreground",
        )}
      >
        {action === "add" ? <Plus className="size-3" /> : null}
        {active ? "显示中" : action === "added" ? "已选" : action === "add" ? "加入" : "图表"}
      </span>
    </Button>
  );
}

function EmptyChart({ error }: { error?: string }) {
  return (
    <div className="flex size-full min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center">
      <Database className="size-8 text-muted-foreground" />
      <div>
        <div className="font-medium">暂无行情数据</div>
        <div className="mt-1 text-sm text-muted-foreground">{error ?? "等待后端返回 K 线数据"}</div>
      </div>
    </div>
  );
}

function latestSuccessRecord(stock: StockCandidate) {
  return stock.records.filter((record) => record.status === "成功").at(-1);
}

function previousSuccessRecord(stock: StockCandidate) {
  return stock.records.filter((record) => record.status === "成功").at(-2);
}

function createChartView(
  live: ReturnType<typeof createLiveSnapshot>,
  rangeId: ChartRangeId,
) {
  if (rangeId === "realtime") {
    return {
      records: live.records,
      candles: live.liveCandles,
      lineData: live.lineData,
    };
  }

  const history = live.historicalRecords;

  if (rangeId === "week") {
    const latest = history.at(-1);
    const weekStart = latest ? getWeekStartDate(latest.date) : null;
    const indices: number[] = [];

    for (let index = 0; index < history.length; index++) {
      const record = history[index];

      if (!weekStart || new Date(`${record.date}T12:00:00`) >= weekStart) {
        indices.push(index);

        if (indices.length > 7) {
          indices.shift();
        }
      }
    }

    const candles = packHistoricalCandles(live.historicalCandles, indices);

    return {
      records: indices.length > 0 ? history.slice(Math.max(0, indices[0] - 1), indices.at(-1)! + 1) : [],
      candles,
      lineData: createLineDataFromCandles(candles),
    };
  }

  const selectedOption = dayRangeOptions.find((option) => option.id === rangeId);
  const offset = selectedOption?.offset ?? 0;
  const dayIndex = Math.max(0, history.length - 1 - offset);
  const candles = packHistoricalCandles(live.historicalCandles, [dayIndex]);

  return {
    records: history.slice(Math.max(0, dayIndex - 6), dayIndex + 1),
    candles,
    lineData: createLineDataFromCandles(candles),
  };
}

function packHistoricalCandles(candles: CandlePoint[], dayIndices: number[]) {
  const validIndices = dayIndices.filter((index) => index >= 0);

  if (validIndices.length === 0) {
    return [];
  }

  const duration = validIndices.length * tradingSessionSecs + Math.max(0, validIndices.length - 1) * dayGapSecs;
  const startTime = Math.floor(Date.now() / 1000) - duration;

  return validIndices.flatMap((dayIndex, packedIndex) => {
    const source = getHistoricalDayCandles(candles, dayIndex);
    const dayStart = startTime + packedIndex * packedDaySecs;

    return source.map((candle, barIndex) => ({
      ...candle,
      time: dayStart + barIndex * candleWidthSecs,
    }));
  });
}

function getHistoricalDayCandles(candles: CandlePoint[], dayIndex: number) {
  const start = dayIndex * intradayBarsPerDay;

  return candles.slice(start, start + intradayBarsPerDay);
}

function createIntradayCandles(
  records: StockDailyRecord[],
  baseTime: number,
): CandlePoint[] {
  return records.flatMap((record, index) => {
    const dayStart = baseTime + index * mockDaySecs;
    const values = createIntradayClosePath(record, intradayBarsPerDay);

    return values.map((close, barIndex) => {
      const open = barIndex === 0 ? record.open : values[barIndex - 1];
      const swing = Math.abs(close - open);
      const wick = Math.max(record.close * 0.0008, swing * 0.7);

      return {
        time: dayStart + barIndex * candleWidthSecs,
        open: roundPrice(open),
        high: roundPrice(
          Math.min(
            record.limit_up ?? Number.POSITIVE_INFINITY,
            Math.max(open, close) + wick * (0.6 + (barIndex % 3) * 0.15),
          ),
        ),
        low: roundPrice(
          Math.max(
            record.limit_down ?? 0.01,
            Math.min(open, close) - wick * (0.55 + (barIndex % 4) * 0.12),
          ),
        ),
        close: roundPrice(close),
      };
    });
  });
}

function createIntradayClosePath(record: StockDailyRecord, count: number) {
  const highFirst = record.close >= record.open;
  const firstSwing = highFirst ? record.high : record.low;
  const secondSwing = highFirst ? record.low : record.high;
  const anchors = [
    { index: 0, value: record.open },
    { index: Math.max(1, Math.round(count * 0.28)), value: firstSwing },
    { index: Math.max(2, Math.round(count * 0.62)), value: secondSwing },
    { index: count - 1, value: record.close },
  ];
  const values: number[] = [];
  let rightAnchorIndex = 0;

  for (let index = 0; index < count; index++) {
    while (
      rightAnchorIndex < anchors.length - 1
      && anchors[rightAnchorIndex].index < index
    ) {
      rightAnchorIndex += 1;
    }

    const right = anchors[rightAnchorIndex];
    const left = anchors[Math.max(0, rightAnchorIndex - 1)] ?? right;
    const span = Math.max(1, right.index - left.index);
    const progress = (index - left.index) / span;
    const base = left.value + (right.value - left.value) * progress;
    const noise = Math.sin(index * 1.7 + record.code.length) * record.close * 0.0018;

    values.push(roundPrice(clampPrice(base + noise, record)));
  }

  values[0] = record.open;
  values[count - 1] = record.close;

  return values;
}

function createLineDataFromCandles(candles: CandlePoint[]): LivelinePoint[] {
  return candles.flatMap((candle) => {
    const midValue = Math.abs(candle.high - candle.close) > Math.abs(candle.low - candle.close)
      ? candle.high
      : candle.low;

    return [
      { time: candle.time, value: candle.open },
      { time: candle.time + candleWidthSecs * 0.45, value: midValue },
      { time: candle.time + candleWidthSecs, value: candle.close },
    ];
  });
}

function createLiveCandle(
  time: number,
  open: number,
  close: number,
  record: StockDailyRecord,
): CandlePoint {
  const safeClose = roundPrice(clampPrice(close, record));

  return {
    time,
    open: roundPrice(open),
    high: roundPrice(Math.max(open, safeClose)),
    low: roundPrice(Math.min(open, safeClose)),
    close: safeClose,
  };
}

function updateLiveCandle(candle: CandlePoint, close: number): CandlePoint {
  return {
    ...candle,
    high: roundPrice(Math.max(candle.high, close)),
    low: roundPrice(Math.min(candle.low, close)),
    close: roundPrice(close),
  };
}

function formatChartTime(time: number) {
  const date = new Date(time * 1000);
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  const second = `${date.getSeconds()}`.padStart(2, "0");

  return `${hour}:${minute}:${second}`;
}

function formatSigned(value: number) {
  const fixed = value.toFixed(2);

  return value > 0 ? `+${fixed}` : fixed;
}

function formatVolume(volume: number) {
  if (volume >= 100_000_000) {
    return `${(volume / 100_000_000).toFixed(2)} 亿`;
  }

  return `${(volume / 10_000).toFixed(1)} 万`;
}

function formatAmount(amount: number) {
  if (amount >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(2)} 亿`;
  }

  return `${(amount / 10_000).toFixed(1)} 万`;
}

function getPackedRangeWindowSecs(dayCount: number) {
  return dayCount * tradingSessionSecs + Math.max(0, dayCount - 1) * dayGapSecs;
}

function getCurrentWeekTradingDayCount(records: StockDailyRecord[]) {
  const latest = records.at(-1);

  if (!latest) {
    return 1;
  }

  const weekStart = getWeekStartDate(latest.date);
  const count = records.filter((record) => new Date(`${record.date}T12:00:00`) >= weekStart).length;

  return Math.min(7, Math.max(1, count));
}

function getWeekStartDate(date: string) {
  const cursor = new Date(`${date}T12:00:00`);
  const day = cursor.getDay();
  const diff = day === 0 ? 6 : day - 1;

  cursor.setDate(cursor.getDate() - diff);
  cursor.setHours(0, 0, 0, 0);

  return cursor;
}

function clampPrice(value: number, record: StockDailyRecord) {
  const min = record.limit_down ?? 0.01;
  const max = record.limit_up ?? Number.POSITIVE_INFINITY;

  return Math.min(max, Math.max(min, value));
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}
