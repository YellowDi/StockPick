import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { defaultStrategyConfig, type StrategyConfig } from "@/features/strategy-switch/strategy-config";
import { StrategySwitchButton } from "@/features/strategy-switch/strategy-switch-button";
import { stockListMeta } from "@/data/mock-stocks";
import { addStockFilter, deleteStockFilter, listStockFilters, listStocks, scanStrategy, type DailyKline, type StockFilter, type StockInfo, type StrategyScanResult } from "@/lib/stock-api";
import { cn } from "@/lib/utils";
import { isThemeToggleVisible, type ThemeMode } from "@/types/theme";
import type { StockCandidate, StockDailyRecord, StockListKey } from "@/types/stock";

const listOrder: StockListKey[] = ["initial", "selected", "whitelist", "blacklist"];
const daySecs = 24 * 60 * 60;
const dailyKVisibleDays = 7;
const chartRightGapSecs = daySecs * 1.15;
const heroChartPadding = { top: 260, right: 118, bottom: 72, left: 24 };
const compactHeroChartPadding = { top: 292, right: 76, bottom: 54, left: 12 };
const compactViewportQuery = "(max-width: 639px)";
const mobileViewportQuery = "(max-width: 767px)";
const chartRangeOptionsBase = [
  { id: "daily", label: "日K" },
  { id: "today", label: "当日" },
] as const;
const emptyStockGroups: StockGroups = {
  initial: [],
  selected: [],
  whitelist: [],
  blacklist: [],
};
type ChartRangeId = (typeof chartRangeOptionsBase)[number]["id"];
type ChartMode = "line" | "candle";
const chartModeOptions = [
  { id: "candle" as const, label: "K线" },
  { id: "line" as const, label: "折线" },
];
const stockDataViewOptions = [
  { id: "daily-detail" as const, label: "日 K 明细" },
  { id: "five-day-trend" as const, label: "近 5 日走势" },
];
type StockDataViewId = (typeof stockDataViewOptions)[number]["id"];
const stockImportResultLimit = 80;
const exactCodePrefixPattern = /^(SH|SZ)/i;
const stockItemActionClassName = cn(
  "w-8 translate-x-0 shrink-0 overflow-hidden opacity-100 transition-[width,opacity,transform] duration-150",
  "md:w-0 md:translate-x-1 md:opacity-0",
  "md:group-focus-within/stock-item:w-8 md:group-focus-within/stock-item:translate-x-0 md:group-focus-within/stock-item:opacity-100",
  "md:group-hover/stock-item:w-8 md:group-hover/stock-item:translate-x-0 md:group-hover/stock-item:opacity-100",
);

type ChartSelection = {
  code: string;
  listKey: StockListKey;
};

type StockGroups = Record<StockListKey, StockCandidate[]>;
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

