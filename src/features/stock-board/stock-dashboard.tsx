import {
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  CheckCircle2,
  Database,
  Import as ImportIcon,
  ListFilter,
  LogOut,
  LoaderCircle,
  Moon,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShieldX,
  Sun,
  Trash2,
} from "lucide-react";
import { Liveline, type CandlePoint, type LivelinePoint } from "liveline";
import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Item, ItemGroup } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { defaultStrategyConfig, StrategySwitchButton, type StrategyConfig } from "@/features/strategy-switch/strategy-switch-button";
import { mockStockGroups, stockListMeta } from "@/data/mock-stocks";
import { addStockFilter, deleteStockFilter, listStockFilters, listStocks, type StockFilter, type StockInfo } from "@/lib/stock-api";
import { cn } from "@/lib/utils";
import { isThemeToggleVisible, type ThemeMode } from "@/types/theme";
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
const stockImportResultLimit = 80;
const exactCodePrefixPattern = /^(SH|SZ)/i;

type DraggedStock = {
  code: string;
  fromList: StockListKey;
};

type ChartSelection = {
  code: string;
  listKey: StockListKey;
};

type ReturnableListKey = Extract<StockListKey, "whitelist" | "blacklist">;
type ImportSearchMode = "fuzzy" | "exact";
type StockImportDialogState = {
  codeQuery: string;
  nameQuery: string;
  searchMode: ImportSearchMode;
  stocks: StockInfo[];
  isLoading: boolean;
  error: string | null;
  importPendingCode: string | null;
  importError: string | null;
};