type StockListAction = {
  icon: "add" | "added" | "delete";
  title: string;
  disabled?: boolean;
  pending?: boolean;
  onClick?: () => void;
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

type StockDashboardState = {
  stockGroups: StockGroups;
  chartSelection: ChartSelection | null;
  mobileListKey: StockListKey;
  importTargetList: ReturnableListKey | null;
  scanError: string | null;
  scanReloadKey: number;
  scanLoading: boolean;
  filterListsError: string | null;
  filterDeletePendingIds: number[];
  strategyConfig: StrategyConfig;
};

type StockDashboardAction =
  | { type: "set-chart-selection"; selection: ChartSelection | null }
  | { type: "set-mobile-list"; listKey: StockListKey }
  | { type: "open-import"; listKey: ReturnableListKey }
  | { type: "close-import" }
  | { type: "scan-start" }
  | { type: "scan-success"; stocks: StockCandidate[] }
  | { type: "scan-error"; error: string }
  | { type: "scan-reload" }
  | { type: "set-filter-error"; error: string | null }
  | { type: "sync-filter-lists"; whitelist: StockCandidate[]; blacklist: StockCandidate[] }
  | { type: "remove-filter-stock"; stock: StockCandidate; listKey: ReturnableListKey }
  | { type: "delete-filter-start"; filterId: number }
  | { type: "delete-filter-end"; filterId: number }
  | { type: "add-selected-stock"; stock: StockCandidate }
  | { type: "remove-selected-stock"; stock: StockCandidate }
  | { type: "set-strategy-config"; config: StrategyConfig };

const initialStockDashboardState: StockDashboardState = {
  stockGroups: emptyStockGroups,
  chartSelection: null,
  mobileListKey: "selected",
  importTargetList: null,
  scanError: null,
  scanReloadKey: 0,
  scanLoading: true,
  filterListsError: null,
  filterDeletePendingIds: [],
  strategyConfig: defaultStrategyConfig,
};

export default function StockDashboard({
  themeMode,
  onThemeToggle,
  onLogout,
}: StockDashboardProps) {
  const dashboard = useStockDashboard();

  return (
    <StockDashboardLayout
      themeMode={themeMode}
      onThemeToggle={onThemeToggle}
      onLogout={onLogout}
      {...dashboard}
    />
  );
}

function useStockDashboard() {
  const stockBoardRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(stockDashboardReducer, initialStockDashboardState);
  const chartSelection = state.chartSelection;
  const selectedStock = chartSelection
    ? state.stockGroups[chartSelection.listKey].find((stock) => stock.code === chartSelection.code) ?? null
    : null;
  const selectedStockCodes = useMemo(
    () => new Set(state.stockGroups.selected.map((stock) => stock.code)),
    [state.stockGroups.selected],
  );

  useEffect(() => {
    const controller = new AbortController();

    dispatch({ type: "scan-start" });

    void scanStrategy(createScanRequestFromConfig(state.strategyConfig), controller.signal)
      .then((results) => {
        dispatch({ type: "scan-success", stocks: createScanStockCandidates(results) });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "策略扫描失败。";

        dispatch({ type: "scan-error", error: message });
        toast.error("策略扫描失败", {
          description: message,
        });
      });

    return () => controller.abort();
  }, [state.strategyConfig, state.scanReloadKey]);

  const syncFilterLists = useCallback(async (signal?: AbortSignal) => {
    const [whiteFilters, blackFilters] = await Promise.all([
      listStockFilters("white", signal),
      listStockFilters("black", signal),
    ]);
    const whitelist = createStockFilterCandidates(whiteFilters, "whitelist");
    const blacklist = createStockFilterCandidates(blackFilters, "blacklist");

    dispatch({
      type: "sync-filter-lists",
      whitelist,
      blacklist,
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void syncFilterLists(controller.signal)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "黑白名单加载失败。";

        dispatch({ type: "set-filter-error", error: message });
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
    if (state.chartSelection?.code === code && state.chartSelection.listKey === listKey) {
      dispatch({ type: "set-chart-selection", selection: null });
      scrollBoardIntoViewOnMobile();
      return;
    }

    dispatch({ type: "set-chart-selection", selection: { code, listKey } });
    scrollBoardIntoViewOnMobile();
  }

  function removeStockFromFilterList(stock: StockCandidate, fromList: ReturnableListKey) {
    dispatch({ type: "remove-filter-stock", stock, listKey: fromList });
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

    dispatch({ type: "delete-filter-start", filterId });

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

        dispatch({ type: "set-filter-error", error: message });
        toast.error("黑白名单同步失败", {
          description: message,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除黑白名单失败。";

      dispatch({ type: "set-filter-error", error: message });
      toast.error("删除黑白名单失败", {
        description: message,
      });
    } finally {
      dispatch({ type: "delete-filter-end", filterId });
    }
  }

  const openImportDialog = useCallback((listKey: ReturnableListKey) => {
    dispatch({ type: "open-import", listKey });
  }, []);

  const closeImportDialog = useCallback(() => {
    dispatch({ type: "close-import" });
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

      dispatch({ type: "set-filter-error", error: message });
      toast.error("黑白名单同步失败", {
        description: message,
      });
    }
  }, [syncFilterLists]);

  function addStockToSelected(stock: StockCandidate) {
    if (selectedStockCodes.has(stock.code)) {
      toast.message("已在已选", {
        description: `${stock.name} ${stock.code}`,
      });
      return;
    }

    dispatch({ type: "add-selected-stock", stock });
    toast.success("已添加到已选", {
      description: `${stock.name} ${stock.code}`,
    });
  }

  function removeStockFromSelected(stock: StockCandidate) {
    if (!selectedStockCodes.has(stock.code)) {
      return;
    }

    dispatch({ type: "remove-selected-stock", stock });
    toast.success("已从已选删除", {
      description: `${stock.name} ${stock.code}`,
    });
  }

  return {
    stockBoardRef,
    state,
    selectedStock,
    selectedStockCodes,
    openImportDialog,
    closeImportDialog,
    importStockToList,
    addStockToSelected,
    removeStockFromSelected,
    toggleSelectedStock,
    deleteStockFromFilterList,
    reloadStrategyScan: () => dispatch({ type: "scan-reload" }),
    setMobileListKey: (listKey: StockListKey) => dispatch({ type: "set-mobile-list", listKey }),
    setStrategyConfig: (config: StrategyConfig) => dispatch({ type: "set-strategy-config", config }),
  };
}

function StockDashboardLayout({
  themeMode,
  onThemeToggle,
  onLogout,
  stockBoardRef,
  state,
  selectedStock,
  selectedStockCodes,
  openImportDialog,
  closeImportDialog,
  importStockToList,
  addStockToSelected,
  removeStockFromSelected,
  toggleSelectedStock,
  deleteStockFromFilterList,
  reloadStrategyScan,
  setMobileListKey,
  setStrategyConfig,
}: StockDashboardProps & ReturnType<typeof useStockDashboard>) {
  const sharedStockListProps = {
    chartSelection: state.chartSelection,
    filterDeletePendingIds: state.filterDeletePendingIds,
    selectedStockCodes,
    onAddToSelected: addStockToSelected,
    onRemoveFromSelected: removeStockFromSelected,
    onToggleChart: toggleSelectedStock,
    onDeleteFromFilterList: deleteStockFromFilterList,
  };

  return (
    <main className="min-h-screen overflow-x-hidden text-foreground">
      <div className="flex flex-col">
        <div ref={stockBoardRef}>
          <StockBoard
            stock={selectedStock}
            isLoading={state.scanLoading}
            error={state.scanError}
            themeMode={themeMode}
            onThemeToggle={onThemeToggle}
            onLogout={onLogout}
            onReload={reloadStrategyScan}
          />
        </div>

        <div className="mx-auto w-full max-w-[1680px] px-4 pb-6 sm:px-6 lg:px-8">
          <StrategySwitchButton
            config={state.strategyConfig}
            onSave={setStrategyConfig}
          />
          {state.filterListsError ? (
            <p
              className="mx-auto mt-3 max-w-[720px] rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
              role="alert"
            >
              黑白名单操作失败：{state.filterListsError}
            </p>
          ) : null}

          <MobileStockTabs
            activeListKey={state.mobileListKey}
            stockGroups={state.stockGroups}
            onOpenImport={openImportDialog}
            onActiveListChange={setMobileListKey}
            {...sharedStockListProps}
          />

          <section className="mt-4 hidden gap-4 md:grid xl:grid-cols-4">
            {listOrder.map((key) => (
              <StockColumn
                key={key}
                listKey={key}
                stocks={state.stockGroups[key]}
                {...sharedStockListProps}
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
      {state.importTargetList ? (
        <StockImportDialog
          targetList={state.importTargetList}
          stockGroups={state.stockGroups}
          onClose={closeImportDialog}
          onImportStock={importStockToList}
        />
      ) : null}
    </main>
  );
}

function stockDashboardReducer(
  state: StockDashboardState,
  action: StockDashboardAction,
): StockDashboardState {
  switch (action.type) {
    case "set-chart-selection":
      return { ...state, chartSelection: action.selection };
    case "set-mobile-list":
      return { ...state, mobileListKey: action.listKey };
    case "open-import":
      return { ...state, importTargetList: action.listKey };
    case "close-import":
      return { ...state, importTargetList: null };
    case "scan-start":
      return { ...state, scanLoading: true, scanError: null };
    case "scan-success":
      return syncScanStocksState(state, action.stocks);
    case "scan-error":
      return { ...state, scanLoading: false, scanError: action.error };
    case "scan-reload":
      return { ...state, scanReloadKey: state.scanReloadKey + 1 };
    case "set-filter-error":
      return { ...state, filterListsError: action.error };
    case "sync-filter-lists":
      return syncFilterListsState(state, action.whitelist, action.blacklist);
    case "remove-filter-stock":
      return removeFilterStockState(state, action.stock, action.listKey);
    case "delete-filter-start":
      return {
        ...state,
        filterDeletePendingIds: state.filterDeletePendingIds.includes(action.filterId)
          ? state.filterDeletePendingIds
          : [...state.filterDeletePendingIds, action.filterId],
        filterListsError: null,
      };
    case "delete-filter-end":
      return {
        ...state,
        filterDeletePendingIds: state.filterDeletePendingIds.filter((pendingId) => pendingId !== action.filterId),
      };
    case "add-selected-stock":
      return addSelectedStockState(state, action.stock);
    case "remove-selected-stock":
      return removeSelectedStockState(state, action.stock);
    case "set-strategy-config":
      return { ...state, strategyConfig: action.config };
  }

  return state;
}

function syncScanStocksState(
  state: StockDashboardState,
  initial: StockCandidate[],
): StockDashboardState {
  const knownRecords = new Map<string, StockDailyRecord[]>();

  for (const stock of initial) {
    knownRecords.set(getComparableStockCode(stock.code), stock.records);
  }

  const selected = state.stockGroups.selected.map((stock) => hydrateStockCandidate(stock, knownRecords));
  const whitelist = state.stockGroups.whitelist.map((stock) => hydrateStockCandidate(stock, knownRecords));
  const blacklist = state.stockGroups.blacklist.map((stock) => hydrateStockCandidate(stock, knownRecords));
  const stockGroups = {
    ...state.stockGroups,
    initial,
    selected,
    whitelist,
    blacklist,
  };
  let chartSelection = state.chartSelection;

  if (chartSelection) {
    const selection = chartSelection;

    if (!stockGroups[selection.listKey].some((stock) => stock.code === selection.code)) {
      chartSelection = null;
    }
  }

  if (!chartSelection && initial.length > 0) {
    chartSelection = { code: initial[0].code, listKey: "initial" };
  }

  return {
    ...state,
    stockGroups,
    chartSelection,
    scanLoading: false,
    scanError: null,
  };
}

function hydrateStockCandidate(
  stock: StockCandidate,
  knownRecords: Map<string, StockDailyRecord[]>,
): StockCandidate {
  const records = knownRecords.get(getComparableStockCode(stock.code));

  return records
    ? { ...stock, records }
    : stock;
}

function syncFilterListsState(
  state: StockDashboardState,
  whitelist: StockCandidate[],
  blacklist: StockCandidate[],
): StockDashboardState {
  const knownRecords = new Map<string, StockDailyRecord[]>();

  for (const stock of [...state.stockGroups.initial, ...state.stockGroups.selected]) {
    knownRecords.set(getComparableStockCode(stock.code), stock.records);
  }

  const stockGroups = {
    ...state.stockGroups,
    whitelist: whitelist.map((stock) => hydrateStockCandidate(stock, knownRecords)),
    blacklist: blacklist.map((stock) => hydrateStockCandidate(stock, knownRecords)),
  };

  if (!state.chartSelection || (state.chartSelection.listKey !== "whitelist" && state.chartSelection.listKey !== "blacklist")) {
    return {
      ...state,
      stockGroups,
      filterListsError: null,
    };
  }

  const nextStocks = state.chartSelection.listKey === "whitelist" ? stockGroups.whitelist : stockGroups.blacklist;
  const chartSelection = nextStocks.some((stock) => stock.code === state.chartSelection?.code)
    ? state.chartSelection
    : null;

  return {
    ...state,
    stockGroups,
    chartSelection,
    filterListsError: null,
  };
}

function removeFilterStockState(
  state: StockDashboardState,
  stock: StockCandidate,
  listKey: ReturnableListKey,
): StockDashboardState {
  if (!state.stockGroups[listKey].some((item) => item.code === stock.code)) {
    return state;
  }

  return {
    ...state,
    stockGroups: {
      ...state.stockGroups,
      [listKey]: state.stockGroups[listKey].filter((item) => item.code !== stock.code),
    },
    chartSelection: state.chartSelection?.listKey === listKey && state.chartSelection.code === stock.code
      ? null
      : state.chartSelection,
  };
}

function addSelectedStockState(
  state: StockDashboardState,
  stock: StockCandidate,
): StockDashboardState {
  if (state.stockGroups.selected.some((item) => item.code === stock.code)) {
    return state;
  }

  return {
    ...state,
    stockGroups: {
      ...state.stockGroups,
      selected: [
        ...state.stockGroups.selected,
        {
          code: stock.code,
          name: stock.name,
          records: stock.records,
          list: "selected",
        },
      ],
    },
    chartSelection: state.chartSelection?.listKey === "initial" && state.chartSelection.code === stock.code
      ? { code: stock.code, listKey: "selected" }
      : state.chartSelection,
  };
}

function removeSelectedStockState(
  state: StockDashboardState,
  stock: StockCandidate,
): StockDashboardState {
  const selected = state.stockGroups.selected.filter((item) => item.code !== stock.code);
  const chartSelection = state.chartSelection?.listKey === "selected" && state.chartSelection.code === stock.code
    ? state.stockGroups.initial.some((item) => item.code === stock.code)
      ? { code: stock.code, listKey: "initial" as const }
      : null
    : state.chartSelection;

  return {
    ...state,
    stockGroups: {
      ...state.stockGroups,
      selected,
    },
    chartSelection,
  };
}
type StockBoardProps = {
  stock: StockCandidate | null;
  isLoading: boolean;
  error: string | null;
  themeMode: ThemeMode;
  onThemeToggle: () => void;
  onLogout: () => void;
  onReload: () => void;
};

type ActiveStockBoardState = {
  chartRangeId: ChartRangeId;
  chartMode: ChartMode;
  detailsOpen: boolean;
};

type ActiveStockBoardAction =
  | { type: "select-range"; rangeId: ChartRangeId }
  | { type: "set-chart-mode"; chartMode: ChartMode }
  | { type: "toggle-details" };

const initialActiveStockBoardState: ActiveStockBoardState = {
  chartRangeId: "daily",
  chartMode: "candle",
  detailsOpen: false,
};

function StockBoard({
  stock,
  isLoading,
  error,
  themeMode,
  onThemeToggle,
  onLogout,
  onReload,
}: StockBoardProps) {
  if (!stock) {
    return (
      <StockBoardLoading
        isLoading={isLoading}
        error={error}
        themeMode={themeMode}
        onThemeToggle={onThemeToggle}
        onLogout={onLogout}
        onReload={onReload}
      />
    );
  }

  return (
    <ActiveStockBoard
      key={`${stock.list}:${stock.code}`}
      stock={stock}
      isLoading={isLoading}
      error={error}
      themeMode={themeMode}
      onThemeToggle={onThemeToggle}
      onLogout={onLogout}
      onReload={onReload}
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
  isLoading,
  error,
  themeMode,
  onThemeToggle,
  onLogout,
  onReload,
}: Omit<StockBoardProps, "stock"> & {
  stock: StockCandidate;
}) {
  const [boardState, dispatchBoard] = useReducer(activeStockBoardReducer, initialActiveStockBoardState);
  const {
    chartRangeId,
    chartMode,
    detailsOpen,
  } = boardState;
  const chartStock = useMemo(
    () => ({
      ...stock,
      records: stock.records,
    }),
    [stock],
  );
  const sourceRecords = useMemo(
    () => chartStock.records.filter((record) => record.status === "成功"),
    [chartStock.records],
  );
  const chartView = useMemo(
    () => createChartView(sourceRecords, chartRangeId),
    [chartRangeId, sourceRecords],
  );
  const records = chartView.records;
  const latest = records.at(-1);
  const previous = records.at(-2);
  const change = latest && previous ? latest.close - previous.close : 0;
  const changePct = previous ? (change / previous.close) * 100 : 0;
  const chartColor = change >= 0
    ? themeMode === "light" ? "#b94545" : "#ef4444"
    : themeMode === "light" ? "#2f7f59" : "#22c55e";
  const momentum = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const chartRangeOptions = useMemo(() => chartRangeOptionsBase.map((option) => ({
    id: option.id,
    label: option.label,
    secs: getDailyKWindowSecs(sourceRecords),
  })), [sourceRecords]);
  const selectedRange = chartRangeOptions.find((option) => option.id === chartRangeId) ?? chartRangeOptions[0];
  const isCompactViewport = useIsCompactViewport();
  const chartPadding = isCompactViewport ? compactHeroChartPadding : heroChartPadding;

  function selectChartRange(rangeId: ChartRangeId) {
    dispatchBoard({ type: "select-range", rangeId });
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
              onClick={() => dispatchBoard({ type: "toggle-details" })}
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
                  key={`price-${stock.code}:${latest?.date ?? ""}:${latest?.close ?? ""}`}
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
                  key={`change-${stock.code}:${latest?.date ?? ""}:${change}:${changePct}`}
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
                  onClick={() => dispatchBoard({ type: "set-chart-mode", chartMode: option.id })}
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
              onClick={onReload}
            >
              <RefreshCcw data-icon="inline-start" className={cn(isLoading && "animate-spin")} />
              <span className="max-[420px]:hidden">{isLoading ? "加载中" : "重载"}</span>
            </Button>
          </div>

          <StockDetailsPanel
            id="stock-details-panel"
            open={detailsOpen}
            records={sourceRecords}
          />
        </div>

        <div className="absolute inset-0 z-0">
          {latest || isLoading ? (
            <Liveline
              data={latest ? chartView.lineData : []}
              value={latest?.close ?? 0}
              mode="candle"
              candles={chartView.candles}
              candleWidth={chartView.candleWidth}
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
              formatTime={formatChartDate}
              padding={chartPadding}
              className="size-full"
            />
          ) : (
            <EmptyChart error={error ?? chartStock.records[0]?.error} />
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

function activeStockBoardReducer(
  state: ActiveStockBoardState,
  action: ActiveStockBoardAction,
): ActiveStockBoardState {
  switch (action.type) {
    case "select-range":
      return {
        ...state,
        chartRangeId: action.rangeId,
        chartMode: "candle",
      };
    case "set-chart-mode":
      return { ...state, chartMode: action.chartMode };
    case "toggle-details":
      return { ...state, detailsOpen: !state.detailsOpen };
  }

  return state;
}

function StockBoardLoading({
  isLoading,
  error,
  themeMode,
  onThemeToggle,
  onLogout,
  onReload,
}: {
  isLoading: boolean;
  error: string | null;
  themeMode: ThemeMode;
  onThemeToggle: () => void;
  onLogout: () => void;
  onReload: () => void;
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
              {error ? "策略扫描失败" : isLoading ? "正在扫描" : "暂无候选股票"}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              {error ?? (isLoading ? "正在从策略扫描接口加载候选股票" : "当前策略没有返回候选股票")}
            </p>
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
              disabled={isLoading}
              onClick={onReload}
            >
              <RefreshCcw data-icon="inline-start" className={cn(isLoading && "animate-spin")} />
              {isLoading ? "加载中" : "重载"}
            </Button>
          </div>
        </div>

        <div className="absolute inset-0 z-0">
          <Liveline
            data={[]}
            value={0}
            mode="candle"
            candles={[]}
            candleWidth={daySecs}
            theme={themeMode}
            color={chartColor}
            window={daySecs * dailyKVisibleDays}
            grid
            loading={isLoading}
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
  selectedStockCodes,
  onOpenImport,
  onActiveListChange,
  onAddToSelected,
  onRemoveFromSelected,
  onToggleChart,
  onDeleteFromFilterList,
}: {
  activeListKey: StockListKey;
  stockGroups: Record<StockListKey, StockCandidate[]>;
  chartSelection: ChartSelection | null;
  filterDeletePendingIds: number[];
  selectedStockCodes: Set<string>;
  onOpenImport: (listKey: ReturnableListKey) => void;
  onActiveListChange: (key: StockListKey) => void;
  onAddToSelected: (stock: StockCandidate) => void;
  onRemoveFromSelected: (stock: StockCandidate) => void;
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
                onClick={() => onToggleChart(stock.code, activeListKey)}
                action={getStockListAction({
                  stock,
                  listKey: activeListKey,
                  selectedStockCodes,
                  filterDeletePendingIds,
                  onAddToSelected,
                  onRemoveFromSelected,
                  onDeleteFromFilterList,
                })}
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
  const [activeViewId, setActiveViewId] = useState<StockDataViewId>("daily-detail");

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
        <div className="border-b p-3">
          <div className="flex w-max max-w-full gap-1 overflow-x-auto rounded-lg bg-background/45 p-1 [-webkit-overflow-scrolling:touch]">
            {stockDataViewOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "h-8 whitespace-nowrap rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors",
                  option.id === activeViewId
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
                aria-pressed={option.id === activeViewId}
                onClick={() => setActiveViewId(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-4 sm:max-h-[360px]">
          {activeViewId === "daily-detail" ? (
            <DailyKlineDetailSection records={records} />
          ) : (
            <FiveDayTrendSection records={records} />
          )}
        </div>
      </div>
    </div>
  );
}

function DailyKlineDetailSection({ records }: { records: StockDailyRecord[] }) {
  return (
    <section>
      <div className="mb-3 gap-1 lg:flex lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold">日 K 明细</h2>
          <p className="mt-1 text-sm text-muted-foreground">当前股票日 K 原始字段</p>
        </div>
        <span className="text-xs text-muted-foreground">记录 {records.length}</span>
      </div>
      {records.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">code</th>
                <th className="px-3 py-2 text-left font-medium">trade_date/date</th>
                <th className="px-3 py-2 text-right font-medium">open</th>
                <th className="px-3 py-2 text-right font-medium">close</th>
                <th className="px-3 py-2 text-right font-medium">high</th>
                <th className="px-3 py-2 text-right font-medium">low</th>
                <th className="px-3 py-2 text-right font-medium">last</th>
                <th className="px-3 py-2 text-right font-medium">limit_up</th>
                <th className="px-3 py-2 text-right font-medium">limit_down</th>
                <th className="px-3 py-2 text-right font-medium">limit_pct</th>
                <th className="px-3 py-2 text-right font-medium">volume</th>
                <th className="px-3 py-2 text-right font-medium">amount</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={`${record.code}:${record.date}`} className="border-b border-border/60 last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums">{record.code}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground tabular-nums">{record.date}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPrice(record.open)}</td>
                  <td className={cn("whitespace-nowrap px-3 py-2 text-right tabular-nums", record.close >= record.open ? "text-stock-up" : "text-stock-down")}>
                    {formatPrice(record.close)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPrice(record.high)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPrice(record.low)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPrice(record.last)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPrice(record.limit_up)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPrice(record.limit_down)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPercent(record.limit_pct)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatRawNumber(record.volume)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatRawNumber(record.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <StockDataEmptyState label="暂无日 K 明细数据" />
      )}
    </section>
  );
}

function FiveDayTrendSection({ records }: { records: StockDailyRecord[] }) {
  const visibleRecords = records.slice(-dailyKVisibleDays);
  const firstRecord = visibleRecords[0];
  const latestRecord = visibleRecords.at(-1);
  const rangeChangePct = firstRecord && latestRecord && firstRecord.close !== 0
    ? ((latestRecord.close - firstRecord.close) / firstRecord.close) * 100
    : null;
  const limitHitCount = visibleRecords.filter(hasTouchedLimitUp).length;
  const startIndex = records.length - visibleRecords.length;

  return (
    <section>
      <div className="mb-3 gap-1 lg:flex lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold">近 5 日走势</h2>
          <p className="mt-1 text-sm text-muted-foreground">基于当前股票日 K 明细</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 lg:mt-0">
          <TrendSummaryMetric
            label="收盘变化"
            value={rangeChangePct === null ? "--" : `${formatSigned(rangeChangePct)}%`}
            tone={rangeChangePct === null ? undefined : rangeChangePct >= 0 ? "up" : "down"}
          />
          <TrendSummaryMetric label="触及涨停" value={`${limitHitCount} 次`} />
        </div>
      </div>
      {visibleRecords.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">日期</th>
                <th className="px-3 py-2 text-right font-medium">收盘价</th>
                <th className="px-3 py-2 text-right font-medium">涨跌幅</th>
                <th className="px-3 py-2 text-right font-medium">涨停价</th>
                <th className="px-3 py-2 text-right font-medium">是否触及</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record, index) => {
                const previous = records[startIndex + index - 1];
                const dailyChangePct = getDailyChangePct(record, previous);
                const dailyPositive = dailyChangePct === null || dailyChangePct >= 0;
                const touchedLimitUp = hasTouchedLimitUp(record);

                return (
                  <tr key={`${record.code}:${record.date}`} className="border-b border-border/60 last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground tabular-nums">{record.date}</td>
                    <td className={cn("whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums", record.close >= record.open ? "text-stock-up" : "text-stock-down")}>
                      {formatPrice(record.close)}
                    </td>
                    <td className={cn("whitespace-nowrap px-3 py-2 text-right tabular-nums", dailyPositive ? "text-stock-up" : "text-stock-down")}>
                      {dailyChangePct === null ? "--" : `${formatSigned(dailyChangePct)}%`}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPrice(record.limit_up)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Badge
                        variant={touchedLimitUp ? "secondary" : "outline"}
                        className={cn("bg-background/45", touchedLimitUp && "text-stock-up")}
                      >
                        {touchedLimitUp ? "触及" : "未触及"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <StockDataEmptyState label="暂无近 5 日走势数据" />
      )}
    </section>
  );
}

function TrendSummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-background/45 px-2.5 py-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <span
        className={cn(
          "font-medium text-foreground tabular-nums",
          tone === "up" && "text-stock-up",
          tone === "down" && "text-stock-down",
        )}
      >
        {value}
      </span>
    </span>
  );
}

function StockDataEmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function createScanStockCandidates(results: StrategyScanResult[]): StockCandidate[] {
  const seenCodes = new Set<string>();

  return results.flatMap((result) => {
    const code = result.code?.trim() || result.klines?.find((kline) => kline.code?.trim())?.code?.trim() || "";

    if (!code) {
      return [];
    }

    const codeKey = getComparableStockCode(code);

    if (seenCodes.has(codeKey)) {
      return [];
    }

    seenCodes.add(codeKey);

    const name = result.name?.trim()
      || result.klines?.find((kline) => kline.name?.trim())?.name?.trim()
      || code;
    const stock: StockCandidate = {
      code,
      name,
      list: "initial",
      records: [],
    };
    const records = createDailyRecordsFromKlines(result.klines ?? [], stock);

    return [{
      ...stock,
      records: records.length > 0
        ? records
        : [createKlineNoDataRecord(stock, "策略扫描未返回有效日 K 数据")],
    }];
  });
}

function createScanRequestFromConfig(config: StrategyConfig) {
  return {
    config_id: 0,
    x: getStrategyScanX(config.baseDate),
    y: getStrategyScanY(config.ma5Ratio),
  };
}

function getStrategyScanX(baseDate: string) {
  if (baseDate === "today") {
    return 0;
  }

  const match = baseDate.match(/^prev-(\d+)$/);

  return match ? Number(match[1]) : 5;
}

function getStrategyScanY(ma5Ratio: string) {
  const ratio = Number(ma5Ratio);

  return Number.isFinite(ratio) ? ratio : 0;
}

function createDailyRecordsFromKlines(
  dailyKlines: DailyKline[],
  stock: StockCandidate,
): StockDailyRecord[] {
  return dailyKlines.flatMap((dailyKline) => {
    const date = formatTradeDate(dailyKline.date ?? dailyKline.trade_date);

    if (
      !date
      || !isFiniteNumber(dailyKline.open)
      || !isFiniteNumber(dailyKline.high)
      || !isFiniteNumber(dailyKline.low)
      || !isFiniteNumber(dailyKline.close)
    ) {
      return [];
    }

    const code = dailyKline.code?.trim() || stock.code;
    const name = dailyKline.name?.trim() || stock.name;
    const status: StockDailyRecord["status"] = dailyKline.status === "无数据" ? "无数据" : "成功";

    return [{
      code,
      name,
      date,
      open: dailyKline.open,
      high: dailyKline.high,
      low: dailyKline.low,
      close: dailyKline.close,
      volume: dailyKline.volume ?? 0,
      amount: dailyKline.amount ?? 0,
      last: dailyKline.last,
      limit_up: dailyKline.limit_up,
      limit_down: dailyKline.limit_down,
      limit_pct: dailyKline.limit_pct,
      status,
      error: dailyKline.error,
    }];
  }).sort((left, right) => left.date.localeCompare(right.date));
}

function createKlineNoDataRecord(stock: StockCandidate, error: string): StockDailyRecord {
  return {
    code: stock.code,
    name: stock.name,
    date: formatRecordDate(new Date()),
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    volume: 0,
    amount: 0,
    status: "无数据",
    error,
  };
}

function StockColumn({
  listKey,
  stocks,
  chartSelection,
  filterDeletePendingIds,
  selectedStockCodes,
  onAddToSelected,
  onRemoveFromSelected,
  onToggleChart,
  onDeleteFromFilterList,
  onOpenImport,
}: {
  listKey: StockListKey;
  stocks: StockCandidate[];
  chartSelection: ChartSelection | null;
  filterDeletePendingIds: number[];
  selectedStockCodes: Set<string>;
  onAddToSelected: (stock: StockCandidate) => void;
  onRemoveFromSelected: (stock: StockCandidate) => void;
  onToggleChart: (code: string, listKey: StockListKey) => void;
  onDeleteFromFilterList: (stock: StockCandidate, fromList: ReturnableListKey) => void | Promise<void>;
  onOpenImport: (listKey: ReturnableListKey) => void;
}) {
  const Icon = listIcons[listKey];
  const meta = stockListMeta[listKey];
  const returnableListKey = getReturnableListKey(listKey);

  return (
    <Card
      className="min-h-[260px] bg-card/88 shadow-[0_16px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:min-h-[360px]"
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
              onClick={() => onToggleChart(stock.code, listKey)}
              action={getStockListAction({
                stock,
                listKey,
                selectedStockCodes,
                filterDeletePendingIds,
                onAddToSelected,
                onRemoveFromSelected,
                onDeleteFromFilterList,
              })}
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
    error: "通过股票列表导入，等待策略扫描返回日 K 数据",
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

function formatTradeDate(tradeDate: string | undefined) {
  const value = tradeDate?.trim();

  if (!value) {
    return null;
  }

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  const isoDatePrefix = value.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoDatePrefix) {
    return isoDatePrefix[1];
  }

  return null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getStockListAction({
  stock,
  listKey,
  selectedStockCodes,
  filterDeletePendingIds,
  onAddToSelected,
  onRemoveFromSelected,
  onDeleteFromFilterList,
}: {
  stock: StockCandidate;
  listKey: StockListKey;
  selectedStockCodes: Set<string>;
  filterDeletePendingIds: number[];
  onAddToSelected: (stock: StockCandidate) => void;
  onRemoveFromSelected: (stock: StockCandidate) => void;
  onDeleteFromFilterList: (stock: StockCandidate, fromList: ReturnableListKey) => void | Promise<void>;
}): StockListAction | undefined {
  if (listKey === "initial") {
    return selectedStockCodes.has(stock.code)
      ? {
          icon: "added",
          title: "已在已选",
          disabled: true,
        }
      : {
          icon: "add",
          title: "添加到已选",
          onClick: () => onAddToSelected(stock),
        };
  }

  if (listKey === "selected") {
    return {
      icon: "delete",
      title: "从已选删除",
      onClick: () => onRemoveFromSelected(stock),
    };
  }

  const returnableListKey = getReturnableListKey(listKey);

  if (!returnableListKey) {
    return undefined;
  }

  const pending = Boolean(stock.filterId && filterDeletePendingIds.includes(stock.filterId));

  return {
    icon: "delete",
    title: `从${stockListMeta[returnableListKey].label}删除`,
    pending,
    onClick: () => void onDeleteFromFilterList(stock, returnableListKey),
  };
}

function StockListButton({
  stock,
  active,
  onClick,
  action,
}: {
  stock: StockCandidate;
  active: boolean;
  onClick: () => void;
  action?: StockListAction;
}) {
  return (
    <Item
      variant="outline"
      size="sm"
      className={cn(
        "group/stock-item min-w-0 flex-nowrap gap-2 bg-background/40 p-1 transition-[background-color,border-color,box-shadow]",
        active
          ? "border-ring bg-secondary shadow-[0_10px_32px_rgba(0,0,0,0.18)] ring-2 ring-ring/35"
          : "border-transparent hover:border-border",
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center rounded-md p-2 text-left outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={`${stock.name} ${stock.code}`}
        aria-pressed={active}
        onClick={onClick}
      >
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate font-medium">{stock.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{stock.code}</span>
        </span>
      </button>
      {action ? (
        <ItemActions
          className={cn(
            stockItemActionClassName,
            action.pending && "md:w-8 md:translate-x-0 md:opacity-100",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-md border border-border/70 bg-background/35 text-muted-foreground hover:border-ring/60 hover:text-foreground"
            aria-label={`${action.title}：${stock.name} ${stock.code}`}
            title={action.title}
            disabled={action.disabled || action.pending}
            onClick={action.onClick}
          >
            {action.pending ? (
              <LoaderCircle className="animate-spin" />
            ) : action.icon === "add" ? (
              <Plus />
            ) : action.icon === "added" ? (
              <CheckCircle2 />
            ) : (
              <Trash2 />
            )}
          </Button>
        </ItemActions>
      ) : null}
    </Item>
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
  const importDialog = useStockImportDialog(targetList, onImportStock);
  const {
    meta,
    oppositeList,
    codeQuery,
    nameQuery,
    searchMode,
    stocks,
    isLoading,
    error,
    importPendingCode,
    importError,
    filteredStocks,
    visibleStocks,
    setCodeQuery,
    setNameQuery,
    setSearchMode,
    handleSearch,
    handleImportStock,
  } = importDialog;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="p-5 pr-12">
          <DialogTitle className="text-xl text-balance">导入{meta.label}</DialogTitle>
          <DialogDescription>从股票列表添加标的</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[min(78vh,760px)] flex-col overflow-hidden">
          <StockImportSearchForm
            codeQuery={codeQuery}
            nameQuery={nameQuery}
            searchMode={searchMode}
            isLoading={isLoading}
            onCodeQueryChange={setCodeQuery}
            onNameQueryChange={setNameQuery}
            onSearchModeChange={setSearchMode}
            onSearch={handleSearch}
          />
          <StockImportSummary
            listLabel={meta.label}
            filteredCount={filteredStocks.length}
            visibleCount={visibleStocks.length}
          />
          {importError ? (
            <StockImportError message={importError} />
          ) : null}
          <StockImportResults
            targetList={targetList}
            oppositeList={oppositeList}
            metaLabel={meta.label}
            stockGroups={stockGroups}
            stocks={stocks}
            visibleStocks={visibleStocks}
            isLoading={isLoading}
            error={error}
            importPendingCode={importPendingCode}
            onImportStock={handleImportStock}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useStockImportDialog(
  targetList: ReturnableListKey,
  onImportStock: (stock: StockInfo, targetList: ReturnableListKey) => Promise<void>,
) {
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

  const setCodeQuery = useCallback((value: string) => {
    setDialogState((current) => ({ ...current, codeQuery: value }));
  }, []);

  const setNameQuery = useCallback((value: string) => {
    setDialogState((current) => ({ ...current, nameQuery: value }));
  }, []);

  const setSearchMode = useCallback((value: ImportSearchMode) => {
    setDialogState((current) => ({ ...current, searchMode: value }));
  }, []);

  const cancelActiveStockLoad = useCallback(() => {
    requestIdRef.current += 1;
  }, [requestIdRef]);

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
  }, [requestIdRef]);

  useEffect(() => {
    const controller = new AbortController();

    void loadStocks({}, controller.signal);

    return () => {
      cancelActiveStockLoad();
      controller.abort();
    };
  }, [cancelActiveStockLoad, loadStocks]);

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

  return {
    meta,
    oppositeList,
    codeQuery,
    nameQuery,
    searchMode,
    stocks,
    isLoading,
    error,
    importPendingCode,
    importError,
    filteredStocks,
    visibleStocks,
    setCodeQuery,
    setNameQuery,
    setSearchMode,
    handleSearch,
    handleImportStock,
  };
}

function StockImportSearchForm({
  codeQuery,
  nameQuery,
  searchMode,
  isLoading,
  onCodeQueryChange,
  onNameQueryChange,
  onSearchModeChange,
  onSearch,
}: {
  codeQuery: string;
  nameQuery: string;
  searchMode: ImportSearchMode;
  isLoading: boolean;
  onCodeQueryChange: (value: string) => void;
  onNameQueryChange: (value: string) => void;
  onSearchModeChange: (value: ImportSearchMode) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="border-y bg-muted/25 px-5 py-4" onSubmit={onSearch}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="stock-import-code">代码</Label>
          <Input
            id="stock-import-code"
            className="h-10 bg-background/70"
            value={codeQuery}
            placeholder="600519 / SH600519"
            onValueChange={onCodeQueryChange}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="stock-import-name">名称</Label>
          <Input
            id="stock-import-name"
            className="h-10 bg-background/70"
            value={nameQuery}
            placeholder="贵州茅台"
            onValueChange={onNameQueryChange}
          />
        </div>
        <StockImportSearchModeControl
          searchMode={searchMode}
          onSearchModeChange={onSearchModeChange}
        />
        <Button type="submit" className="h-10" disabled={isLoading}>
          {isLoading ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Search data-icon="inline-start" />}
          搜索
        </Button>
      </div>
    </form>
  );
}

function StockImportSearchModeControl({
  searchMode,
  onSearchModeChange,
}: {
  searchMode: ImportSearchMode;
  onSearchModeChange: (value: ImportSearchMode) => void;
}) {
  return (
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
          onClick={() => onSearchModeChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function StockImportSummary({
  listLabel,
  filteredCount,
  visibleCount,
}: {
  listLabel: string;
  filteredCount: number;
  visibleCount: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground">
      <span>
        结果 {filteredCount}
        {filteredCount > visibleCount ? `，显示前 ${visibleCount}` : ""}
      </span>
      <span>{listLabel}</span>
    </div>
  );
}

function StockImportError({ message }: { message: string }) {
  return (
    <div className="mx-5 mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      添加失败：{message}
    </div>
  );
}

function StockImportResults({
  targetList,
  oppositeList,
  metaLabel,
  stockGroups,
  stocks,
  visibleStocks,
  isLoading,
  error,
  importPendingCode,
  onImportStock,
}: {
  targetList: ReturnableListKey;
  oppositeList: ReturnableListKey;
  metaLabel: string;
  stockGroups: StockGroups;
  stocks: StockInfo[];
  visibleStocks: StockInfo[];
  isLoading: boolean;
  error: string | null;
  importPendingCode: string | null;
  onImportStock: (stock: StockInfo) => void | Promise<void>;
}) {
  if (isLoading && stocks.length === 0) {
    return (
      <div className="min-h-[320px] overflow-y-auto px-5 pb-5">
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[320px] overflow-y-auto px-5 pb-5">
        <div className="flex min-h-48 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 px-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[320px] overflow-y-auto px-5 pb-5">
      {visibleStocks.length > 0 ? (
        <ItemGroup className="gap-2">
          {visibleStocks.map((stock) => (
            <StockImportResultItem
              key={stock.code}
              stock={stock}
              targetList={targetList}
              oppositeList={oppositeList}
              metaLabel={metaLabel}
              stockGroups={stockGroups}
              importPendingCode={importPendingCode}
              onImportStock={onImportStock}
            />
          ))}
        </ItemGroup>
      ) : (
        <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
          暂无匹配股票
        </div>
      )}
    </div>
  );
}

function StockImportResultItem({
  stock,
  targetList,
  oppositeList,
  metaLabel,
  stockGroups,
  importPendingCode,
  onImportStock,
}: {
  stock: StockInfo;
  targetList: ReturnableListKey;
  oppositeList: ReturnableListKey;
  metaLabel: string;
  stockGroups: StockGroups;
  importPendingCode: string | null;
  onImportStock: (stock: StockInfo) => void | Promise<void>;
}) {
  const inTargetList = isStockInList(stock, stockGroups[targetList]);
  const inOppositeList = isStockInList(stock, stockGroups[oppositeList]);
  const isImporting = importPendingCode === getComparableStockCode(stock.code);
  const importTitle = inOppositeList ? "移入名单" : "添加到名单";

  return (
    <Item
      variant="outline"
      size="sm"
      className="group/stock-item flex-nowrap gap-2 bg-background/45 p-2"
    >
      <ItemContent className="min-w-0 gap-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <ItemTitle className="min-w-0 flex-1 truncate">{stock.name}</ItemTitle>
          <ItemDescription className="m-0 shrink-0 text-xs tabular-nums">{stock.code}</ItemDescription>
        </div>
        {inTargetList ? (
          <ItemDescription className="m-0 text-xs">
            已在{metaLabel}
          </ItemDescription>
        ) : null}
        {inOppositeList && !inTargetList ? (
          <ItemDescription className="m-0 text-xs">
            已在{stockListMeta[oppositeList].label}
          </ItemDescription>
        ) : null}
      </ItemContent>
      {!inTargetList ? (
        <ItemActions
          className={cn(
            stockItemActionClassName,
            isImporting && "md:w-8 md:translate-x-0 md:opacity-100",
          )}
        >
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 rounded-md bg-background/55"
            aria-label={`${importTitle}：${stock.name} ${stock.code}`}
            title={importTitle}
            disabled={Boolean(importPendingCode)}
            onClick={() => void onImportStock(stock)}
          >
            {isImporting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Plus />
            )}
          </Button>
        </ItemActions>
      ) : null}
    </Item>
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
  history: StockDailyRecord[],
  rangeId: ChartRangeId,
) {
  if (rangeId === "daily") {
    const records = history.slice(-dailyKVisibleDays);
    const candles = createDisplayDailyCandles(records);

    return {
      records,
      candles,
      lineData: createLineDataFromCandles(candles, daySecs),
      candleWidth: daySecs,
    };
  }

  const records = history.slice(-1);
  const candles = createDisplayDailyCandles(records);

  return {
    records,
    candles,
    lineData: createLineDataFromCandles(candles, daySecs),
    candleWidth: daySecs,
  };
}

function createDisplayDailyCandles(records: StockDailyRecord[]): CandlePoint[] {
  const windowSecs = getDailyKWindowSecs(records);
  const rightEdge = Date.now() / 1000 + windowSecs * 0.015;
  const latestStartTime = rightEdge - chartRightGapSecs;

  return records.map((record, index) => ({
    time: latestStartTime - (records.length - 1 - index) * daySecs,
    open: record.open,
    high: record.high,
    low: record.low,
    close: record.close,
  }));
}

function createLineDataFromCandles(
  candles: CandlePoint[],
  width = daySecs,
): LivelinePoint[] {
  return candles.flatMap((candle) => {
    const midValue = Math.abs(candle.high - candle.close) > Math.abs(candle.low - candle.close)
      ? candle.high
      : candle.low;

    return [
      { time: candle.time, value: candle.open },
      { time: candle.time + width * 0.45, value: midValue },
      { time: candle.time + width, value: candle.close },
    ];
  });
}

function formatChartDate(time: number) {
  return formatRecordDate(new Date(time * 1000));
}

function formatSigned(value: number) {
  const fixed = value.toFixed(2);

  return value > 0 ? `+${fixed}` : fixed;
}

function formatPrice(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "--";
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "--";
}

function formatRawNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("zh-CN") : "--";
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

function getDailyKWindowSecs(records: StockDailyRecord[]) {
  const visibleRecords = records.slice(-dailyKVisibleDays);

  if (visibleRecords.length <= 1) {
    return daySecs * dailyKVisibleDays;
  }

  const firstTime = getRecordTime(visibleRecords[0]);
  const lastTime = getRecordTime(visibleRecords.at(-1)!);

  return Math.max(daySecs * visibleRecords.length, lastTime - firstTime + daySecs);
}

function getDailyChangePct(
  record: StockDailyRecord,
  previous: StockDailyRecord | undefined,
) {
  const base = previous?.close ?? record.last;

  return typeof base === "number" && base !== 0 ? ((record.close - base) / base) * 100 : null;
}

function hasTouchedLimitUp(record: StockDailyRecord) {
  return typeof record.limit_up === "number" && record.limit_up > 0 && record.high >= record.limit_up;
}

function getRecordTime(record: StockDailyRecord) {
  const time = new Date(`${record.date}T12:00:00`).getTime() / 1000;

  return Number.isFinite(time) ? time : Date.now() / 1000;
}