const initialStockImportDialogState: StockImportDialogState = {
  codeQuery: "",
  nameQuery: "",
  searchMode: "fuzzy",
  stocks: [],
  isLoading: true,
  error: null,
  importPendingCode: null,
  importError: null,
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
  const [chartSelection, setChartSelection] = useState<ChartSelection | null>(null);
  const [draggedStock, setDraggedStock] = useState<DraggedStock | null>(null);
  const [dropTarget, setDropTarget] = useState<StockListKey | null>(null);
  const [mobileListKey, setMobileListKey] = useState<StockListKey>("selected");
  const [importTargetList, setImportTargetList] = useState<ReturnableListKey | null>(null);
  const [filterListsError, setFilterListsError] = useState<string | null>(null);
  const [filterDeletePendingIds, setFilterDeletePendingIds] = useState<number[]>([]);
  const [strategyConfig, setStrategyConfig] = useState<StrategyConfig>(defaultStrategyConfig);
  const selectedStock = chartSelection
    ? stockGroups[chartSelection.listKey].find((stock) => stock.code === chartSelection.code) ?? null
    : null;
  const selectedStockCodes = useMemo(
    () => new Set(stockGroups.selected.map((stock) => stock.code)),
    [stockGroups.selected],
  );

  const syncFilterLists = useCallback(async (signal?: AbortSignal) => {
    const [whiteFilters, blackFilters] = await Promise.all([
      listStockFilters("white", signal),
      listStockFilters("black", signal),
    ]);
    const whitelist = createStockFilterCandidates(whiteFilters, "whitelist");
    const blacklist = createStockFilterCandidates(blackFilters, "blacklist");

    setStockGroups((currentGroups) => ({
      ...currentGroups,
      whitelist,
      blacklist,
    }));
    setChartSelection((selection) => {
      if (!selection || (selection.listKey !== "whitelist" && selection.listKey !== "blacklist")) {
        return selection;
      }

      const nextStocks = selection.listKey === "whitelist" ? whitelist : blacklist;

      return nextStocks.some((stock) => stock.code === selection.code) ? selection : null;
    });
    setFilterListsError(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void syncFilterLists(controller.signal)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "黑白名单加载失败。";

        setFilterListsError(message);
        toast.error("黑白名单加载失败", {
          description: message,
        });
      });

    return () => controller.abort();
  }, [syncFilterLists]);

  function scrollBoardIntoViewOnMobile() {
    if (!window.matchMedia(mobileViewportQuery).matches) {
      return;
    }

    window.requestAnimationFrame(() => {
      stockBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleSelectedStock(code: string, listKey: StockListKey) {
    if (chartSelection?.code === code && chartSelection.listKey === listKey) {
      setChartSelection(null);
      scrollBoardIntoViewOnMobile();
      return;
    }

    setChartSelection({ code, listKey });
    scrollBoardIntoViewOnMobile();
  }

  function removeStockFromFilterList(stock: StockCandidate, fromList: ReturnableListKey) {
    setStockGroups((currentGroups) => {
      if (!currentGroups[fromList].some((item) => item.code === stock.code)) {
        return currentGroups;
      }

      return {
        ...currentGroups,
        [fromList]: currentGroups[fromList].filter((item) => item.code !== stock.code),
      };
    });
    setChartSelection((selection) => (
      selection?.listKey === fromList && selection.code === stock.code
        ? null
        : selection
    ));
  }

  async function deleteStockFromFilterList(stock: StockCandidate, fromList: ReturnableListKey) {
    const filterId = stock.filterId;
    const listLabel = stockListMeta[fromList].label;
    const stockLabel = `${stock.name} ${stock.code}`;

    if (!filterId) {
      removeStockFromFilterList(stock, fromList);
      toast.success(`已从${listLabel}删除`, {
        description: stockLabel,
      });
      return;
    }

    setFilterDeletePendingIds((currentIds) => (
      currentIds.includes(filterId) ? currentIds : [...currentIds, filterId]
    ));
    setFilterListsError(null);

    try {
      await deleteStockFilter(filterId);
      removeStockFromFilterList(stock, fromList);
      toast.success(`已从${listLabel}删除`, {
        description: stockLabel,
      });

      try {
        await syncFilterLists();
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : "黑白名单同步失败。";

        setFilterListsError(message);
        toast.error("黑白名单同步失败", {
          description: message,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除黑白名单失败。";

      setFilterListsError(message);
      toast.error("删除黑白名单失败", {
        description: message,
      });
    } finally {
      setFilterDeletePendingIds((currentIds) => (
        currentIds.filter((pendingId) => pendingId !== filterId)
      ));
    }
  }

  const openImportDialog = useCallback((listKey: ReturnableListKey) => {
    setImportTargetList(listKey);
  }, []);

  const closeImportDialog = useCallback(() => {
    setImportTargetList(null);
  }, []);

  const importStockToList = useCallback(async (stock: StockInfo, targetList: ReturnableListKey) => {
    await addStockFilter({
      code: stock.code,
      name: stock.name,
      listType: getFilterListType(targetList),
    });
    try {
      await syncFilterLists();
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "黑白名单同步失败。";

      setFilterListsError(message);
      toast.error("黑白名单同步失败", {
        description: message,
      });
    }
  }, [syncFilterLists]);

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
      setStockGroups((currentGroups) => {
        const sourceStock = currentGroups[stock.fromList].find((item) => item.code === stock.code);

        if (!sourceStock || currentGroups.selected.some((item) => item.code === stock.code)) {
          return currentGroups;
        }

        return {
          ...currentGroups,
          ...(stock.fromList === "initial"
            ? { initial: currentGroups.initial.filter((item) => item.code !== stock.code) }
            : {}),
          selected: [
            ...currentGroups.selected,
            {
              code: sourceStock.code,
              name: sourceStock.name,
              records: sourceStock.records,
              list: "selected",
            },
          ],
        };
      });
      setChartSelection((selection) => (
        selection?.listKey === "initial" && selection.code === stock.code
          ? { code: stock.code, listKey: "selected" }
          : selection
      ));

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
                code: selectedStock.code,
                name: selectedStock.name,
                records: selectedStock.records,
                list: targetList,
              },
            ],
      };
    });
    setChartSelection((selection) => (
      selection?.listKey === "selected" && selection.code === stock.code ? null : selection
    ));
  }

  function handleStockDragStart(
    stock: StockCandidate,
    fromList: StockListKey,
    event: DragEvent<HTMLElement>,
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
    chartSelection,
    filterDeletePendingIds,
    onToggleChart: toggleSelectedStock,
    onDeleteFromFilterList: deleteStockFromFilterList,
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
          {filterListsError ? (
            <p
              className="mx-auto mt-3 max-w-[720px] rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
              role="alert"
            >
              黑白名单操作失败：{filterListsError}
            </p>
          ) : null}

          <MobileStockTabs
            activeListKey={mobileListKey}
            stockGroups={stockGroups}
            onOpenImport={openImportDialog}
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
                onOpenImport={openImportDialog}
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
      {importTargetList ? (
        <StockImportDialog
          targetList={importTargetList}
          stockGroups={stockGroups}
          onClose={closeImportDialog}
          onImportStock={importStockToList}
        />
      ) : null}
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
      key={`${stock.list}:${stock.code}`}
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
  const isCompactViewport = useIsCompactViewport();
  const chartPadding = isCompactViewport ? compactHeroChartPadding : heroChartPadding;

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
            {isThemeToggleVisible(themeMode) ? (
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
            ) : null}
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
  const isCompactViewport = useIsCompactViewport();
  const chartPadding = isCompactViewport ? compactHeroChartPadding : heroChartPadding;

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
            {isThemeToggleVisible(themeMode) ? (
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
            ) : null}
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
  chartSelection,
  filterDeletePendingIds,
  onOpenImport,
  onActiveListChange,
  onToggleChart,
  onDeleteFromFilterList,
}: {
  activeListKey: StockListKey;
  stockGroups: Record<StockListKey, StockCandidate[]>;
  chartSelection: ChartSelection | null;
  filterDeletePendingIds: number[];
  onOpenImport: (listKey: ReturnableListKey) => void;
  onActiveListChange: (key: StockListKey) => void;
  onToggleChart: (code: string, listKey: StockListKey) => void;
  onDeleteFromFilterList: (stock: StockCandidate, fromList: ReturnableListKey) => void | Promise<void>;
}) {
  const stocks = stockGroups[activeListKey];
  const meta = stockListMeta[activeListKey];
  const returnableListKey = getReturnableListKey(activeListKey);

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
          <div className="flex min-w-0 items-center gap-2">
            <CardDescription className="truncate">{meta.description}</CardDescription>
            <Badge variant="secondary">{stocks.length}</Badge>
          </div>
          {returnableListKey ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 bg-background/45"
              onClick={() => onOpenImport(returnableListKey)}
            >
              <ImportIcon data-icon="inline-start" />
              导入
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pb-5">
        {stocks.length > 0 ? (
          <ItemGroup className="gap-2">
            {stocks.map((stock) => (
              <StockListButton
                key={stock.code}
                stock={stock}
                active={chartSelection?.listKey === activeListKey && chartSelection.code === stock.code}
                draggable={false}
                onClick={() => onToggleChart(stock.code, activeListKey)}
                deletePending={Boolean(stock.filterId && filterDeletePendingIds.includes(stock.filterId))}
                onDeleteFromFilterList={returnableListKey ? () => void onDeleteFromFilterList(stock, returnableListKey) : undefined}
              />
            ))}
          </ItemGroup>
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
  const showThemeToggle = isThemeToggleVisible(themeMode);

  return (
    <div
      className={cn(
        "mt-4 grid gap-2 pb-4 md:hidden",
        showThemeToggle ? "grid-cols-2" : "grid-cols-1",
      )}
    >
      {showThemeToggle ? (
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
      ) : null}
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
  chartSelection,
  filterDeletePendingIds,
  canDrop,
  isDropTarget,
  onToggleChart,
  onDeleteFromFilterList,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenImport,
}: {
  listKey: StockListKey;
  stocks: StockCandidate[];
  chartSelection: ChartSelection | null;
  filterDeletePendingIds: number[];
  canDrop: boolean;
  isDropTarget: boolean;
  onToggleChart: (code: string, listKey: StockListKey) => void;
  onDeleteFromFilterList: (stock: StockCandidate, fromList: ReturnableListKey) => void | Promise<void>;
  onDragStart: (
    stock: StockCandidate,
    fromList: StockListKey,
    event: DragEvent<HTMLElement>,
  ) => void;
  onDragEnd: () => void;
  onDragOver: (listKey: StockListKey, event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (listKey: StockListKey, event: DragEvent<HTMLDivElement>) => void;
  onDrop: (listKey: StockListKey, event: DragEvent<HTMLDivElement>) => void;
  onOpenImport: (listKey: ReturnableListKey) => void;
}) {
  const Icon = listIcons[listKey];
  const meta = stockListMeta[listKey];
  const returnableListKey = getReturnableListKey(listKey);

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
            <Badge variant="secondary">{stocks.length}</Badge>
          </div>
          {returnableListKey ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 bg-background/45"
              onClick={() => onOpenImport(returnableListKey)}
            >
              <ImportIcon data-icon="inline-start" />
              导入
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pb-5">
        <ItemGroup className="gap-2">
          {stocks.map((stock) => (
            <StockListButton
              key={stock.code}
              stock={stock}
              active={chartSelection?.listKey === listKey && chartSelection.code === stock.code}
              onDragStart={(event) => onDragStart(stock, listKey, event)}
              onDragEnd={onDragEnd}
              onClick={() => onToggleChart(stock.code, listKey)}
              deletePending={Boolean(stock.filterId && filterDeletePendingIds.includes(stock.filterId))}
              onDeleteFromFilterList={returnableListKey ? () => void onDeleteFromFilterList(stock, returnableListKey) : undefined}
            />
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function getReturnableListKey(listKey: StockListKey): ReturnableListKey | null {
  return listKey === "whitelist" || listKey === "blacklist" ? listKey : null;
}

function getOppositeReturnableListKey(listKey: ReturnableListKey): ReturnableListKey {
  return listKey === "whitelist" ? "blacklist" : "whitelist";
}

function getFilterListType(listKey: ReturnableListKey) {
  return listKey === "whitelist" ? "white" : "black";
}

function createStockFilterCandidates(
  filters: StockFilter[],
  targetList: ReturnableListKey,
): StockCandidate[] {
  const seenCodes = new Set<string>();

  return filters.flatMap((filter) => {
    const candidate = createImportedStockCandidate(
      {
        code: filter.code,
        name: filter.name,
      },
      targetList,
      filter.id,
    );

    if (!candidate) {
      return [];
    }

    const codeKey = getComparableStockCode(candidate.code);

    if (seenCodes.has(codeKey)) {
      return [];
    }

    seenCodes.add(codeKey);
    return [candidate];
  });
}

function createImportedStockCandidate(
  stock: StockInfo,
  targetList: ReturnableListKey,
  filterId?: number,
): StockCandidate | null {
  const code = stock.code.trim();

  if (!code) {
    return null;
  }

  const name = stock.name.trim() || code;

  return {
    code,
    name,
    list: targetList,
    records: [createImportedNoDataRecord(code, name)],
    ...(filterId && filterId > 0 ? { filterId } : {}),
  };
}

function createImportedNoDataRecord(code: string, name: string): StockDailyRecord {
  return {
    code,
    name,
    date: formatRecordDate(new Date()),
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    volume: 0,
    amount: 0,
    status: "无数据",
    error: "通过股票列表导入，等待行情接口接入",
  };
}

function isStockInList(stock: StockInfo, stocks: StockCandidate[]) {
  const codeKey = getComparableStockCode(stock.code);

  return stocks.some((item) => getComparableStockCode(item.code) === codeKey);
}

function isExactStockMatch(stock: StockInfo, codeQuery: string, nameQuery: string) {
  const code = codeQuery.trim();
  const name = nameQuery.trim();
  const matchesCode = !code
    || stock.code.toUpperCase() === code.toUpperCase()
    || getComparableStockCode(stock.code) === getComparableStockCode(code);
  const matchesName = !name || stock.name === name;

  return matchesCode && matchesName;
}

function getComparableStockCode(code: string) {
  return code.trim().replace(exactCodePrefixPattern, "").toUpperCase();
}

function formatRecordDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function StockListButton({
  stock,
  active,
  draggable = true,
  deletePending = false,
  onDragStart,
  onDragEnd,
  onClick,
  onDeleteFromFilterList,
}: {
  stock: StockCandidate;
  active: boolean;
  draggable?: boolean;
  deletePending?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
  onClick: () => void;
  onDeleteFromFilterList?: () => void;
}) {
  const deleteTitle = deletePending ? "正在删除" : "从名单删除";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Item
        render={<button type="button" aria-label={`${stock.name} ${stock.code}`} />}
        variant="outline"
        size="sm"
        className={cn(
          "min-w-0 flex-1 justify-start bg-background/40 px-3 py-3 text-left transition-[background-color,border-color,color,transform,box-shadow] active:scale-[0.96]",
          active
            ? "border-ring bg-secondary shadow-[0_10px_32px_rgba(0,0,0,0.18)] ring-2 ring-ring/35"
            : "border-transparent bg-background/40 hover:border-border",
          draggable && "cursor-grab active:cursor-grabbing",
        )}
        aria-pressed={active}
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
        onClick={onClick}
      >
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate font-medium">{stock.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{stock.code}</span>
        </span>
      </Item>
      {onDeleteFromFilterList ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-lg border border-border/70 bg-background/35 text-muted-foreground hover:border-ring/60 hover:text-foreground"
          aria-label={deleteTitle}
          title={deleteTitle}
          disabled={deletePending}
          onClick={onDeleteFromFilterList}
        >
          {deletePending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Trash2 />
          )}
        </Button>
      ) : null}
    </div>
  );
}

function StockImportDialog({
  targetList,
  stockGroups,
  onClose,
  onImportStock,
}: {
  targetList: ReturnableListKey;
  stockGroups: Record<StockListKey, StockCandidate[]>;
  onClose: () => void;
  onImportStock: (stock: StockInfo, targetList: ReturnableListKey) => Promise<void>;
}) {
  const requestIdRef = useRef(0);
  const [dialogState, setDialogState] = useState<StockImportDialogState>(initialStockImportDialogState);
  const {
    codeQuery,
    nameQuery,
    searchMode,
    stocks,
    isLoading,
    error,
    importPendingCode,
    importError,
  } = dialogState;
  const meta = stockListMeta[targetList];
  const oppositeList = getOppositeReturnableListKey(targetList);
  const filteredStocks = useMemo(
    () => searchMode === "exact"
      ? stocks.filter((stock) => isExactStockMatch(stock, codeQuery, nameQuery))
      : stocks,
    [codeQuery, nameQuery, searchMode, stocks],
  );
  const visibleStocks = filteredStocks.slice(0, stockImportResultLimit);

  const loadStocks = useCallback(async (query: { code?: string; name?: string }, signal?: AbortSignal) => {
    const requestId = requestIdRef.current + 1;

    requestIdRef.current = requestId;
    setDialogState((current) => ({
      ...current,
      isLoading: true,
      error: null,
    }));

    try {
      const stockList = await listStocks(query, signal);

      if (requestId === requestIdRef.current) {
        setDialogState((current) => ({
          ...current,
          stocks: stockList,
        }));
      }
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      if (requestId === requestIdRef.current) {
        setDialogState((current) => ({
          ...current,
          stocks: [],
          error: loadError instanceof Error ? loadError.message : "股票列表加载失败。",
        }));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setDialogState((current) => ({
          ...current,
          isLoading: false,
        }));
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;

    requestIdRef.current = requestId;
    void listStocks({}, controller.signal)
      .then((stockList) => {
        if (requestId === requestIdRef.current) {
          setDialogState((current) => ({
            ...current,
            stocks: stockList,
          }));
        }
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        if (requestId === requestIdRef.current) {
          setDialogState((current) => ({
            ...current,
            stocks: [],
            error: loadError instanceof Error ? loadError.message : "股票列表加载失败。",
          }));
        }
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setDialogState((current) => ({
            ...current,
            isLoading: false,
          }));
        }
      });

    return () => {
      requestIdRef.current += 1;
      controller.abort();
    };
  }, []);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadStocks({
      code: codeQuery,
      name: nameQuery,
    });
  }

  async function handleImportStock(stock: StockInfo) {
    const stockCodeKey = getComparableStockCode(stock.code);

    setDialogState((current) => ({
      ...current,
      importPendingCode: stockCodeKey,
      importError: null,
    }));

    try {
      await onImportStock(stock, targetList);
      setDialogState((current) => ({
        ...current,
        importPendingCode: null,
        importError: null,
      }));
      toast.success(`已添加到${meta.label}`, {
        description: `${stock.name} ${stock.code}`,
      });
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "添加黑白名单失败。";

      setDialogState((current) => ({
        ...current,
        importPendingCode: null,
        importError: message,
      }));
      toast.error("添加黑白名单失败", {
        description: message,
      });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="p-5 pr-12">
          <DialogTitle className="text-xl text-balance">导入{meta.label}</DialogTitle>
          <DialogDescription>从股票列表添加标的</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[min(78vh,760px)] flex-col overflow-hidden">
          <form className="border-y bg-muted/25 px-5 py-4" onSubmit={handleSearch}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="stock-import-code">代码</Label>
                <Input
                  id="stock-import-code"
                  className="h-10 bg-background/70"
                  value={codeQuery}
                  placeholder="600519 / SH600519"
                  onChange={(event) => (
                    setDialogState((current) => ({ ...current, codeQuery: event.currentTarget.value }))
                  )}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="stock-import-name">名称</Label>
                <Input
                  id="stock-import-name"
                  className="h-10 bg-background/70"
                  value={nameQuery}
                  placeholder="贵州茅台"
                  onChange={(event) => (
                    setDialogState((current) => ({ ...current, nameQuery: event.currentTarget.value }))
                  )}
                />
              </div>
              <div className="flex h-10 rounded-lg bg-background/70 p-1">
                {[
                  { id: "fuzzy" as const, label: "模糊" },
                  { id: "exact" as const, label: "精准" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      "h-8 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors",
                      option.id === searchMode
                        ? "bg-secondary text-secondary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                    aria-pressed={option.id === searchMode}
                    onClick={() => setDialogState((current) => ({ ...current, searchMode: option.id }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <Button type="submit" className="h-10" disabled={isLoading}>
                {isLoading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Search data-icon="inline-start" />}
                搜索
              </Button>
            </div>
          </form>

          <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground">
            <span>
              结果 {filteredStocks.length}
              {filteredStocks.length > visibleStocks.length ? `，显示前 ${visibleStocks.length}` : ""}
            </span>
            <span>{meta.label}</span>
          </div>
          {importError ? (
            <div className="mx-5 mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              添加失败：{importError}
            </div>
          ) : null}

          <div className="min-h-[320px] overflow-y-auto px-5 pb-5">
            {isLoading && stocks.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                加载中...
              </div>
            ) : error ? (
              <div className="flex min-h-48 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 px-4 text-sm text-destructive">
                {error}
              </div>
            ) : visibleStocks.length > 0 ? (
              <div className="flex flex-col gap-2">
                {visibleStocks.map((stock) => {
                  const inTargetList = isStockInList(stock, stockGroups[targetList]);
                  const inOppositeList = isStockInList(stock, stockGroups[oppositeList]);
                  const isImporting = importPendingCode === getComparableStockCode(stock.code);

                  return (
                    <div
                      key={stock.code}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-background/45 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span className="truncate text-sm font-medium">{stock.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{stock.code}</span>
                        </div>
                        {inOppositeList && !inTargetList ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            已在{stockListMeta[oppositeList].label}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={inTargetList ? "secondary" : "outline"}
                        className="h-8 shrink-0 bg-background/55"
                        disabled={inTargetList || Boolean(importPendingCode)}
                        onClick={() => void handleImportStock(stock)}
                      >
                        {isImporting ? (
                          <LoaderCircle data-icon="inline-start" className="animate-spin" />
                        ) : inTargetList ? null : (
                          <Plus data-icon="inline-start" />
                        )}
                        {inTargetList ? "已添加" : isImporting ? "添加中" : "添加"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                暂无匹配股票
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
