import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  RiAddLine as Plus,
  RiArrowDownSLine as ChevronDown,
  RiArrowLeftSLine as ChevronLeft,
  RiArrowRightSLine as ChevronRight,
  RiCheckboxCircleLine as CheckCircle2,
  RiDatabase2Line as Database,
  RiDeleteBinLine as Trash2,
  RiFilter3Line as ListFilter,
  RiImportLine as ImportIcon,
  RiLoader4Line as LoaderCircle,
  RiLogoutBoxRLine as LogOut,
  RiMoonLine as Moon,
  RiRefreshLine as RefreshCcw,
  RiSearchLine as Search,
  RiShieldCheckLine as ShieldCheck,
  RiShieldCrossLine as ShieldX,
  RiSunLine as Sun,
} from "@remixicon/react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Disclosure,
  DisclosureGroup,
  EmptyState,
  Form,
  Input,
  Label,
  Modal,
  Pagination,
  ScrollShadow,
  Spinner,
  Surface,
  Table,
  TextField,
  Chip,
  toast,
  useOverlayState,
} from "@heroui/react";
import { Liveline, type CandlePoint, type LivelinePoint, type LivelineSeries } from "liveline";

import { BrandLockup } from "@/components/brand-lockup";
import { defaultStrategyConfig, type StrategyConfig } from "@/features/strategy-switch/strategy-config";
import { StrategySwitchButton } from "@/features/strategy-switch/strategy-switch-button";
import { stockListMeta } from "@/data/mock-stocks";
import {
  addStockFilter,
  addSelection,
  createStrategyConfig,
  deleteSelectionBatch,
  deleteSelectionRecords,
  deleteStockFilter,
  deleteStrategyConfig,
  listSelectionBatches,
  listSelectionRecords,
  listStockFilters,
  listStocks,
  listStrategyConfigs,
  scanStrategy,
  updateStrategyConfig,
  type DailyKline,
  type SelectionBatch,
  type SelectionRecord,
  type StockFilter,
  type StockInfo,
  type StrategyConfigDto,
  type StrategyScanResult,
} from "@/lib/stock-api";
import { cn } from "@/lib/utils";
import { isThemeToggleVisible, type ThemeMode } from "@/types/theme";
import type { StockCandidate, StockDailyRecord, StockListKey } from "@/types/stock";

const mobileListOrder: StockListKey[] = ["candidate", "initial"];
const filterListButtonOrder: ReturnableListKey[] = ["whitelist", "blacklist"];
const selectionHistoryPageSize = 5;
const daySecs = 24 * 60 * 60;
const dailyKVisibleDays = 7;
const axisLabelMatchThresholdSecs = daySecs / 2;
const chartLineWidth = 2.5;
const heroChartPadding = { top: 260, right: 88, bottom: 72, left: 24 };
const compactHeroChartPadding = { top: 292, right: 60, bottom: 54, left: 12 };
const desktopChartPadding = { top: 28, right: 60, bottom: 52, left: 0 };
const compactViewportQuery = "(max-width: 639px)";
const mobileViewportQuery = "(max-width: 767px)";
const emptyStockGroups: StockGroups = {
  initial: [],
  candidate: [],
  selected: [],
  whitelist: [],
  blacklist: [],
};
type ChartMode = "line" | "candle";
type ChartAxisDateLabel = {
  time: number;
  date: string;
};
const chartModeOptions = [
  { id: "candle" as const, label: "K线" },
  { id: "line" as const, label: "折线" },
];
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
  selectionBatchId?: number;
};

type StockGroups = Record<StockListKey, StockCandidate[]>;
type ReturnableListKey = Extract<StockListKey, "whitelist" | "blacklist">;
type SelectionBatchState = {
  id: number;
  name: string;
  createdAt?: string;
  total: number;
  stocks: StockCandidate[];
  isLoading: boolean;
  error: string | null;
};
type StockImportDialogState = {
  codeQuery: string;
  nameQuery: string;
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

type StockListSharedProps = {
  chartSelection: ChartSelection | null;
  filterDeletePendingIds: number[];
  selectionRecordDeletePendingIds: number[];
  candidateStockCodes: Set<string>;
  onAddToCandidate: (stock: StockCandidate) => void;
  onRemoveFromCandidate: (stock: StockCandidate) => void;
  onToggleChart: (code: string, listKey: StockListKey, selectionBatchId?: number) => void;
  onDeleteFromFilterList: (stock: StockCandidate, fromList: ReturnableListKey) => void | Promise<void>;
};

const initialStockImportDialogState: StockImportDialogState = {
  codeQuery: "",
  nameQuery: "",
  stocks: [],
  isLoading: true,
  error: null,
  importPendingCode: null,
  importError: null,
};

const listIcons = {
  initial: ListFilter,
  candidate: CheckCircle2,
  selected: Database,
  whitelist: ShieldCheck,
  blacklist: ShieldX,
} satisfies Record<StockListKey, typeof ListFilter>;

type StockSectionIcon = typeof ListFilter;

function StockSectionIconBox({
  icon: Icon,
  active = false,
}: {
  icon: StockSectionIcon;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
        active
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-border/55 bg-background/65 text-muted-foreground group-hover/disclosure-trigger:border-border group-hover/disclosure-trigger:bg-default/55 group-hover/disclosure-trigger:text-foreground",
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

function StockCountBadge({
  count,
  active = false,
}: {
  count: number | string;
  active?: boolean;
}) {
  return (
    <Badge
      variant="soft"
      color={active ? "accent" : "default"}
      size="sm"
      className="tabular-nums"
    >
      {count}
    </Badge>
  );
}

function StockDisclosureTitle({
  icon,
  title,
  description,
  count,
  active = false,
}: {
  icon: StockSectionIcon;
  title: string;
  description?: string;
  count: number | string;
  active?: boolean;
}) {
  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <Badge.Anchor>
          <StockSectionIconBox icon={icon} active={active} />
          <StockCountBadge count={count} active={active} />
        </Badge.Anchor>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-none">{title}</span>
          {description ? (
            <span className="mt-1 block truncate text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
      </span>
      <Disclosure.Indicator className="ml-0 size-4 shrink-0 text-muted-foreground" />
    </>
  );
}

type StockDashboardProps = {
  themeMode: ThemeMode;
  onThemeToggle: () => void;
  onLogout: () => void;
};

type StockDashboardState = {
  stockGroups: StockGroups;
  selectionBatches: SelectionBatchState[];
  chartSelection: ChartSelection | null;
  mobileListKey: StockListKey;
  desktopListKey: string;
  filterDialogList: ReturnableListKey | null;
  candidateDialogOpen: boolean;
  scanError: string | null;
  scanLoading: boolean;
  filterListsError: string | null;
  filterDeletePendingIds: number[];
  selectionBatchesLoading: boolean;
  selectionBatchesError: string | null;
  selectionBatchesPageNum: number;
  selectionBatchesTotal: number;
  selectionBatchDeletePendingIds: number[];
  selectionRecordDeletePendingIds: number[];
  candidateSavePending: boolean;
  strategyConfig: StrategyConfig;
  strategyConfigs: StrategyConfig[];
  strategyConfigLoading: boolean;
  strategyConfigError: string | null;
  strategySavePending: boolean;
  strategyDeletePendingId: number | null;
};

type StockDashboardAction =
  | { type: "set-chart-selection"; selection: ChartSelection | null }
  | { type: "set-mobile-list"; listKey: StockListKey }
  | { type: "set-desktop-list"; listKey: string }
  | { type: "open-filter-dialog"; listKey: ReturnableListKey }
  | { type: "close-filter-dialog" }
  | { type: "open-candidate-dialog" }
  | { type: "close-candidate-dialog" }
  | { type: "scan-start" }
  | { type: "scan-success"; stocks: StockCandidate[] }
  | { type: "scan-error"; error: string }
  | { type: "set-filter-error"; error: string | null }
  | { type: "sync-filter-lists"; whitelist: StockCandidate[]; blacklist: StockCandidate[] }
  | { type: "remove-filter-stock"; stock: StockCandidate; listKey: ReturnableListKey }
  | { type: "delete-filter-start"; filterId: number }
  | { type: "delete-filter-end"; filterId: number }
  | { type: "selection-batches-load-start"; pageNum: number }
  | { type: "selection-batches-load-error"; error: string }
  | { type: "sync-selection-batches"; batches: SelectionBatchState[]; pageNum: number; total: number }
  | { type: "sync-selection-records"; batchId: number; stocks: StockCandidate[]; total: number }
  | { type: "sync-selection-records-error"; batchId: number; error: string }
  | { type: "delete-selection-batch-start"; id: number }
  | { type: "delete-selection-batch-end"; id: number }
  | { type: "delete-selection-record-start"; id: number }
  | { type: "delete-selection-record-end"; id: number }
  | { type: "save-candidate-start" }
  | { type: "save-candidate-end" }
  | { type: "add-candidate-stock"; stock: StockCandidate }
  | { type: "add-candidate-stocks"; stocks: StockCandidate[] }
  | { type: "remove-candidate-stock"; stock: StockCandidate }
  | { type: "clear-candidate-stocks" }
  | { type: "strategy-config-load-start" }
  | { type: "strategy-config-load-error"; error: string }
  | { type: "sync-strategy-configs"; configs: StrategyConfig[] }
  | { type: "set-strategy-config"; config: StrategyConfig }
  | { type: "strategy-save-start" }
  | { type: "strategy-save-end" }
  | { type: "strategy-delete-start"; id: number }
  | { type: "strategy-delete-end" };

const initialStockDashboardState: StockDashboardState = {
  stockGroups: emptyStockGroups,
  selectionBatches: [],
  chartSelection: null,
  mobileListKey: "initial",
  desktopListKey: "initial",
  filterDialogList: null,
  candidateDialogOpen: false,
  scanError: null,
  scanLoading: false,
  filterListsError: null,
  filterDeletePendingIds: [],
  selectionBatchesLoading: true,
  selectionBatchesError: null,
  selectionBatchesPageNum: 1,
  selectionBatchesTotal: 0,
  selectionBatchDeletePendingIds: [],
  selectionRecordDeletePendingIds: [],
  candidateSavePending: false,
  strategyConfig: defaultStrategyConfig,
  strategyConfigs: [],
  strategyConfigLoading: true,
  strategyConfigError: null,
  strategySavePending: false,
  strategyDeletePendingId: null,
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
    ? findStockByChartSelection(state, chartSelection)
    : null;
  const candidateStockCodes = useMemo(
    () => new Set(state.stockGroups.candidate.map((stock) => getComparableStockCode(stock.code))),
    [state.stockGroups.candidate],
  );
  const visibleStockGroups = useMemo(
    () => ({
      ...state.stockGroups,
      initial: state.stockGroups.initial.filter((stock) => !candidateStockCodes.has(getComparableStockCode(stock.code))),
    }),
    [candidateStockCodes, state.stockGroups],
  );
  const syncStrategyConfigs = useCallback(async (signal?: AbortSignal) => {
    dispatch({ type: "strategy-config-load-start" });

    const configs = createStrategyConfigs(await listStrategyConfigs(signal));

    dispatch({ type: "sync-strategy-configs", configs });
    return configs;
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void syncStrategyConfigs(controller.signal)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "策略配置加载失败。";

        dispatch({ type: "strategy-config-load-error", error: message });
        toast.danger("策略配置加载失败", {
          description: message,
        });
      });

    return () => controller.abort();
  }, [syncStrategyConfigs]);

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

  const syncSelectionBatches = useCallback(async (pageNum = 1, signal?: AbortSignal) => {
    dispatch({ type: "selection-batches-load-start", pageNum });

    const batchPage = await listSelectionBatches({ page_num: pageNum, page_size: selectionHistoryPageSize }, signal);
    const batches = createSelectionBatchStates(batchPage.list);

    dispatch({
      type: "sync-selection-batches",
      batches,
      pageNum: batchPage.page_num,
      total: batchPage.total,
    });

    await Promise.all(batches.map(async (batch) => {
      try {
        const recordPage = await listSelectionRecords({
          batch_id: batch.id,
          page_num: 1,
          page_size: 200,
        }, signal);

        dispatch({
          type: "sync-selection-records",
          batchId: batch.id,
          stocks: createSelectionRecordCandidates(recordPage.list, batch.id),
          total: recordPage.total,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }

        dispatch({
          type: "sync-selection-records-error",
          batchId: batch.id,
          error: error instanceof Error ? error.message : "选股记录加载失败。",
        });
      }
    }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void syncFilterLists(controller.signal)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "名单加载失败。";

        dispatch({ type: "set-filter-error", error: message });
        toast.danger("名单加载失败", {
          description: message,
        });
      });

    return () => controller.abort();
  }, [syncFilterLists]);

  useEffect(() => {
    const controller = new AbortController();

    void syncSelectionBatches(1, controller.signal)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = error instanceof Error ? error.message : "历史选股加载失败。";

        dispatch({ type: "selection-batches-load-error", error: message });
        toast.danger("历史选股加载失败", {
          description: message,
        });
      });

    return () => controller.abort();
  }, [syncSelectionBatches]);

  function scrollBoardIntoViewOnMobile() {
    if (!window.matchMedia(mobileViewportQuery).matches) {
      return;
    }

    window.requestAnimationFrame(() => {
      stockBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleSelectedStock(code: string, listKey: StockListKey, selectionBatchId?: number) {
    if (
      state.chartSelection?.code === code
      && state.chartSelection.listKey === listKey
      && state.chartSelection.selectionBatchId === selectionBatchId
    ) {
      dispatch({ type: "set-chart-selection", selection: null });
      scrollBoardIntoViewOnMobile();
      return;
    }

    dispatch({ type: "set-chart-selection", selection: { code, listKey, selectionBatchId } });
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
        const message = syncError instanceof Error ? syncError.message : "名单同步失败。";

        dispatch({ type: "set-filter-error", error: message });
        toast.danger("名单同步失败", {
          description: message,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除名单失败。";

      dispatch({ type: "set-filter-error", error: message });
      toast.danger("删除名单失败", {
        description: message,
      });
    } finally {
      dispatch({ type: "delete-filter-end", filterId });
    }
  }

  const openFilterListDialog = useCallback((listKey: ReturnableListKey) => {
    dispatch({ type: "open-filter-dialog", listKey });
  }, []);

  const closeFilterListDialog = useCallback(() => {
    dispatch({ type: "close-filter-dialog" });
  }, []);

  const openCandidateDialog = useCallback(() => {
    dispatch({ type: "open-candidate-dialog" });
  }, []);

  const closeCandidateDialog = useCallback(() => {
    dispatch({ type: "close-candidate-dialog" });
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
      const message = syncError instanceof Error ? syncError.message : "名单同步失败。";

      dispatch({ type: "set-filter-error", error: message });
      toast.danger("名单同步失败", {
        description: message,
      });
    }
  }, [syncFilterLists]);

  function addStockToCandidate(stock: StockCandidate) {
    const codeKey = getComparableStockCode(stock.code);

    if (candidateStockCodes.has(codeKey)) {
      toast.info("已在候选", {
        description: `${stock.name} ${stock.code}`,
      });
      return;
    }

    dispatch({ type: "add-candidate-stock", stock });
    toast.success("已添加到候选", {
      description: `${stock.name} ${stock.code}`,
    });
  }

  function addStocksToCandidate(stocks: StockCandidate[]) {
    const nextStocks = stocks.filter((stock) => !candidateStockCodes.has(getComparableStockCode(stock.code)));

    if (nextStocks.length === 0) {
      toast.info("没有可添加的待选股票");
      return;
    }

    dispatch({ type: "add-candidate-stocks", stocks: nextStocks });
    toast.success("已批量添加到候选", {
      description: `已添加 ${nextStocks.length} 只股票`,
    });
  }

  function removeStockFromCandidate(stock: StockCandidate) {
    if (!candidateStockCodes.has(getComparableStockCode(stock.code))) {
      return;
    }

    dispatch({ type: "remove-candidate-stock", stock });
    toast.success("已从候选删除", {
      description: `${stock.name} ${stock.code}`,
    });
  }

  function clearCandidateStocks() {
    const candidates = state.stockGroups.candidate;

    if (candidates.length === 0) {
      toast.info("候选为空");
      return;
    }

    dispatch({ type: "clear-candidate-stocks" });
    toast.success("已清空候选", {
      description: `已移除 ${candidates.length} 只股票`,
    });
  }

  async function saveCandidateSelection() {
    const candidates = state.stockGroups.candidate;

    if (candidates.length === 0) {
      toast.info("候选为空", {
        description: "请先从待选列表添加股票。",
      });
      return;
    }

    dispatch({ type: "save-candidate-start" });

    try {
      await addSelection(candidates.map(createSelectionResultFromStock));
      dispatch({ type: "clear-candidate-stocks" });
      toast.success("候选已保存", {
        description: `已保存 ${candidates.length} 只股票到历史选股`,
      });

      try {
        await syncSelectionBatches(1);
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : "历史选股同步失败。";

        dispatch({ type: "selection-batches-load-error", error: message });
        toast.danger("历史选股同步失败", {
          description: message,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存候选失败。";

      dispatch({ type: "selection-batches-load-error", error: message });
      toast.danger("保存候选失败", {
        description: message,
      });
    } finally {
      dispatch({ type: "save-candidate-end" });
    }
  }

  async function removeStockFromHistory(stock: StockCandidate) {
    const recordId = stock.selectionRecordId;
    const codeKey = getComparableStockCode(stock.code);

    if (!recordId) {
      if (!state.stockGroups.selected.some((item) => getComparableStockCode(item.code) === codeKey)) {
        return;
      }

      toast.success("已从历史选股删除", {
        description: `${stock.name} ${stock.code}`,
      });
      return;
    }

    dispatch({ type: "delete-selection-record-start", id: recordId });

    try {
      await deleteSelectionRecords([recordId]);
      await syncSelectionBatches(state.selectionBatchesPageNum);
      toast.success("已从历史选股删除", {
        description: `${stock.name} ${stock.code}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除选股记录失败。";

      dispatch({ type: "selection-batches-load-error", error: message });
      toast.danger("删除选股记录失败", {
        description: message,
      });
    } finally {
      dispatch({ type: "delete-selection-record-end", id: recordId });
    }
  }

  async function removeSelectionBatch(id: number) {
    dispatch({ type: "delete-selection-batch-start", id });

    try {
      await deleteSelectionBatch(id);
      const nextPageNum = state.selectionBatches.length <= 1 && state.selectionBatchesPageNum > 1
        ? state.selectionBatchesPageNum - 1
        : state.selectionBatchesPageNum;

      await syncSelectionBatches(nextPageNum);
      toast.success("已删除历史选股");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除历史选股失败。";

      dispatch({ type: "selection-batches-load-error", error: message });
      toast.danger("删除历史选股失败", {
        description: message,
      });
    } finally {
      dispatch({ type: "delete-selection-batch-end", id });
    }
  }

  async function saveStrategyConfig(config: StrategyConfig) {
    dispatch({ type: "strategy-save-start" });

    try {
      const normalizedConfig = normalizeStrategyConfig(config);
      const savedConfig = normalizedConfig.id
        ? normalizedConfig
        : createStrategyConfigFromDto(await createStrategyConfig(toStrategyConfigDto(normalizedConfig)));

      if (normalizedConfig.id) {
        await updateStrategyConfig(normalizedConfig.id, toStrategyConfigDto(normalizedConfig));
      }

      dispatch({ type: "set-strategy-config", config: savedConfig });

      try {
        await syncStrategyConfigs();
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : "策略配置同步失败。";

        dispatch({ type: "strategy-config-load-error", error: message });
        toast.danger("策略配置同步失败", {
          description: message,
        });
      }

      toast.success("策略配置已保存", {
        description: savedConfig.name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "策略配置保存失败。";

      dispatch({ type: "strategy-config-load-error", error: message });
      toast.danger("策略配置保存失败", {
        description: message,
      });
      throw error;
    } finally {
      dispatch({ type: "strategy-save-end" });
    }
  }

  async function removeStrategyConfig(id: number) {
    dispatch({ type: "strategy-delete-start", id });

    try {
      await deleteStrategyConfig(id);

      try {
        await syncStrategyConfigs();
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : "策略配置同步失败。";

        dispatch({ type: "strategy-config-load-error", error: message });
        toast.danger("策略配置同步失败", {
          description: message,
        });
      }

      toast.success("策略配置已删除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "策略配置删除失败。";

      dispatch({ type: "strategy-config-load-error", error: message });
      toast.danger("策略配置删除失败", {
        description: message,
      });
      throw error;
    } finally {
      dispatch({ type: "strategy-delete-end" });
    }
  }

  async function startStrategyScan() {
    const configId = state.strategyConfig.id;

    if (!configId) {
      const message = "请先保存策略配置后再开始筛选。";

      dispatch({ type: "scan-error", error: message });
      toast.danger("策略扫描失败", {
        description: message,
      });
      return;
    }

    dispatch({ type: "scan-start" });

    try {
      const results = await scanStrategy({ config_id: configId });
      const stocks = createScanStockCandidates(results);

      dispatch({ type: "scan-success", stocks });
      if (!window.matchMedia(mobileViewportQuery).matches) {
        dispatch({ type: "open-candidate-dialog" });
      }
      toast.success("策略筛选完成", {
        description: `待选列表更新 ${stocks.length} 只股票`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "策略扫描失败。";

      dispatch({ type: "scan-error", error: message });
      toast.danger("策略扫描失败", {
        description: message,
      });
    }
  }

  return {
    stockBoardRef,
    state,
    visibleStockGroups,
    selectedStock,
    candidateStockCodes,
    openFilterListDialog,
    closeFilterListDialog,
    openCandidateDialog,
    closeCandidateDialog,
    importStockToList,
    addStockToCandidate,
    addStocksToCandidate,
    removeStockFromCandidate,
    clearCandidateStocks,
    saveCandidateSelection,
    removeStockFromHistory,
    removeSelectionBatch,
    toggleSelectedStock,
    deleteStockFromFilterList,
    changeSelectionHistoryPage: (pageNum: number) => void syncSelectionBatches(pageNum),
    reloadStrategyScan: startStrategyScan,
    startStrategyScan,
    setMobileListKey: (listKey: StockListKey) => dispatch({ type: "set-mobile-list", listKey }),
    setDesktopListKey: (listKey: string) => dispatch({ type: "set-desktop-list", listKey }),
    setStrategyConfig: (config: StrategyConfig) => dispatch({ type: "set-strategy-config", config }),
    saveStrategyConfig,
    removeStrategyConfig,
  };
}

function StockDashboardLayout({
  themeMode,
  onThemeToggle,
  onLogout,
  stockBoardRef,
  state,
  visibleStockGroups,
  selectedStock,
  candidateStockCodes,
  openFilterListDialog,
  closeFilterListDialog,
  openCandidateDialog,
  closeCandidateDialog,
  importStockToList,
  addStockToCandidate,
  addStocksToCandidate,
  removeStockFromCandidate,
  clearCandidateStocks,
  saveCandidateSelection,
  removeStockFromHistory,
  removeSelectionBatch,
  toggleSelectedStock,
  deleteStockFromFilterList,
  changeSelectionHistoryPage,
  reloadStrategyScan,
  startStrategyScan,
  setMobileListKey,
  setDesktopListKey,
  setStrategyConfig,
  saveStrategyConfig,
  removeStrategyConfig,
}: StockDashboardProps & ReturnType<typeof useStockDashboard>) {
  const isDesktopViewport = useIsDesktopViewport();
  const sharedStockListProps = {
    chartSelection: state.chartSelection,
    filterDeletePendingIds: state.filterDeletePendingIds,
    selectionRecordDeletePendingIds: state.selectionRecordDeletePendingIds,
    candidateStockCodes,
    onAddToCandidate: addStockToCandidate,
    onRemoveFromCandidate: removeStockFromCandidate,
    onToggleChart: toggleSelectedStock,
    onDeleteFromFilterList: deleteStockFromFilterList,
  };

  useEffect(() => {
    if (state.candidateDialogOpen && !isDesktopViewport) {
      closeCandidateDialog();
    }
  }, [closeCandidateDialog, isDesktopViewport, state.candidateDialogOpen]);

  return (
    <main className="min-h-dvh overflow-x-hidden text-foreground">
      <div className="flex flex-col md:hidden">
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
          <StrategyActionBar
            strategyConfig={state.strategyConfig}
            strategyConfigs={state.strategyConfigs}
            strategyConfigLoading={state.strategyConfigLoading}
            strategySavePending={state.strategySavePending}
            strategyDeletePendingId={state.strategyDeletePendingId}
            scanLoading={state.scanLoading}
            onStrategySelect={setStrategyConfig}
            onStrategySave={saveStrategyConfig}
            onStrategyDelete={removeStrategyConfig}
            onStrategyScan={startStrategyScan}
          />
          {state.strategyConfigError ? (
            <p
              className="mx-auto mt-3 max-w-[720px] rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
              role="alert"
            >
              策略配置失败：{state.strategyConfigError}
            </p>
          ) : null}
          {state.filterListsError ? (
            <p
              className="mx-auto mt-3 max-w-[720px] rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
              role="alert"
            >
              名单操作失败：{state.filterListsError}
            </p>
          ) : null}
          {state.selectionBatchesError ? (
            <p
              className="mx-auto mt-3 max-w-[720px] rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
              role="alert"
            >
              历史选股失败：{state.selectionBatchesError}
            </p>
          ) : null}

          <MobileStockTabs
            activeListKey={state.mobileListKey}
            stockGroups={visibleStockGroups}
            candidateSavePending={state.candidateSavePending}
            onOpenFilterList={openFilterListDialog}
            onActiveListChange={setMobileListKey}
            onSaveCandidateSelection={saveCandidateSelection}
            {...sharedStockListProps}
          />
          <MobileSelectionHistory
            selectionBatches={state.selectionBatches}
            selectionBatchesLoading={state.selectionBatchesLoading}
            selectionBatchesPageNum={state.selectionBatchesPageNum}
            selectionBatchesTotal={state.selectionBatchesTotal}
            selectionBatchDeletePendingIds={state.selectionBatchDeletePendingIds}
            chartSelection={state.chartSelection}
            selectionRecordDeletePendingIds={state.selectionRecordDeletePendingIds}
            onRemoveFromHistory={removeStockFromHistory}
            onDeleteSelectionBatch={removeSelectionBatch}
            onToggleChart={toggleSelectedStock}
            onPageChange={changeSelectionHistoryPage}
          />

          <MobileAccountActions
            themeMode={themeMode}
            onThemeToggle={onThemeToggle}
            onLogout={onLogout}
          />
        </div>
      </div>
      <div className="mx-auto hidden h-dvh w-full max-w-[1680px] overflow-hidden md:grid md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <DesktopStockBoard
          stock={selectedStock}
          isLoading={state.scanLoading}
          error={state.scanError}
          themeMode={themeMode}
          onThemeToggle={onThemeToggle}
          onLogout={onLogout}
          onReload={reloadStrategyScan}
        />
        <DesktopStockSidebar
          activeListKey={state.desktopListKey}
          filterListsError={state.filterListsError}
          selectionBatchesError={state.selectionBatchesError}
          stockGroups={visibleStockGroups}
          selectionBatches={state.selectionBatches}
          selectionBatchesLoading={state.selectionBatchesLoading}
          selectionBatchesPageNum={state.selectionBatchesPageNum}
          selectionBatchesTotal={state.selectionBatchesTotal}
          selectionBatchDeletePendingIds={state.selectionBatchDeletePendingIds}
          strategyConfig={state.strategyConfig}
          strategyConfigs={state.strategyConfigs}
          strategyConfigLoading={state.strategyConfigLoading}
          strategyConfigError={state.strategyConfigError}
          strategySavePending={state.strategySavePending}
          strategyDeletePendingId={state.strategyDeletePendingId}
          scanLoading={state.scanLoading}
          onActiveListChange={setDesktopListKey}
          onOpenFilterList={openFilterListDialog}
          onOpenCandidateDialog={openCandidateDialog}
          onRemoveFromHistory={removeStockFromHistory}
          onDeleteSelectionBatch={removeSelectionBatch}
          onSelectionHistoryPageChange={changeSelectionHistoryPage}
          onStrategySelect={setStrategyConfig}
          onStrategySave={saveStrategyConfig}
          onStrategyDelete={removeStrategyConfig}
          onStrategyScan={startStrategyScan}
          {...sharedStockListProps}
        />
      </div>
      {state.candidateDialogOpen && isDesktopViewport ? (
        <DesktopCandidateDialog
          stockGroups={visibleStockGroups}
          chartSelection={state.chartSelection}
          candidateStockCodes={candidateStockCodes}
          candidateSavePending={state.candidateSavePending}
          onClose={closeCandidateDialog}
          onAddToCandidate={addStockToCandidate}
          onAddStocksToCandidate={addStocksToCandidate}
          onRemoveFromCandidate={removeStockFromCandidate}
          onClearCandidateStocks={clearCandidateStocks}
          onSaveCandidateSelection={saveCandidateSelection}
          onToggleChart={toggleSelectedStock}
        />
      ) : null}
      {state.filterDialogList ? (
        <FilterListDialog
          targetList={state.filterDialogList}
          stocks={visibleStockGroups[state.filterDialogList]}
          stockGroups={visibleStockGroups}
          chartSelection={state.chartSelection}
          filterDeletePendingIds={state.filterDeletePendingIds}
          selectionRecordDeletePendingIds={state.selectionRecordDeletePendingIds}
          candidateStockCodes={candidateStockCodes}
          onClose={closeFilterListDialog}
          onImportStock={importStockToList}
          onAddToCandidate={addStockToCandidate}
          onRemoveFromCandidate={removeStockFromCandidate}
          onToggleChart={toggleSelectedStock}
          onDeleteFromFilterList={deleteStockFromFilterList}
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
    case "set-desktop-list":
      return { ...state, desktopListKey: action.listKey };
    case "open-filter-dialog":
      return { ...state, filterDialogList: action.listKey };
    case "close-filter-dialog":
      return { ...state, filterDialogList: null };
    case "open-candidate-dialog":
      return { ...state, candidateDialogOpen: true };
    case "close-candidate-dialog":
      return { ...state, candidateDialogOpen: false };
    case "scan-start":
      return { ...state, scanLoading: true, scanError: null };
    case "scan-success":
      return syncScanStocksState(state, action.stocks);
    case "scan-error":
      return { ...state, scanLoading: false, scanError: action.error };
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
    case "selection-batches-load-start":
      return {
        ...state,
        selectionBatchesLoading: true,
        selectionBatchesError: null,
        selectionBatchesPageNum: action.pageNum,
      };
    case "selection-batches-load-error":
      return { ...state, selectionBatchesLoading: false, selectionBatchesError: action.error };
    case "sync-selection-batches":
      return syncSelectionBatchesState(state, action.batches, action.pageNum, action.total);
    case "sync-selection-records":
      return syncSelectionRecordsState(state, action.batchId, action.stocks, action.total);
    case "sync-selection-records-error":
      return syncSelectionRecordsErrorState(state, action.batchId, action.error);
    case "delete-selection-batch-start":
      return {
        ...state,
        selectionBatchDeletePendingIds: state.selectionBatchDeletePendingIds.includes(action.id)
          ? state.selectionBatchDeletePendingIds
          : [...state.selectionBatchDeletePendingIds, action.id],
        selectionBatchesError: null,
      };
    case "delete-selection-batch-end":
      return {
        ...state,
        selectionBatchDeletePendingIds: state.selectionBatchDeletePendingIds.filter((pendingId) => pendingId !== action.id),
      };
    case "delete-selection-record-start":
      return {
        ...state,
        selectionRecordDeletePendingIds: state.selectionRecordDeletePendingIds.includes(action.id)
          ? state.selectionRecordDeletePendingIds
          : [...state.selectionRecordDeletePendingIds, action.id],
        selectionBatchesError: null,
      };
    case "delete-selection-record-end":
      return {
        ...state,
        selectionRecordDeletePendingIds: state.selectionRecordDeletePendingIds.filter((pendingId) => pendingId !== action.id),
      };
    case "save-candidate-start":
      return { ...state, candidateSavePending: true, selectionBatchesError: null };
    case "save-candidate-end":
      return { ...state, candidateSavePending: false };
    case "add-candidate-stock":
      return addCandidateStockState(state, action.stock);
    case "add-candidate-stocks":
      return addCandidateStocksState(state, action.stocks);
    case "remove-candidate-stock":
      return removeCandidateStockState(state, action.stock);
    case "clear-candidate-stocks":
      return clearCandidateStocksState(state);
    case "strategy-config-load-start":
      return { ...state, strategyConfigLoading: true, strategyConfigError: null };
    case "strategy-config-load-error":
      return { ...state, strategyConfigLoading: false, strategyConfigError: action.error };
    case "sync-strategy-configs":
      return syncStrategyConfigsState(state, action.configs);
    case "set-strategy-config":
      return { ...state, strategyConfig: action.config, strategyConfigError: null };
    case "strategy-save-start":
      return { ...state, strategySavePending: true, strategyConfigError: null };
    case "strategy-save-end":
      return { ...state, strategySavePending: false };
    case "strategy-delete-start":
      return { ...state, strategyDeletePendingId: action.id, strategyConfigError: null };
    case "strategy-delete-end":
      return { ...state, strategyDeletePendingId: null };
  }

  return state;
}

function syncStrategyConfigsState(
  state: StockDashboardState,
  configs: StrategyConfig[],
): StockDashboardState {
  const nextConfigs = configs.length > 0 ? configs : state.strategyConfigs;
  const currentId = state.strategyConfig.id;
  const strategyConfig = currentId
    ? nextConfigs.find((config) => config.id === currentId) ?? nextConfigs.find((config) => config.enabled) ?? nextConfigs[0] ?? state.strategyConfig
    : nextConfigs.find((config) => config.enabled) ?? nextConfigs[0] ?? state.strategyConfig;

  return {
    ...state,
    strategyConfigs: nextConfigs,
    strategyConfig,
    strategyConfigLoading: false,
    strategyConfigError: null,
  };
}

function syncSelectionBatchesState(
  state: StockDashboardState,
  batches: SelectionBatchState[],
  pageNum: number,
  total: number,
): StockDashboardState {
  const existingBatches = new Map(state.selectionBatches.map((batch) => [batch.id, batch]));
  const selectionBatches = batches.map((batch) => {
    const existingBatch = existingBatches.get(batch.id);

    return existingBatch
      ? {
          ...batch,
          stocks: existingBatch.stocks,
          isLoading: true,
          error: null,
        }
      : batch;
  });
  const stockGroups = {
    ...state.stockGroups,
    selected: createAggregatedSelectedStocks(selectionBatches),
  };
  const chartSelection = reconcileChartSelection({
    ...state,
    stockGroups,
    selectionBatches,
  });
  const activeSelectionBatchId = getSelectionBatchIdFromDisclosureValue(state.desktopListKey);
  const desktopListKey = activeSelectionBatchId && !selectionBatches.some((batch) => batch.id === activeSelectionBatchId)
    ? "initial"
    : state.desktopListKey;

  return {
    ...state,
    stockGroups,
    selectionBatches,
    chartSelection,
    desktopListKey,
    selectionBatchesLoading: false,
    selectionBatchesError: null,
    selectionBatchesPageNum: pageNum,
    selectionBatchesTotal: total,
  };
}

function syncSelectionRecordsState(
  state: StockDashboardState,
  batchId: number,
  stocks: StockCandidate[],
  total: number,
): StockDashboardState {
  const knownRecords = createKnownRecordsMap(state);
  const selectionBatches = state.selectionBatches.map((batch) => (
    batch.id === batchId
      ? {
          ...batch,
          stocks: stocks.map((stock) => hydrateStockCandidate(stock, knownRecords)),
          total,
          isLoading: false,
          error: null,
        }
      : batch
  ));
  const stockGroups = {
    ...state.stockGroups,
    selected: createAggregatedSelectedStocks(selectionBatches),
  };
  const chartSelection = reconcileChartSelection({
    ...state,
    stockGroups,
    selectionBatches,
  });

  return {
    ...state,
    stockGroups,
    selectionBatches,
    chartSelection,
    selectionBatchesError: null,
  };
}

function syncSelectionRecordsErrorState(
  state: StockDashboardState,
  batchId: number,
  error: string,
): StockDashboardState {
  const selectionBatches = state.selectionBatches.map((batch) => (
    batch.id === batchId
      ? {
          ...batch,
          isLoading: false,
          error,
        }
      : batch
  ));

  return {
    ...state,
    selectionBatches,
    selectionBatchesError: error,
  };
}

function syncScanStocksState(
  state: StockDashboardState,
  initial: StockCandidate[],
): StockDashboardState {
  const knownRecords = createKnownRecordsMap(state);

  for (const stock of initial) {
    knownRecords.set(getComparableStockCode(stock.code), stock.records);
  }

  const selectionBatches = state.selectionBatches.map((batch) => ({
    ...batch,
    stocks: batch.stocks.map((stock) => hydrateStockCandidate(stock, knownRecords)),
  }));
  const candidate = state.stockGroups.candidate.map((stock) => hydrateStockCandidate(stock, knownRecords));
  const selected = createAggregatedSelectedStocks(selectionBatches);
  const whitelist = state.stockGroups.whitelist.map((stock) => hydrateStockCandidate(stock, knownRecords));
  const blacklist = state.stockGroups.blacklist.map((stock) => hydrateStockCandidate(stock, knownRecords));
  const stockGroups = {
    ...state.stockGroups,
    initial,
    candidate,
    selected,
    whitelist,
    blacklist,
  };
  const visibleInitial = initial.filter((stock) => !candidate.some((item) => getComparableStockCode(item.code) === getComparableStockCode(stock.code)));
  const chartSelection = visibleInitial.length > 0
    ? { code: visibleInitial[0].code, listKey: "initial" as const }
    : candidate.length > 0
      ? { code: candidate[0].code, listKey: "candidate" as const }
    : null;
  const nextListKey = chartSelection?.listKey ?? "initial";

  return {
    ...state,
    stockGroups,
    selectionBatches,
    chartSelection,
    mobileListKey: nextListKey,
    desktopListKey: nextListKey,
    scanLoading: false,
    scanError: null,
  };
}

function StrategyActionBar({
  strategyConfig,
  strategyConfigs,
  strategyConfigLoading,
  strategySavePending,
  strategyDeletePendingId,
  scanLoading,
  className,
  strategyClassName,
  strategyButtonClassName,
  scanButtonClassName,
  onStrategySelect,
  onStrategySave,
  onStrategyDelete,
  onStrategyScan,
}: {
  strategyConfig: StrategyConfig;
  strategyConfigs: StrategyConfig[];
  strategyConfigLoading: boolean;
  strategySavePending: boolean;
  strategyDeletePendingId: number | null;
  scanLoading: boolean;
  className?: string;
  strategyClassName?: string;
  strategyButtonClassName?: string;
  scanButtonClassName?: string;
  onStrategySelect: (config: StrategyConfig) => void;
  onStrategySave: (config: StrategyConfig) => void | Promise<void>;
  onStrategyDelete: (id: number) => void | Promise<void>;
  onStrategyScan: () => void | Promise<void>;
}) {
  const canScan = Boolean(strategyConfig.id);

  return (
    <div className={cn("mt-4 flex flex-wrap items-center justify-center gap-2", className)}>
      <StrategySwitchButton
        config={strategyConfig}
        configs={strategyConfigs}
        configsLoading={strategyConfigLoading}
        savePending={strategySavePending}
        deletePendingId={strategyDeletePendingId}
        className={cn("mt-0", strategyClassName)}
        buttonClassName={strategyButtonClassName}
        onSelect={onStrategySelect}
        onSave={onStrategySave}
        onDelete={onStrategyDelete}
      />
      <Button
        type="button"
        className={cn("shrink-0", scanButtonClassName)}
        isDisabled={scanLoading || !canScan}
        onClick={() => void onStrategyScan()}
      >
        {scanLoading ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <Search data-icon="inline-start" />
        )}
        {scanLoading ? "筛选中" : "开始筛选"}
      </Button>
    </div>
  );
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

function findStockByChartSelection(
  state: StockDashboardState,
  selection: ChartSelection,
) {
  if (selection.listKey === "selected" && selection.selectionBatchId) {
    return state.selectionBatches
      .find((batch) => batch.id === selection.selectionBatchId)
      ?.stocks.find((stock) => stock.code === selection.code) ?? null;
  }

  return state.stockGroups[selection.listKey].find((stock) => stock.code === selection.code) ?? null;
}

function reconcileChartSelection(state: StockDashboardState) {
  const chartSelection = state.chartSelection;

  if (!chartSelection) {
    return null;
  }

  return findStockByChartSelection(state, chartSelection) ? chartSelection : null;
}

function createKnownRecordsMap(state: StockDashboardState) {
  const knownRecords = new Map<string, StockDailyRecord[]>();
  const knownStocks = [
    ...state.stockGroups.initial,
    ...state.stockGroups.candidate,
    ...state.stockGroups.whitelist,
    ...state.stockGroups.blacklist,
    ...state.selectionBatches.flatMap((batch) => batch.stocks),
  ];

  for (const stock of knownStocks) {
    knownRecords.set(getComparableStockCode(stock.code), stock.records);
  }

  return knownRecords;
}

function createAggregatedSelectedStocks(selectionBatches: SelectionBatchState[]) {
  return selectionBatches.flatMap((batch) => batch.stocks);
}

function getVisibleStockListOrder(order: StockListKey[], stockGroups: Pick<StockGroups, "candidate">) {
  return order.filter((key) => key !== "candidate" || stockGroups.candidate.length > 0);
}

function syncFilterListsState(
  state: StockDashboardState,
  whitelist: StockCandidate[],
  blacklist: StockCandidate[],
): StockDashboardState {
  const knownRecords = createKnownRecordsMap(state);

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

function addCandidateStockState(
  state: StockDashboardState,
  stock: StockCandidate,
): StockDashboardState {
  return addCandidateStocksState(state, [stock]);
}

function addCandidateStocksState(
  state: StockDashboardState,
  stocks: StockCandidate[],
): StockDashboardState {
  const candidateCodeKeys = new Set(state.stockGroups.candidate.map((stock) => getComparableStockCode(stock.code)));
  const nextCandidateStocks: StockCandidate[] = [];

  for (const stock of stocks) {
    const codeKey = getComparableStockCode(stock.code);

    if (candidateCodeKeys.has(codeKey)) {
      continue;
    }

    candidateCodeKeys.add(codeKey);
    nextCandidateStocks.push(createCandidateStock(stock));
  }

  if (nextCandidateStocks.length === 0) {
    return state;
  }

  return {
    ...state,
    stockGroups: {
      ...state.stockGroups,
      candidate: [
        ...state.stockGroups.candidate,
        ...nextCandidateStocks,
      ],
    },
  };
}

function createCandidateStock(stock: StockCandidate): StockCandidate {
  return {
    code: stock.code,
    name: stock.name,
    records: stock.records,
    list: "candidate",
    strategyResult: stock.strategyResult,
  };
}

function removeCandidateStockState(
  state: StockDashboardState,
  stock: StockCandidate,
): StockDashboardState {
  const candidate = state.stockGroups.candidate.filter((item) => getComparableStockCode(item.code) !== getComparableStockCode(stock.code));
  const chartSelection = state.chartSelection?.listKey === "candidate" && state.chartSelection.code === stock.code
    ? state.stockGroups.initial.some((item) => item.code === stock.code)
      ? { code: stock.code, listKey: "initial" as const }
      : null
    : state.chartSelection;

  return {
    ...state,
    stockGroups: {
      ...state.stockGroups,
      candidate,
    },
    chartSelection,
  };
}

function clearCandidateStocksState(state: StockDashboardState): StockDashboardState {
  const chartSelection = state.chartSelection?.listKey === "candidate"
    ? null
    : state.chartSelection;

  return {
    ...state,
    stockGroups: {
      ...state.stockGroups,
      candidate: [],
    },
    chartSelection,
    mobileListKey: state.mobileListKey === "candidate" ? "initial" : state.mobileListKey,
    desktopListKey: state.desktopListKey === "candidate" ? "initial" : state.desktopListKey,
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
  chartMode: ChartMode;
  detailsOpen: boolean;
};

type ActiveStockBoardAction =
  | { type: "set-chart-mode"; chartMode: ChartMode }
  | { type: "toggle-details" };

const initialActiveStockBoardState: ActiveStockBoardState = {
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

function useIsDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(() => !window.matchMedia(mobileViewportQuery).matches);

  useEffect(() => {
    const media = window.matchMedia(mobileViewportQuery);
    const handleChange = () => setIsDesktop(!media.matches);

    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}

function useStockBoardModel(
  stock: StockCandidate,
  themeMode: ThemeMode,
) {
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
    () => createChartView(sourceRecords),
    [sourceRecords],
  );
  const records = chartView.records;
  const latest = records.at(-1);
  const previous = records.at(-2);
  const change = latest && previous ? latest.close - previous.close : 0;
  const changePct = previous ? (change / previous.close) * 100 : 0;
  const chartColor = change >= 0
    ? themeMode === "light" ? "#b94545" : "#ef4444"
    : themeMode === "light" ? "#2f7f59" : "#22c55e";
  const momentum: "up" | "down" | "flat" = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const selectedRangeSecs = getDailyKWindowSecs(sourceRecords);
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

  return {
    chartStock,
    sourceRecords,
    chartView,
    records,
    latest,
    previous,
    change,
    changePct,
    chartColor,
    momentum,
    selectedRangeSecs,
    positive,
    trend,
    strength,
  };
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
    chartMode,
    detailsOpen,
  } = boardState;
  const {
    chartStock,
    sourceRecords,
    chartView,
    latest,
    change,
    changePct,
    chartColor,
    momentum,
    selectedRangeSecs,
    positive,
  } = useStockBoardModel(stock, themeMode);
  const isCompactViewport = useIsCompactViewport();
  const chartPadding = isCompactViewport ? compactHeroChartPadding : heroChartPadding;

  return (
    <>
      <section className="relative">
      <div
        className="relative min-h-[560px] overflow-hidden sm:min-h-[620px] lg:min-h-[700px]"
        style={{ background: "var(--chart-hero-background)" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-48 bg-gradient-to-b from-background/75 to-transparent" />

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
              <Chip variant="soft" className="bg-background/35 backdrop-blur">
                {stockListMeta[stock.list].label}
              </Chip>
              <Chip
                variant="soft"
                className={cn("bg-background/55 backdrop-blur", !latest && "text-destructive")}
              >
                {latest ? "行情正常" : "无数据"}
              </Chip>
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
            <div className="mt-3 max-w-md">
              <StrategyBasicInfo strategyResult={stock.strategyResult} />
            </div>
          </div>

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
                      : "hover:bg-default hover:text-foreground",
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
                className="hidden bg-background/45 backdrop-blur-xl md:inline-flex"
                aria-label={themeMode === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
                onClick={onThemeToggle}
              >
                {themeMode === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
                {themeMode === "dark" ? "亮色" : "暗色"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="hidden bg-background/45 backdrop-blur-xl md:inline-flex"
              aria-label="退出登录"
              onClick={onLogout}
            >
              <LogOut data-icon="inline-start" />
              退出登录
            </Button>
            <Button
              type="button"
              variant="outline"
              className="bg-background/45 backdrop-blur-xl max-[420px]:w-8 max-[420px]:px-0"
              aria-label={isLoading ? "加载中" : "重载"}
              isDisabled={isLoading}
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
            chartMode === "line" ? (
              <Liveline
                key="line"
                data={[]}
                value={0}
                series={createPriceMA5Series(chartView, latest, chartColor, themeMode)}
                theme={themeMode}
                color={chartColor}
                lineWidth={chartLineWidth}
                window={selectedRangeSecs}
                grid
                scrub
                pulse
                loading={isLoading}
                referenceLine={
                  latest?.last
                    ? {
                        value: latest.last,
                        label: "昨收",
                      }
                    : undefined
                }
                formatValue={(value) => value.toFixed(2)}
                formatTime={(time) => formatChartAxisDate(time, chartView.axisDateLabels)}
                padding={chartPadding}
                className="size-full"
              />
            ) : (
              <Liveline
                key="candle"
                data={latest ? chartView.lineData : []}
                value={latest?.close ?? 0}
                mode="candle"
                candles={chartView.candles}
                candleWidth={chartView.candleWidth}
                theme={themeMode}
                color={chartColor}
                lineWidth={chartLineWidth}
                window={selectedRangeSecs}
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
                formatTime={(time) => formatChartAxisDate(time, chartView.axisDateLabels)}
                padding={chartPadding}
                className="size-full"
              />
            )
          ) : (
            <EmptyChart error={error ?? chartStock.records[0]?.error} />
          )}
        </div>

      </div>
      </section>
    </>
  );
}

function activeStockBoardReducer(
  state: ActiveStockBoardState,
  action: ActiveStockBoardAction,
): ActiveStockBoardState {
  switch (action.type) {
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
                className="hidden bg-background/45 backdrop-blur-xl md:inline-flex"
                aria-label={themeMode === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
                onClick={onThemeToggle}
              >
                {themeMode === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
                {themeMode === "dark" ? "亮色" : "暗色"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="hidden bg-background/45 backdrop-blur-xl md:inline-flex"
              aria-label="退出登录"
              onClick={onLogout}
            >
              <LogOut data-icon="inline-start" />
              退出登录
            </Button>
            <Button
              type="button"
              variant="outline"
              className="hidden bg-background/45 backdrop-blur-xl md:inline-flex"
              aria-label="重载"
              isDisabled={isLoading}
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
            lineWidth={chartLineWidth}
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

function JudgementMetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "up" | "down";
}) {
  return (
    <Card
      className={cn(
        "gap-2 rounded-lg bg-card/72 p-4 shadow-sm backdrop-blur-xl",
        tone === "up" && "border-stock-up/25 bg-stock-up/5",
        tone === "down" && "border-stock-down/25 bg-stock-down/5",
      )}
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={cn(
          "min-w-0 truncate text-2xl font-semibold tabular-nums",
          tone === "up" && "text-stock-up",
          tone === "down" && "text-stock-down",
        )}
      >
        {value}
      </div>
      <div className="min-w-0 truncate text-xs text-muted-foreground">{detail}</div>
    </Card>
  );
}

function DesktopStockSidebar({
  activeListKey,
  filterListsError,
  selectionBatchesError,
  stockGroups,
  selectionBatches,
  selectionBatchesLoading,
  selectionBatchesPageNum,
  selectionBatchesTotal,
  selectionBatchDeletePendingIds,
  strategyConfig,
  strategyConfigs,
  strategyConfigLoading,
  strategyConfigError,
  strategySavePending,
  strategyDeletePendingId,
  scanLoading,
  onActiveListChange,
  onOpenFilterList,
  onOpenCandidateDialog,
  onRemoveFromHistory,
  onDeleteSelectionBatch,
  onSelectionHistoryPageChange,
  onStrategySelect,
  onStrategySave,
  onStrategyDelete,
  onStrategyScan,
  ...stockListProps
}: {
  activeListKey: string;
  filterListsError: string | null;
  selectionBatchesError: string | null;
  stockGroups: StockGroups;
  selectionBatches: SelectionBatchState[];
  selectionBatchesLoading: boolean;
  selectionBatchesPageNum: number;
  selectionBatchesTotal: number;
  selectionBatchDeletePendingIds: number[];
  strategyConfig: StrategyConfig;
  strategyConfigs: StrategyConfig[];
  strategyConfigLoading: boolean;
  strategyConfigError: string | null;
  strategySavePending: boolean;
  strategyDeletePendingId: number | null;
  scanLoading: boolean;
  onActiveListChange: (key: string) => void;
  onOpenFilterList: (listKey: ReturnableListKey) => void;
  onOpenCandidateDialog: () => void;
  onRemoveFromHistory: (stock: StockCandidate) => void | Promise<void>;
  onDeleteSelectionBatch: (id: number) => void | Promise<void>;
  onSelectionHistoryPageChange: (pageNum: number) => void;
  onStrategySelect: (config: StrategyConfig) => void;
  onStrategySave: (config: StrategyConfig) => void | Promise<void>;
  onStrategyDelete: (id: number) => void | Promise<void>;
  onStrategyScan: () => void | Promise<void>;
} & StockListSharedProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 bg-transparent p-4">
      <Card className="shrink-0 bg-card/72 p-3 shadow-sm backdrop-blur-xl">
        <CardContent className="flex flex-col gap-3 p-0">
          <StrategyActionBar
            strategyConfig={strategyConfig}
            strategyConfigs={strategyConfigs}
            strategyConfigLoading={strategyConfigLoading}
            strategySavePending={strategySavePending}
            strategyDeletePendingId={strategyDeletePendingId}
            scanLoading={scanLoading}
            className="mt-0 flex-col items-stretch justify-start"
            strategyClassName="w-full"
            strategyButtonClassName="h-10 w-full justify-start bg-background/45 px-3 shadow-sm"
            scanButtonClassName="h-10 w-full justify-start"
            onStrategySelect={onStrategySelect}
            onStrategySave={onStrategySave}
            onStrategyDelete={onStrategyDelete}
            onStrategyScan={onStrategyScan}
          />
          {strategyConfigError ? (
            <p
              className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive text-pretty"
              role="alert"
            >
              策略配置失败：{strategyConfigError}
            </p>
          ) : null}
          {filterListsError ? (
            <p
              className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive text-pretty"
              role="alert"
            >
              名单操作失败：{filterListsError}
            </p>
          ) : null}
          {selectionBatchesError ? (
            <p
              className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive text-pretty"
              role="alert"
            >
              历史选股失败：{selectionBatchesError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full justify-start bg-background/40 px-3 shadow-sm"
        aria-label="打开待选管理"
        onClick={onOpenCandidateDialog}
      >
        <ListFilter data-icon="inline-start" />
        <span className="min-w-0 flex-1 truncate text-left">待选管理</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          待选 {stockGroups.initial.length} / 候选 {stockGroups.candidate.length}
        </span>
      </Button>

      <DesktopStockDisclosureGroup
        activeListKey={activeListKey}
        selectionBatches={selectionBatches}
        selectionBatchesLoading={selectionBatchesLoading}
        selectionBatchesPageNum={selectionBatchesPageNum}
        selectionBatchesTotal={selectionBatchesTotal}
        selectionBatchDeletePendingIds={selectionBatchDeletePendingIds}
        onActiveListChange={onActiveListChange}
        onRemoveFromHistory={onRemoveFromHistory}
        onDeleteSelectionBatch={onDeleteSelectionBatch}
        onSelectionHistoryPageChange={onSelectionHistoryPageChange}
        {...stockListProps}
      />

      <Card className="mt-auto shrink-0 bg-card/72 p-3 shadow-sm backdrop-blur-xl">
        <CardContent className="p-0">
          <FilterListButtonGroup
            stockGroups={stockGroups}
            className="grid-cols-1"
            buttonClassName="h-11 w-full bg-background/35 px-3"
            onOpenFilterList={onOpenFilterList}
          />
        </CardContent>
      </Card>
    </aside>
  );
}

function DesktopStockDisclosureGroup({
  activeListKey,
  selectionBatches,
  selectionBatchesLoading,
  selectionBatchesPageNum,
  selectionBatchesTotal,
  selectionBatchDeletePendingIds,
  chartSelection,
  selectionRecordDeletePendingIds,
  onActiveListChange,
  onRemoveFromHistory,
  onDeleteSelectionBatch,
  onSelectionHistoryPageChange,
  onToggleChart,
}: {
  activeListKey: string;
  selectionBatches: SelectionBatchState[];
  selectionBatchesLoading: boolean;
  selectionBatchesPageNum: number;
  selectionBatchesTotal: number;
  selectionBatchDeletePendingIds: number[];
  onActiveListChange: (key: string) => void;
  onRemoveFromHistory: (stock: StockCandidate) => void | Promise<void>;
  onDeleteSelectionBatch: (id: number) => void | Promise<void>;
  onSelectionHistoryPageChange: (pageNum: number) => void;
} & Pick<
  StockListSharedProps,
  "chartSelection" | "selectionRecordDeletePendingIds" | "onToggleChart"
>) {
  const pageCount = getPageCount(selectionBatchesTotal, selectionHistoryPageSize);

  return (
    <section className="min-h-0 overflow-y-auto">
      <DesktopSelectionHistoryHeader
        loading={selectionBatchesLoading}
        pageNum={selectionBatchesPageNum}
        pageCount={pageCount}
        total={selectionBatchesTotal}
        onPageChange={onSelectionHistoryPageChange}
      />
      <DisclosureGroup
        className="mt-3 flex min-h-0 flex-col gap-2"
        expandedKeys={new Set([activeListKey])}
        onExpandedChange={(keys) => {
          const nextListKey = Array.from(keys).at(-1);

          if (nextListKey) {
            onActiveListChange(String(nextListKey));
          }
        }}
        aria-label="股票列表"
      >
        {selectionBatches.map((batch) => (
          <SelectionBatchDisclosureItem
            key={batch.id}
            batch={batch}
            expanded={getSelectionBatchDisclosureValue(batch.id) === activeListKey}
            chartSelection={chartSelection}
            selectionRecordDeletePendingIds={selectionRecordDeletePendingIds}
            deletePending={selectionBatchDeletePendingIds.includes(batch.id)}
            onDeleteSelectionBatch={onDeleteSelectionBatch}
            onRemoveFromHistory={onRemoveFromHistory}
            onToggleChart={onToggleChart}
          />
        ))}
        {selectionBatches.length === 0 && selectionBatchesLoading ? (
          <DesktopSelectionBatchesLoadingState />
        ) : selectionBatches.length === 0 ? (
          <DesktopSelectionHistoryEmptyState />
        ) : null}
      </DisclosureGroup>
    </section>
  );
}

function SelectionBatchDisclosureItem({
  batch,
  expanded,
  chartSelection,
  selectionRecordDeletePendingIds,
  deletePending,
  onDeleteSelectionBatch,
  onRemoveFromHistory,
  onToggleChart,
}: {
  batch: SelectionBatchState;
  expanded: boolean;
  deletePending: boolean;
  onDeleteSelectionBatch: (id: number) => void | Promise<void>;
  onRemoveFromHistory: (stock: StockCandidate) => void | Promise<void>;
} & Pick<StockListSharedProps, "chartSelection" | "selectionRecordDeletePendingIds" | "onToggleChart">) {
  const value = getSelectionBatchDisclosureValue(batch.id);

  return (
    <Disclosure
      id={value}
      className={cn(
        "rounded-lg border border-border/60 bg-surface/70 px-3 shadow-sm",
        expanded && "bg-surface",
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        <Disclosure.Heading className="flex min-w-0 flex-1">
          <Disclosure.Trigger className="group/disclosure-trigger flex min-w-0 flex-1 items-center gap-3 rounded-none border-0 px-0 py-3 text-left hover:no-underline active:scale-[0.99]">
            <StockDisclosureTitle
              icon={CheckCircle2}
              title={batch.name}
              description={`历史选股${batch.createdAt ? ` · ${formatDisplayDateTime(batch.createdAt)}` : ""}`}
              count={batch.isLoading ? "..." : batch.stocks.length || batch.total}
              active
            />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Button
          type="button"
          variant="ghost"
          size="sm" isIconOnly
          className="size-8 shrink-0 text-muted-foreground hover:bg-transparent hover:text-destructive"
          aria-label={`删除历史选股：${batch.name}`}
          isDisabled={deletePending}
          onClick={() => void onDeleteSelectionBatch(batch.id)}
        >
          {deletePending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
        </Button>
      </div>

      <Disclosure.Content className="overflow-hidden">
        <div className="pb-3 pl-10">
          {batch.error ? (
            <div className="flex min-h-20 flex-col justify-center gap-1 px-1 text-left">
              <div className="text-sm font-medium text-destructive">记录加载失败</div>
              <div className="text-xs text-muted-foreground text-pretty">{batch.error}</div>
            </div>
          ) : batch.isLoading ? (
            <div className="flex min-h-20 items-center gap-2 px-1 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              加载记录...
            </div>
          ) : batch.stocks.length > 0 ? (
            <ScrollShadow orientation="vertical" className="max-h-64 pr-2">
              <div className="flex w-full flex-col gap-2">
                {batch.stocks.map((stock) => (
                  <StockListButton
                    key={stock.selectionRecordId ?? stock.code}
                    stock={stock}
                    active={
                      chartSelection?.listKey === "selected"
                      && chartSelection.selectionBatchId === batch.id
                      && chartSelection.code === stock.code
                    }
                    onClick={() => onToggleChart(stock.code, "selected", batch.id)}
                    action={getStockListAction({
                      stock,
                      listKey: "selected",
                      candidateStockCodes: new Set(),
                      filterDeletePendingIds: [],
                      selectionRecordDeletePendingIds,
                      onAddToCandidate: () => undefined,
                      onRemoveFromCandidate: () => undefined,
                      onRemoveFromHistory,
                      onDeleteFromFilterList: () => undefined,
                    })}
                  />
                ))}
              </div>
            </ScrollShadow>
          ) : (
            <DesktopStockListEmptyState listKey="selected" />
          )}
        </div>
      </Disclosure.Content>
    </Disclosure>
  );
}

function DesktopSelectionBatchesLoadingState() {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-surface/70 p-3 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      加载历史选股...
    </div>
  );
}

function DesktopSelectionHistoryHeader({
  loading,
  pageNum,
  pageCount,
  total,
  onPageChange,
}: {
  loading: boolean;
  pageNum: number;
  pageCount: number;
  total: number;
  onPageChange: (pageNum: number) => void;
}) {
  return (
    <div className="flex shrink-0 py-1">
      <div className="flex min-w-0 w-full items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Badge.Anchor>
            <StockSectionIconBox icon={Database} active />
            <StockCountBadge count={loading ? "..." : total} active />
          </Badge.Anchor>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium leading-none">历史选股</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <SelectionHistoryPagination
            loading={loading}
            pageNum={pageNum}
            pageCount={pageCount}
            total={total}
            onPageChange={onPageChange}
          />
        </div>
      </div>
    </div>
  );
}

function DesktopSelectionHistoryEmptyState() {
  return (
    <div className="flex shrink-0 flex-col gap-1 rounded-lg border border-border/60 bg-surface/70 p-3 text-sm">
      <div className="font-medium">暂无历史选股</div>
      <div className="text-xs text-muted-foreground">保存候选后会生成历史选股条目</div>
    </div>
  );
}

function SelectionHistoryPagination({
  loading,
  pageNum,
  pageCount,
  total,
  className,
  onPageChange,
}: {
  loading: boolean;
  pageNum: number;
  pageCount: number;
  total: number;
  className?: string;
  onPageChange: (pageNum: number) => void;
}) {
  const canGoPrevious = pageNum > 1 && !loading;
  const canGoNext = pageNum < pageCount && !loading;
  const disabledClassName = "pointer-events-none opacity-50";

  function handlePageClick(nextPageNum: number, enabled: boolean) {
    if (enabled) {
      onPageChange(nextPageNum);
    }
  }

  if (total === 0) {
    return null;
  }

  return (
    <Pagination className={cn("mx-0 w-auto justify-end", className)}>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Link
            isDisabled={!canGoPrevious}
            aria-label="上一页"
            className={cn(!canGoPrevious && disabledClassName)}
            onPress={() => handlePageClick(pageNum - 1, canGoPrevious)}
          >
            <ChevronLeft data-icon="inline-start" />
          </Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link
            isDisabled={!canGoNext}
            aria-label="下一页"
            className={cn(!canGoNext && disabledClassName)}
            onPress={() => handlePageClick(pageNum + 1, canGoNext)}
          >
            <ChevronRight data-icon="inline-start" />
          </Pagination.Link>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

function FilterListButtonGroup({
  stockGroups,
  className,
  buttonClassName,
  onOpenFilterList,
}: {
  stockGroups: Pick<StockGroups, ReturnableListKey>;
  className?: string;
  buttonClassName?: string;
  onOpenFilterList: (listKey: ReturnableListKey) => void;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {filterListButtonOrder.map((listKey) => {
        const Icon = listIcons[listKey];
        const meta = stockListMeta[listKey];

        return (
          <Button
            key={listKey}
            type="button"
            variant="outline"
            className={cn("min-w-0 justify-start", buttonClassName)}
            aria-label={`打开${meta.label}`}
            onClick={() => onOpenFilterList(listKey)}
          >
            <Icon data-icon="inline-start" className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{meta.label}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {stockGroups[listKey].length}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

function DesktopStockListEmptyState({ listKey }: { listKey: StockListKey }) {
  const message = listKey === "initial"
    ? "调整策略后重载扫描"
    : listKey === "candidate"
      ? "从待选列表添加股票"
    : listKey === "selected"
      ? "保存候选后生成历史选股"
      : "打开名单浮窗添加股票";

  return (
    <div className="flex h-full min-h-20 flex-col justify-center gap-1 px-1 text-left">
      <div className="text-sm font-medium">暂无股票</div>
      <div className="text-xs text-muted-foreground text-pretty">{message}</div>
    </div>
  );
}

function DesktopStockBoard({
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
      <DesktopStockBoardLoading
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
    <DesktopActiveStockBoard
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

function DesktopPageHeader({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 pt-4">
      <BrandLockup />
      <Button
        type="button"
        variant="outline"
        className="bg-background/55"
        aria-label="退出登录"
        onClick={onLogout}
      >
        <LogOut data-icon="inline-start" />
        退出登录
      </Button>
    </div>
  );
}

function DesktopActiveStockBoard({
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
    chartMode,
  } = boardState;
  const {
    chartStock,
    sourceRecords,
    chartView,
    latest,
    change,
    changePct,
    chartColor,
    momentum,
    selectedRangeSecs,
    positive,
    trend,
    strength,
  } = useStockBoardModel(stock, themeMode);

  return (
    <section className="relative min-h-0 min-w-0 overflow-y-auto px-5 pb-4 lg:px-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[1120px]"
        style={{ background: "var(--desktop-board-glow-background)" }}
      />
      <div className="relative z-10 flex w-full flex-col">
        <DesktopPageHeader onLogout={onLogout} />
        <DesktopStockChartPanel
          stock={chartStock}
          latest={latest}
          change={change}
          changePct={changePct}
          positive={positive}
          chartView={chartView}
          chartMode={chartMode}
          chartColor={chartColor}
          selectedRangeSecs={selectedRangeSecs}
          momentum={momentum}
          isLoading={isLoading}
          error={error}
          themeMode={themeMode}
          onThemeToggle={onThemeToggle}
          onReload={onReload}
          onChartModeChange={(nextChartMode) => dispatchBoard({ type: "set-chart-mode", chartMode: nextChartMode })}
        />
        <DesktopStockInfoPanel
          sourceRecords={sourceRecords}
          latest={latest}
          change={change}
          changePct={changePct}
          positive={positive}
          trend={trend}
          strength={strength}
        />
      </div>
    </section>
  );
}

function DesktopStockChartPanel({
  stock,
  latest,
  change,
  changePct,
  positive,
  chartView,
  chartMode,
  chartColor,
  selectedRangeSecs,
  momentum,
  isLoading,
  error,
  themeMode,
  onThemeToggle,
  onReload,
  onChartModeChange,
}: {
  stock: StockCandidate;
  latest: StockDailyRecord | undefined;
  change: number;
  changePct: number;
  positive: boolean;
  chartView: ReturnType<typeof createChartView>;
  chartMode: ChartMode;
  chartColor: string;
  selectedRangeSecs: number;
  momentum: "up" | "down" | "flat";
  isLoading: boolean;
  error: string | null;
  themeMode: ThemeMode;
  onThemeToggle: () => void;
  onReload: () => void;
  onChartModeChange: (chartMode: ChartMode) => void;
}) {
  return (
    <section
      className="relative pt-4"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-background/75 to-transparent" />

      <div className="relative z-20 grid gap-0 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-stretch xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex min-h-[clamp(320px,44vh,440px)] min-w-0 flex-col justify-between py-1">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="min-w-0 truncate text-3xl font-semibold leading-tight tracking-normal text-foreground">
                {stock.name}
              </h1>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{stock.code}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip variant="soft" className="bg-background/45 backdrop-blur">
                {stockListMeta[stock.list].label}
              </Chip>
              <Chip variant="soft" className={cn("bg-background/55 backdrop-blur", !latest && "text-destructive")}>
                {latest ? "行情正常" : "无数据"}
              </Chip>
              {latest ? (
                <span className="text-xs text-muted-foreground tabular-nums">{latest.date}</span>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span
                className={cn(
                  "text-5xl font-semibold leading-none tabular-nums",
                  latest ? positive ? "text-stock-up" : "text-stock-down" : "text-muted-foreground",
                )}
              >
                <AnimatedDigits
                  key={`desktop-side-price-${stock.code}:${latest?.date ?? ""}:${latest?.close ?? ""}`}
                  value={latest ? latest.close.toFixed(2) : "--"}
                />
              </span>
              <span
                className={cn(
                  "pb-1 text-base font-semibold tabular-nums",
                  latest ? positive ? "text-stock-up" : "text-stock-down" : "text-muted-foreground",
                )}
              >
                <AnimatedDigits
                  key={`desktop-side-change-${stock.code}:${latest?.date ?? ""}:${change}:${changePct}`}
                  value={latest ? `${formatSigned(change)}  ${formatSigned(changePct)}%` : "--"}
                />
              </span>
            </div>
            <div className="mt-5">
              <StrategyBasicInfo strategyResult={stock.strategyResult} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {isThemeToggleVisible(themeMode) ? (
              <Button
                type="button"
                variant="outline"
                className="bg-background/55"
                aria-label={themeMode === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
                onClick={onThemeToggle}
              >
                {themeMode === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
                {themeMode === "dark" ? "亮色" : "暗色"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex rounded-lg bg-background/45 p-1">
                {chartModeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      "h-8 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors",
                      option.id === chartMode
                        ? "bg-secondary text-secondary-foreground"
                        : "hover:bg-default hover:text-foreground",
                    )}
                    aria-pressed={option.id === chartMode}
                    onClick={() => onChartModeChange(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="bg-background/55"
                aria-label={isLoading ? "加载中" : "重载"}
                isDisabled={isLoading}
                onClick={onReload}
              >
                <RefreshCcw data-icon="inline-start" className={cn(isLoading && "animate-spin")} />
                {isLoading ? "加载中" : "重载"}
              </Button>
            </div>
          </div>

          <div className="relative h-[clamp(320px,44vh,440px)] w-full overflow-hidden">
            {latest || isLoading ? (
              chartMode === "line" ? (
                <Liveline
                  key="line"
                  data={[]}
                  value={0}
                  series={createPriceMA5Series(chartView, latest, chartColor, themeMode)}
                  theme={themeMode}
                  color={chartColor}
                  lineWidth={chartLineWidth}
                  window={selectedRangeSecs}
                  grid
                  scrub
                  pulse
                  loading={isLoading}
                  referenceLine={
                    latest?.last
                      ? {
                          value: latest.last,
                          label: "昨收",
                        }
                      : undefined
                  }
                  formatValue={(value) => value.toFixed(2)}
                  formatTime={(time) => formatChartAxisDate(time, chartView.axisDateLabels)}
                  padding={desktopChartPadding}
                  className="size-full"
                />
              ) : (
                <Liveline
                  key="candle"
                  data={latest ? chartView.lineData : []}
                  value={latest?.close ?? 0}
                  mode="candle"
                  candles={chartView.candles}
                  candleWidth={chartView.candleWidth}
                  theme={themeMode}
                  color={chartColor}
                  lineWidth={chartLineWidth}
                  window={selectedRangeSecs}
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
                  formatTime={(time) => formatChartAxisDate(time, chartView.axisDateLabels)}
                  padding={desktopChartPadding}
                  className="size-full"
                />
              )
            ) : (
              <EmptyChart error={error ?? stock.records[0]?.error} className="min-h-0" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DesktopStockInfoPanel({
  sourceRecords,
  latest,
  change,
  changePct,
  positive,
  trend,
  strength,
}: {
  sourceRecords: StockDailyRecord[];
  latest: StockDailyRecord | undefined;
  change: number;
  changePct: number;
  positive: boolean;
  trend: string;
  strength: string;
}) {
  const visibleRecords = sourceRecords.slice(-dailyKVisibleDays);
  const firstVisibleRecord = visibleRecords[0];
  const latestVisibleRecord = visibleRecords.at(-1);
  const rangeChangePct = firstVisibleRecord && latestVisibleRecord && firstVisibleRecord.close !== 0
    ? ((latestVisibleRecord.close - firstVisibleRecord.close) / firstVisibleRecord.close) * 100
    : null;
  const intradayAmplitudePct = latest && latest.close !== 0
    ? ((latest.high - latest.low) / latest.close) * 100
    : null;
  const limitUpDistancePct = latest?.limit_up && latest.close !== 0
    ? ((latest.limit_up - latest.close) / latest.close) * 100
    : null;
  const limitHitCount = visibleRecords.filter(hasTouchedLimitUp).length;

  return (
    <section className="w-full pb-6 pt-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <JudgementMetricCard
          label="趋势强度"
          value={latest ? `${trend} / ${strength}` : "--"}
          detail={latest ? `涨跌 ${formatSigned(change)} / ${formatSigned(changePct)}%` : "暂无成功行情"}
          tone={latest ? positive ? "up" : "down" : undefined}
        />
        <JudgementMetricCard
          label="日内振幅"
          value={intradayAmplitudePct === null ? "--" : formatPercent(intradayAmplitudePct)}
          detail={latest ? `${formatPrice(latest.low)} - ${formatPrice(latest.high)}` : "暂无最高/最低价"}
        />
        <JudgementMetricCard
          label="距涨停"
          value={limitUpDistancePct === null ? "--" : formatPercent(limitUpDistancePct)}
          detail={latest?.limit_up ? `涨停价 ${formatPrice(latest.limit_up)}` : "暂无涨停价"}
          tone={limitUpDistancePct !== null && limitUpDistancePct <= 0 ? "up" : undefined}
        />
        <JudgementMetricCard
          label={`近 ${visibleRecords.length || dailyKVisibleDays} 日收盘`}
          value={rangeChangePct === null ? "--" : `${formatSigned(rangeChangePct)}%`}
          detail={firstVisibleRecord && latestVisibleRecord ? `${firstVisibleRecord.date} 至 ${latestVisibleRecord.date}` : "暂无区间数据"}
          tone={rangeChangePct === null ? undefined : rangeChangePct >= 0 ? "up" : "down"}
        />
        <JudgementMetricCard
          label="触及涨停"
          value={`${limitHitCount} 次`}
          detail={`近 ${visibleRecords.length} 条成功记录`}
          tone={limitHitCount > 0 ? "up" : undefined}
        />
        <JudgementMetricCard
          label="成交活跃度"
          value={latest ? formatAmount(latest.amount) : "--"}
          detail={latest ? `成交量 ${formatVolume(latest.volume)}` : "暂无量额数据"}
        />
      </div>

      <div className="mt-5 border-t border-border/60 pt-4">
        <DailyKlineDetailSection records={sourceRecords} />
      </div>
    </section>
  );
}

function DesktopStockBoardLoading({
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

  return (
    <section className="relative min-h-0 min-w-0 overflow-y-auto px-5 pb-4 lg:px-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[1120px]"
        style={{ background: "var(--desktop-board-glow-background)" }}
      />
      <div className="relative z-10 flex w-full flex-col">
        <DesktopPageHeader onLogout={onLogout} />
        <section
          className="relative pt-4"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-background/75 to-transparent" />
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="bg-background/55"
              aria-label={isLoading ? "加载中" : "重载"}
              isDisabled={isLoading}
              onClick={onReload}
            >
              <RefreshCcw data-icon="inline-start" className={cn(isLoading && "animate-spin")} />
              {isLoading ? "加载中" : "重载"}
            </Button>
          </div>
          <div className="relative h-[clamp(320px,44vh,440px)] w-full overflow-hidden">
            <Liveline
              data={[]}
              value={0}
              mode="candle"
              candles={[]}
              candleWidth={daySecs}
              theme={themeMode}
              color={chartColor}
              lineWidth={chartLineWidth}
              window={daySecs * dailyKVisibleDays}
              grid
              loading={isLoading}
              momentum="flat"
              padding={desktopChartPadding}
              className="size-full"
            />
          </div>
        </section>

        <section className="flex flex-row items-start justify-between gap-3 pb-6 pt-4">
          <div className="min-w-0">
            <CardTitle className="text-2xl text-balance">
              {error ? "策略扫描失败" : isLoading ? "正在扫描" : "暂无候选股票"}
            </CardTitle>
            <CardDescription className="mt-2 text-pretty">
              {error ?? (isLoading ? "正在从策略扫描接口加载候选股票" : "当前策略没有返回候选股票")}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isThemeToggleVisible(themeMode) ? (
              <Button
                type="button"
                variant="outline"
                className="bg-background/55"
                aria-label={themeMode === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
                onClick={onThemeToggle}
              >
                {themeMode === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
                {themeMode === "dark" ? "亮色" : "暗色"}
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}

function MobileStockTabs({
  activeListKey,
  stockGroups,
  chartSelection,
  filterDeletePendingIds,
  selectionRecordDeletePendingIds,
  candidateStockCodes,
  candidateSavePending,
  onOpenFilterList,
  onActiveListChange,
  onSaveCandidateSelection,
  onAddToCandidate,
  onRemoveFromCandidate,
  onToggleChart,
  onDeleteFromFilterList,
}: {
  activeListKey: StockListKey;
  stockGroups: Record<StockListKey, StockCandidate[]>;
  chartSelection: ChartSelection | null;
  filterDeletePendingIds: number[];
  selectionRecordDeletePendingIds: number[];
  candidateStockCodes: Set<string>;
  candidateSavePending: boolean;
  onOpenFilterList: (listKey: ReturnableListKey) => void;
  onActiveListChange: (key: StockListKey) => void;
  onSaveCandidateSelection: () => void | Promise<void>;
  onAddToCandidate: (stock: StockCandidate) => void;
  onRemoveFromCandidate: (stock: StockCandidate) => void;
  onToggleChart: (code: string, listKey: StockListKey, selectionBatchId?: number) => void;
  onDeleteFromFilterList: (stock: StockCandidate, fromList: ReturnableListKey) => void | Promise<void>;
}) {
  const visibleListOrder = getVisibleStockListOrder(mobileListOrder, stockGroups);
  const currentListKey = visibleListOrder.includes(activeListKey) ? activeListKey : "initial";
  const stocks = stockGroups[currentListKey];
  const meta = stockListMeta[currentListKey];
  const showCandidateSave = currentListKey === "candidate";

  return (
    <Card className="mt-4 bg-card/88 shadow-[0_16px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl md:hidden">
      <CardHeader className="gap-3">
        <FilterListButtonGroup
          stockGroups={stockGroups}
          buttonClassName="h-9 bg-background/45 px-3"
          onOpenFilterList={onOpenFilterList}
        />
        <div
          className="grid gap-1 rounded-lg bg-background/45 p-1"
          style={{ gridTemplateColumns: `repeat(${visibleListOrder.length}, minmax(0, 1fr))` }}
        >
          {visibleListOrder.map((key) => (
            <button
              key={key}
              type="button"
              className={cn(
                "h-9 min-w-0 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors",
                key === currentListKey
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-default hover:text-foreground",
              )}
              aria-pressed={key === currentListKey}
              onClick={() => onActiveListChange(key)}
            >
              <span className="block truncate">{stockListMeta[key].label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <CardDescription className="truncate">{meta.description}</CardDescription>
            <Chip variant="soft">{stocks.length}</Chip>
          </div>
          {showCandidateSave ? (
            <Button
              type="button"
              variant="outline"
              className="h-8 shrink-0 bg-background/45"
              isDisabled={candidateSavePending || stocks.length === 0}
              onClick={() => void onSaveCandidateSelection()}
            >
              {candidateSavePending ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <CheckCircle2 data-icon="inline-start" />
              )}
              保存
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pb-5">
        {stocks.length > 0 ? (
          <div className="flex w-full flex-col gap-2">
            {stocks.map((stock) => (
              <StockListButton
                key={stock.code}
                stock={stock}
                active={chartSelection?.listKey === currentListKey && chartSelection.code === stock.code}
                onClick={() => onToggleChart(stock.code, currentListKey)}
                action={getStockListAction({
                  stock,
                  listKey: currentListKey,
                  candidateStockCodes,
                  filterDeletePendingIds,
                  selectionRecordDeletePendingIds,
                  onAddToCandidate,
                  onRemoveFromCandidate,
                  onRemoveFromHistory: () => undefined,
                  onDeleteFromFilterList,
                })}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
            暂无股票
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MobileSelectionHistory({
  selectionBatches,
  selectionBatchesLoading,
  selectionBatchesPageNum,
  selectionBatchesTotal,
  selectionBatchDeletePendingIds,
  chartSelection,
  selectionRecordDeletePendingIds,
  onRemoveFromHistory,
  onDeleteSelectionBatch,
  onToggleChart,
  onPageChange,
}: {
  selectionBatches: SelectionBatchState[];
  selectionBatchesLoading: boolean;
  selectionBatchesPageNum: number;
  selectionBatchesTotal: number;
  selectionBatchDeletePendingIds: number[];
  chartSelection: ChartSelection | null;
  selectionRecordDeletePendingIds: number[];
  onRemoveFromHistory: (stock: StockCandidate) => void | Promise<void>;
  onDeleteSelectionBatch: (id: number) => void | Promise<void>;
  onToggleChart: (code: string, listKey: StockListKey, selectionBatchId?: number) => void;
  onPageChange: (pageNum: number) => void;
}) {
  const [openItems, setOpenItems] = useState<string[]>([]);
  const pageCount = getPageCount(selectionBatchesTotal, selectionHistoryPageSize);

  useEffect(() => {
    setOpenItems([]);
  }, [selectionBatchesPageNum]);

  return (
    <Card className="mt-4 bg-card/88 shadow-[0_16px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl md:hidden">
      <CardHeader className="gap-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">历史选股</CardTitle>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Chip variant="soft" className="shrink-0 tabular-nums">
              {selectionBatchesLoading ? "..." : selectionBatchesTotal}
            </Chip>
            <SelectionHistoryPagination
              loading={selectionBatchesLoading}
              pageNum={selectionBatchesPageNum}
              pageCount={pageCount}
              total={selectionBatchesTotal}
              onPageChange={onPageChange}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-5">
        {selectionBatches.length > 0 ? (
          <DisclosureGroup
            allowsMultipleExpanded
            className="flex min-h-0 flex-col"
            expandedKeys={new Set(openItems)}
            onExpandedChange={(keys) => setOpenItems(Array.from(keys, String))}
            aria-label="历史选股"
          >
            {selectionBatches.map((batch) => {
              const value = getSelectionBatchDisclosureValue(batch.id);

              return (
                <SelectionBatchDisclosureItem
                  key={batch.id}
                  batch={batch}
                  expanded={openItems.includes(value)}
                  chartSelection={chartSelection}
                  selectionRecordDeletePendingIds={selectionRecordDeletePendingIds}
                  deletePending={selectionBatchDeletePendingIds.includes(batch.id)}
                  onDeleteSelectionBatch={onDeleteSelectionBatch}
                  onRemoveFromHistory={onRemoveFromHistory}
                  onToggleChart={onToggleChart}
                />
              );
            })}
          </DisclosureGroup>
        ) : selectionBatchesLoading ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            加载历史选股...
          </div>
        ) : (
          <div className="flex min-h-28 flex-col items-center justify-center gap-1 text-sm">
            <div className="font-medium">暂无历史选股</div>
            <div className="text-xs text-muted-foreground">保存候选后会生成历史选股条目</div>
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
        <div className="max-h-[300px] overflow-y-auto p-4 sm:max-h-[360px]">
          <DailyKlineDetailSection records={records} />
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
        <Table aria-label="日 K 明细" variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="日 K 明细" className="min-w-[1180px]">
              <Table.Header>
                <Table.Column isRowHeader>代码</Table.Column>
                <Table.Column>名称</Table.Column>
                <Table.Column>交易日期</Table.Column>
                <Table.Column className="text-end">开盘价</Table.Column>
                <Table.Column className="text-end">收盘价</Table.Column>
                <Table.Column className="text-end">最高价</Table.Column>
                <Table.Column className="text-end">最低价</Table.Column>
                <Table.Column className="text-end">最新价</Table.Column>
                <Table.Column className="text-end">涨停价</Table.Column>
                <Table.Column className="text-end">跌停价</Table.Column>
                <Table.Column className="text-end">涨跌幅</Table.Column>
                <Table.Column className="text-end">成交量</Table.Column>
                <Table.Column className="text-end">成交额</Table.Column>
              </Table.Header>
              <Table.Body>
                {records.map((record) => {
                  const rowKey = `${record.code}:${record.date}`;

                  return (
                    <Table.Row key={rowKey} id={rowKey}>
                      <Table.Cell className="font-medium tabular-nums">{record.code}</Table.Cell>
                      <Table.Cell className="text-muted-foreground">{record.name}</Table.Cell>
                      <Table.Cell className="text-muted-foreground tabular-nums">{record.date}</Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{formatPrice(record.open)}</Table.Cell>
                      <Table.Cell className={cn("text-end tabular-nums", record.close >= record.open ? "text-stock-up" : "text-stock-down")}>
                        {formatPrice(record.close)}
                      </Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{formatPrice(record.high)}</Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{formatPrice(record.low)}</Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{formatPrice(record.last)}</Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{formatPrice(record.limit_up)}</Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{formatPrice(record.limit_down)}</Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{formatPercent(record.limit_pct)}</Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{formatRawNumber(record.volume)}</Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{formatRawNumber(record.amount)}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      ) : (
        <StockDataEmptyState label="暂无日 K 明细数据" />
      )}
    </section>
  );
}

function StrategyBasicInfo({ strategyResult }: { strategyResult?: StrategyScanResult }) {
  if (!strategyResult) {
    return (
      <div className="rounded-md bg-background/35 px-3 py-2 text-xs text-muted-foreground backdrop-blur-xl">
        暂无策略命中数据
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <StrategyRuleChip
          shortLabel="综合命中"
          fullLabel="综合命中"
          value={strategyResult.matched}
        />
        <StrategyRuleChip
          shortLabel="规则1 涨停"
          fullLabel="规则1：涨停"
          value={strategyResult.rule1_limit_up}
        />
        <StrategyRuleChip
          shortLabel="规则2 冲高回落"
          fullLabel="规则2：前日冲高回落"
          value={strategyResult.rule2_surge_fall}
        />
        <StrategyRuleChip
          shortLabel="规则3 MA5区间"
          fullLabel="规则3：X-2日收盘在MA5之上且在X日高低价区间内"
          value={strategyResult.rule3_above_ma5_in_range}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <StrategyInfoItem label="第X天日期" value={strategyResult.x_date ?? "--"} />
        <StrategyInfoItem label="第X天涨停价" value={formatPrice(strategyResult.limit_up_price)} />
        <StrategyInfoItem label="第X天收盘价" value={formatPrice(strategyResult.x_close)} />
        <StrategyInfoItem label="第X天最高价" value={formatPrice(strategyResult.x_high)} />
        <StrategyInfoItem label="第X天最低价" value={formatPrice(strategyResult.x_low)} />
        <StrategyInfoItem label="第X-1天收盘价" value={formatPrice(strategyResult.x1_close)} />
        <StrategyInfoItem label="第X-1天最高价" value={formatPrice(strategyResult.x1_high)} />
        <StrategyInfoItem label="第X-2天收盘价" value={formatPrice(strategyResult.x2_close)} />
        <StrategyInfoItem label="第X-2天的MA5均线值" value={formatPrice(strategyResult.x2_ma5)} />
      </div>
    </div>
  );
}

function StrategyRuleChip({
  shortLabel,
  fullLabel,
  value,
}: {
  shortLabel: string;
  fullLabel: string;
  value?: boolean;
}) {
  const known = typeof value === "boolean";
  const hit = known && value;

  return (
    <span
      title={`${fullLabel}：${known ? (value ? "命中" : "未命中") : "无数据"}`}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        hit ? "text-stock-up" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          hit ? "bg-stock-up" : known ? "bg-stock-down/70" : "bg-muted-foreground/40",
        )}
      />
      {shortLabel}
    </span>
  );
}

function StrategyInfoItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 py-0.5", className)} title={label}>
      <div className="truncate text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium tabular-nums text-foreground">{value}</div>
    </div>
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
      strategyResult: result,
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

function createSelectionBatchStates(batches: SelectionBatch[]): SelectionBatchState[] {
  return batches.map((batch) => ({
    id: batch.id,
    name: batch.name,
    createdAt: batch.created_at,
    total: batch.total ?? 0,
    stocks: [],
    isLoading: true,
    error: null,
  }));
}

function createSelectionRecordCandidates(
  records: SelectionRecord[],
  batchId: number,
): StockCandidate[] {
  const seenCodes = new Set<string>();

  return records.flatMap((record) => {
    const code = record.code?.trim() || record.klines?.find((kline) => kline.code?.trim())?.code?.trim() || "";

    if (!code) {
      return [];
    }

    const codeKey = getComparableStockCode(code);

    if (seenCodes.has(codeKey)) {
      return [];
    }

    seenCodes.add(codeKey);

    const name = record.name?.trim()
      || record.klines?.find((kline) => kline.name?.trim())?.name?.trim()
      || code;
    const stock: StockCandidate = {
      code,
      name,
      list: "selected",
      records: [],
      selectionBatchId: batchId,
      selectionRecordId: record.id,
      strategyResult: record,
    };
    const dailyRecords = createDailyRecordsFromKlines(record.klines ?? [], stock);

    return [{
      ...stock,
      records: dailyRecords.length > 0
        ? dailyRecords
        : [createKlineNoDataRecord(stock, "选股记录未返回有效日 K 数据")],
    }];
  });
}

function createSelectionResultFromStock(stock: StockCandidate): StrategyScanResult {
  if (stock.strategyResult) {
    return stock.strategyResult;
  }

  return {
    code: stock.code,
    name: stock.name,
    klines: stock.records.map(createDailyKlineFromRecord),
  };
}

function createDailyKlineFromRecord(record: StockDailyRecord): DailyKline {
  return {
    amount: record.amount,
    close: record.close,
    code: record.code,
    date: record.date,
    error: record.error,
    high: record.high,
    last: record.last,
    limit_down: record.limit_down,
    limit_pct: record.limit_pct,
    limit_up: record.limit_up,
    low: record.low,
    name: record.name,
    open: record.open,
    status: record.status,
    volume: record.volume,
  };
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

function createStrategyConfigs(configs: StrategyConfigDto[]) {
  return configs.flatMap((config) => {
    const strategyConfig = createStrategyConfigFromDto(config);

    return strategyConfig.name ? [strategyConfig] : [];
  });
}

function createStrategyConfigFromDto(config: StrategyConfigDto): StrategyConfig {
  return {
    ...(config.id && config.id > 0 ? { id: config.id } : {}),
    name: config.name?.trim() || defaultStrategyConfig.name,
    enabled: config.enabled ?? defaultStrategyConfig.enabled,
    rule2Enabled: config.rule2_enabled ?? defaultStrategyConfig.rule2Enabled,
    rule3Enabled: config.rule3_enabled ?? defaultStrategyConfig.rule3Enabled,
    x: config.x ?? defaultStrategyConfig.x,
    y: config.y ?? defaultStrategyConfig.y,
  };
}

function toStrategyConfigDto(config: StrategyConfig): StrategyConfigDto {
  return {
    id: config.id,
    name: config.name,
    enabled: config.enabled,
    rule2_enabled: config.rule2Enabled,
    rule3_enabled: config.rule3Enabled,
    x: config.x,
    y: config.y,
  };
}

function normalizeStrategyConfig(config: StrategyConfig): StrategyConfig {
  return {
    ...config,
    name: config.name.trim() || defaultStrategyConfig.name,
    x: Math.max(0, Math.round(config.x)),
    y: Math.max(0, config.y),
  };
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
    error: "通过股票列表添加，等待策略扫描返回日 K 数据",
  };
}

function isStockInList(stock: StockInfo, stocks: StockCandidate[]) {
  const codeKey = getComparableStockCode(stock.code);

  return stocks.some((item) => getComparableStockCode(item.code) === codeKey);
}

function getComparableStockCode(code: string) {
  return code.trim().replace(exactCodePrefixPattern, "").toUpperCase();
}

function getSelectionBatchDisclosureValue(id: number) {
  return `selected:${id}`;
}

function getSelectionBatchIdFromDisclosureValue(value: string) {
  const match = value.match(/^selected:(\d+)$/);

  return match ? Number(match[1]) : null;
}

function getPageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

function formatRecordDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDateTime(value: string) {
  const normalized = value.trim().replace("T", " ");

  return normalized.length > 16 ? normalized.slice(0, 16) : normalized;
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
  candidateStockCodes,
  filterDeletePendingIds,
  selectionRecordDeletePendingIds,
  onAddToCandidate,
  onRemoveFromCandidate,
  onRemoveFromHistory,
  onDeleteFromFilterList,
}: {
  stock: StockCandidate;
  listKey: StockListKey;
  candidateStockCodes: Set<string>;
  filterDeletePendingIds: number[];
  selectionRecordDeletePendingIds: number[];
  onAddToCandidate: (stock: StockCandidate) => void;
  onRemoveFromCandidate: (stock: StockCandidate) => void;
  onRemoveFromHistory: (stock: StockCandidate) => void | Promise<void>;
  onDeleteFromFilterList: (stock: StockCandidate, fromList: ReturnableListKey) => void | Promise<void>;
}): StockListAction | undefined {
  if (listKey === "initial") {
    if (candidateStockCodes.has(getComparableStockCode(stock.code))) {
      return {
        icon: "added",
        title: "已在候选",
        disabled: true,
      };
    }

    return {
      icon: "add",
      title: "添加到候选",
      onClick: () => onAddToCandidate(stock),
    };
  }

  if (listKey === "candidate") {
    return {
      icon: "delete",
      title: "从候选删除",
      onClick: () => onRemoveFromCandidate(stock),
    };
  }

  if (listKey === "selected") {
    const pending = Boolean(stock.selectionRecordId && selectionRecordDeletePendingIds.includes(stock.selectionRecordId));

    return {
      icon: "delete",
      title: "从历史选股删除",
      pending,
      onClick: () => void onRemoveFromHistory(stock),
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
    <Surface
      variant="transparent"
      className={cn(
        "group/stock-item flex w-full min-w-0 flex-nowrap items-center gap-2 rounded-lg border bg-background/40 p-1 transition-[background-color,border-color]",
        active
          ? "border-ring/70 bg-secondary/80"
          : "border-transparent hover:border-border/80 hover:bg-default/50 focus-within:bg-default/50 [&:has(button:hover)]:bg-default/50",
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
        <div
          className={cn(
            stockItemActionClassName,
            action.pending && "md:w-8 md:translate-x-0 md:opacity-100",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            isIconOnly
            className="size-8 rounded-md border border-border/70 bg-background/35 text-muted-foreground hover:border-ring/60 hover:text-foreground"
            aria-label={`${action.title}：${stock.name} ${stock.code}`}
            isDisabled={action.disabled || action.pending}
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
        </div>
      ) : null}
    </Surface>
  );
}

function DesktopCandidateDialog({
  stockGroups,
  chartSelection,
  candidateStockCodes,
  candidateSavePending,
  onClose,
  onAddToCandidate,
  onAddStocksToCandidate,
  onRemoveFromCandidate,
  onClearCandidateStocks,
  onSaveCandidateSelection,
  onToggleChart,
}: {
  stockGroups: StockGroups;
  chartSelection: ChartSelection | null;
  candidateStockCodes: Set<string>;
  candidateSavePending: boolean;
  onClose: () => void;
  onAddStocksToCandidate: (stocks: StockCandidate[]) => void;
  onClearCandidateStocks: () => void;
  onSaveCandidateSelection: () => void | Promise<void>;
} & Pick<
  StockListSharedProps,
  "onAddToCandidate" | "onRemoveFromCandidate" | "onToggleChart"
>) {
  const modalState = useOverlayState({
    isOpen: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
  });
  const availableStocks = stockGroups.initial.filter((stock) => !candidateStockCodes.has(getComparableStockCode(stock.code)));
  const candidateStocks = stockGroups.candidate;

  return (
    <Modal state={modalState}>
      <Modal.Trigger className="hidden" />
      <Modal.Backdrop variant="blur">
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-5xl">
            <Modal.CloseTrigger className="z-20" />
            <Modal.Header className="p-5 pr-12">
              <div className="flex min-w-0 items-center gap-3">
                <Badge.Anchor>
                  <StockSectionIconBox icon={ListFilter} active />
                  <StockCountBadge count={availableStocks.length + candidateStocks.length} active />
                </Badge.Anchor>
                <div className="min-w-0">
                  <Modal.Heading className="truncate text-xl text-balance">待选管理</Modal.Heading>
                  <p className="mt-1 text-sm text-muted-foreground">
                    将筛选结果加入待保存列表后，可保存为历史选股
                  </p>
                </div>
              </div>
            </Modal.Header>

            <Modal.Body className="min-h-0 overflow-hidden p-0">
              <div className="grid h-[min(72vh,660px)] min-h-[420px] grid-cols-2">
                <DesktopCandidateDialogColumn
                  listKey="initial"
                  title="筛选结果"
                  description="本次策略筛选返回的待选股票"
                  count={availableStocks.length}
                  stocks={availableStocks}
                  chartSelection={chartSelection}
                  candidateStockCodes={candidateStockCodes}
                  emptyTitle="暂无待选股票"
                  emptyDescription="开始筛选后会在这里展示结果"
                  actions={(
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 shrink-0 bg-background/45"
                      isDisabled={availableStocks.length === 0}
                      onClick={() => onAddStocksToCandidate(availableStocks)}
                    >
                      <Plus data-icon="inline-start" />
                      全部添加
                    </Button>
                  )}
                  onAddToCandidate={onAddToCandidate}
                  onRemoveFromCandidate={onRemoveFromCandidate}
                  onToggleChart={onToggleChart}
                />
                <DesktopCandidateDialogColumn
                  listKey="candidate"
                  title="等待保存为已选"
                  description="这些股票会在保存后进入历史选股"
                  count={candidateStocks.length}
                  stocks={candidateStocks}
                  chartSelection={chartSelection}
                  candidateStockCodes={candidateStockCodes}
                  emptyTitle="暂无待保存股票"
                  emptyDescription="从左侧筛选结果添加股票"
                  className="border-l border-border/60"
                  actions={(
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 bg-background/45"
                        isDisabled={candidateStocks.length === 0}
                        onClick={onClearCandidateStocks}
                      >
                        <Trash2 data-icon="inline-start" />
                        全部移除
                      </Button>
                      <Button
                        type="button"
                        className="h-9"
                        isDisabled={candidateSavePending || candidateStocks.length === 0}
                        onClick={() => void onSaveCandidateSelection()}
                      >
                        {candidateSavePending ? (
                          <LoaderCircle data-icon="inline-start" className="animate-spin" />
                        ) : (
                          <CheckCircle2 data-icon="inline-start" />
                        )}
                        保存
                      </Button>
                    </div>
                  )}
                  onAddToCandidate={onAddToCandidate}
                  onRemoveFromCandidate={onRemoveFromCandidate}
                  onToggleChart={onToggleChart}
                />
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function DesktopCandidateDialogColumn({
  listKey,
  title,
  description,
  count,
  stocks,
  chartSelection,
  candidateStockCodes,
  emptyTitle,
  emptyDescription,
  actions,
  className,
  onAddToCandidate,
  onRemoveFromCandidate,
  onToggleChart,
}: {
  listKey: Extract<StockListKey, "initial" | "candidate">;
  title: string;
  description: string;
  count: number;
  stocks: StockCandidate[];
  emptyTitle: string;
  emptyDescription: string;
  actions: ReactNode;
  className?: string;
} & Pick<
  StockListSharedProps,
  "chartSelection" | "candidateStockCodes" | "onAddToCandidate" | "onRemoveFromCandidate" | "onToggleChart"
>) {
  return (
    <section className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 p-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            <Chip size="sm" variant="soft" className="shrink-0 tabular-nums">
              {count}
            </Chip>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>
        </div>
        {actions}
      </div>

      <ScrollShadow orientation="vertical" className="min-h-0 flex-1 p-4">
        {stocks.length > 0 ? (
          <div className="flex w-full flex-col gap-2">
            {stocks.map((stock) => (
              <StockListButton
                key={stock.code}
                stock={stock}
                active={chartSelection?.listKey === listKey && chartSelection.code === stock.code}
                onClick={() => onToggleChart(stock.code, listKey)}
                action={getStockListAction({
                  stock,
                  listKey,
                  candidateStockCodes,
                  filterDeletePendingIds: [],
                  selectionRecordDeletePendingIds: [],
                  onAddToCandidate,
                  onRemoveFromCandidate,
                  onRemoveFromHistory: () => undefined,
                  onDeleteFromFilterList: () => undefined,
                })}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 bg-background/30 px-4 text-center text-sm">
            <div className="font-medium">{emptyTitle}</div>
            <div className="text-xs text-muted-foreground">{emptyDescription}</div>
          </div>
        )}
      </ScrollShadow>
    </section>
  );
}

function FilterListDialog({
  targetList,
  stocks: currentStocks,
  stockGroups,
  chartSelection,
  filterDeletePendingIds,
  selectionRecordDeletePendingIds,
  candidateStockCodes,
  onClose,
  onImportStock,
  onAddToCandidate,
  onRemoveFromCandidate,
  onToggleChart,
  onDeleteFromFilterList,
}: {
  targetList: ReturnableListKey;
  stocks: StockCandidate[];
  stockGroups: StockGroups;
  chartSelection: ChartSelection | null;
  filterDeletePendingIds: number[];
  selectionRecordDeletePendingIds: number[];
  candidateStockCodes: Set<string>;
  onClose: () => void;
  onImportStock: (stock: StockInfo, targetList: ReturnableListKey) => Promise<void>;
} & Pick<
  StockListSharedProps,
  "onAddToCandidate" | "onRemoveFromCandidate" | "onToggleChart" | "onDeleteFromFilterList"
>) {
  const importDialog = useStockImportDialog(targetList, onImportStock);
  const modalState = useOverlayState({
    isOpen: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
  });
  const {
    meta,
    oppositeList,
    codeQuery,
    nameQuery,
    stocks: importStocks,
    isLoading,
    error,
    importPendingCode,
    importError,
    filteredStocks,
    visibleStocks,
    setCodeQuery,
    setNameQuery,
    handleSearch,
    handleImportStock,
  } = importDialog;
  const Icon = listIcons[targetList];

  return (
    <Modal state={modalState}>
      <Modal.Trigger className="hidden" />
      <Modal.Backdrop variant="blur">
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
            <Modal.CloseTrigger className="z-20" />
            <Modal.Header className="p-5 pr-12">
              <div className="flex min-w-0 items-center gap-3">
                <Badge.Anchor>
                  <StockSectionIconBox icon={Icon} active />
                  <StockCountBadge count={currentStocks.length} active />
                </Badge.Anchor>
                <div className="min-w-0">
                  <Modal.Heading className="truncate text-xl text-balance">{meta.label}</Modal.Heading>
                  <p className="mt-1 text-sm text-muted-foreground">管理名单股票，支持添加和删除</p>
                </div>
              </div>
            </Modal.Header>

            <Modal.Body className="flex max-h-[min(82vh,780px)] min-h-0 flex-col overflow-hidden p-0">
              <FilterListCurrentStocks
                listKey={targetList}
                stocks={currentStocks}
                chartSelection={chartSelection}
                filterDeletePendingIds={filterDeletePendingIds}
                selectionRecordDeletePendingIds={selectionRecordDeletePendingIds}
                candidateStockCodes={candidateStockCodes}
                onAddToCandidate={onAddToCandidate}
                onRemoveFromCandidate={onRemoveFromCandidate}
                onToggleChart={onToggleChart}
                onDeleteFromFilterList={onDeleteFromFilterList}
              />

              <section className="flex min-h-0 flex-1 flex-col border-t border-border/60">
                <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/55 text-muted-foreground">
                      <ImportIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">添加股票</h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">按代码或名称搜索后添加到{meta.label}</p>
                    </div>
                  </div>
                </div>
                <StockImportSearchForm
                  codeQuery={codeQuery}
                  nameQuery={nameQuery}
                  isLoading={isLoading}
                  onCodeQueryChange={setCodeQuery}
                  onNameQueryChange={setNameQuery}
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
                  stocks={importStocks}
                  visibleStocks={visibleStocks}
                  isLoading={isLoading}
                  error={error}
                  importPendingCode={importPendingCode}
                  className="min-h-0 flex-1"
                  onImportStock={handleImportStock}
                />
              </section>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function FilterListCurrentStocks({
  listKey,
  stocks,
  chartSelection,
  filterDeletePendingIds,
  selectionRecordDeletePendingIds,
  candidateStockCodes,
  onAddToCandidate,
  onRemoveFromCandidate,
  onToggleChart,
  onDeleteFromFilterList,
}: {
  listKey: ReturnableListKey;
  stocks: StockCandidate[];
} & StockListSharedProps) {
  const meta = stockListMeta[listKey];

  return (
    <section className="shrink-0 px-5 pb-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">当前{meta.label}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">点击股票查看行情，使用右侧按钮删除</p>
        </div>
        <Chip size="sm" variant="soft" className="shrink-0 tabular-nums">
          {stocks.length}
        </Chip>
      </div>

      {stocks.length > 0 ? (
        <ScrollShadow orientation="vertical" className="max-h-56 pr-2">
          <div className="flex w-full flex-col gap-2">
            {stocks.map((stock) => (
              <StockListButton
                key={stock.code}
                stock={stock}
                active={chartSelection?.listKey === listKey && chartSelection.code === stock.code}
                onClick={() => onToggleChart(stock.code, listKey)}
                action={getStockListAction({
                  stock,
                  listKey,
                  candidateStockCodes,
                  filterDeletePendingIds,
                  selectionRecordDeletePendingIds,
                  onAddToCandidate,
                  onRemoveFromCandidate,
                  onRemoveFromHistory: () => undefined,
                  onDeleteFromFilterList,
                })}
              />
            ))}
          </div>
        </ScrollShadow>
      ) : (
        <div className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 bg-background/30 text-center text-sm">
          <div className="font-medium">暂无股票</div>
          <div className="text-xs text-muted-foreground">在下方搜索后添加到{meta.label}</div>
        </div>
      )}
    </section>
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
    stocks,
    isLoading,
    error,
    importPendingCode,
    importError,
  } = dialogState;
  const meta = stockListMeta[targetList];
  const oppositeList = getOppositeReturnableListKey(targetList);
  const filteredStocks = stocks;
  const visibleStocks = filteredStocks.slice(0, stockImportResultLimit);

  const setCodeQuery = useCallback((value: string) => {
    setDialogState((current) => ({ ...current, codeQuery: value }));
  }, []);

  const setNameQuery = useCallback((value: string) => {
    setDialogState((current) => ({ ...current, nameQuery: value }));
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
      const message = importError instanceof Error ? importError.message : "添加名单失败。";

      setDialogState((current) => ({
        ...current,
        importPendingCode: null,
        importError: message,
      }));
      toast.danger("添加名单失败", {
        description: message,
      });
    }
  }

  return {
    meta,
    oppositeList,
    codeQuery,
    nameQuery,
    stocks,
    isLoading,
    error,
    importPendingCode,
    importError,
    filteredStocks,
    visibleStocks,
    setCodeQuery,
    setNameQuery,
    handleSearch,
    handleImportStock,
  };
}

function StockImportSearchForm({
  codeQuery,
  nameQuery,
  isLoading,
  onCodeQueryChange,
  onNameQueryChange,
  onSearch,
}: {
  codeQuery: string;
  nameQuery: string;
  isLoading: boolean;
  onCodeQueryChange: (value: string) => void;
  onNameQueryChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Form className="border-y bg-surface-secondary px-5 py-4" onSubmit={onSearch}>
      <div className="grid w-full gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <TextField
          className="min-w-0"
          fullWidth
          value={codeQuery}
          onChange={onCodeQueryChange}
        >
          <Label>代码</Label>
          <Input placeholder="600519 / SH600519" />
        </TextField>
        <TextField
          className="min-w-0"
          fullWidth
          value={nameQuery}
          onChange={onNameQueryChange}
        >
          <Label>名称</Label>
          <Input placeholder="贵州茅台" />
        </TextField>
        <Button type="submit" className="h-10 md:self-end" isDisabled={isLoading}>
          {isLoading ? <Spinner size="sm" color="current" data-icon="inline-start" /> : <Search data-icon="inline-start" />}
          搜索
        </Button>
      </div>
    </Form>
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
      <span className="inline-flex items-center gap-2">
        <Chip size="sm" variant="soft">结果 {filteredCount}</Chip>
        {filteredCount > visibleCount ? `显示前 ${visibleCount}` : null}
      </span>
      <Chip size="sm" variant="soft">{listLabel}</Chip>
    </div>
  );
}

function StockImportError({ message }: { message: string }) {
  return (
    <Alert status="danger" className="mx-5 mb-3">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>添加失败</Alert.Title>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
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
  className,
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
  className?: string;
  onImportStock: (stock: StockInfo) => void | Promise<void>;
}) {
  const containerClassName = cn("min-h-[320px] overflow-y-auto px-5 pb-5", className);

  if (isLoading && stocks.length === 0) {
    return (
      <div className={containerClassName}>
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <Spinner size="md" />
          加载中...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClassName}>
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>加载失败</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {visibleStocks.length > 0 ? (
        <div className="flex w-full flex-col gap-2">
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
        </div>
      ) : (
        <EmptyState className="flex min-h-48 items-center justify-center text-center text-muted-foreground">
          暂无匹配股票
        </EmptyState>
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
    <Surface
      variant="transparent"
      className="group/stock-item flex w-full flex-nowrap items-center gap-2 rounded-lg border border-border bg-background/45 p-2"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate">{stock.name}</span>
          <p className="m-0 shrink-0 text-xs tabular-nums text-muted-foreground">{stock.code}</p>
        </div>
        {inTargetList ? (
          <Chip size="sm" variant="soft" color="success" className="self-start">
            已在{metaLabel}
          </Chip>
        ) : null}
        {inOppositeList && !inTargetList ? (
          <Chip size="sm" variant="soft" color="warning" className="self-start">
            已在{stockListMeta[oppositeList].label}
          </Chip>
        ) : null}
      </div>
      {!inTargetList ? (
        <div
          className={cn(
            stockItemActionClassName,
            isImporting && "md:w-8 md:translate-x-0 md:opacity-100",
          )}
        >
          <Button
            type="button"
            isIconOnly
            variant="outline"
            className="size-8 rounded-md bg-background/55"
            aria-label={`${importTitle}：${stock.name} ${stock.code}`}
            isDisabled={Boolean(importPendingCode)}
            onClick={() => void onImportStock(stock)}
          >
            {isImporting ? (
              <Spinner size="sm" color="current" />
            ) : (
              <Plus />
            )}
          </Button>
        </div>
      ) : null}
    </Surface>
  );
}

function EmptyChart({ error, className }: { error?: string; className?: string }) {
  return (
    <div className={cn("flex size-full min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center", className)}>
      <Database className="size-8 text-muted-foreground" />
      <div>
        <div className="font-medium">暂无行情数据</div>
        <div className="mt-1 text-sm text-muted-foreground">{error ?? "等待后端返回 K 线数据"}</div>
      </div>
    </div>
  );
}

function createChartView(history: StockDailyRecord[]) {
  const records = history.slice(-dailyKVisibleDays);
  const { candles, axisDateLabels } = createDisplayDailyCandles(records);

  return {
    records,
    candles,
    axisDateLabels,
    lineData: createLineDataFromCandles(candles, daySecs),
    ma5: createMASeries(history, candles, 5),
    candleWidth: daySecs,
  };
}

function createPriceMA5Series(
  chartView: ReturnType<typeof createChartView>,
  latest: StockDailyRecord | undefined,
  priceColor: string,
  themeMode: ThemeMode,
): LivelineSeries[] {
  return [
    {
      id: "price",
      data: latest ? chartView.lineData : [],
      value: latest?.close ?? 0,
      color: priceColor,
      label: "价格",
    },
    {
      id: "ma5",
      data: chartView.ma5,
      value: chartView.ma5.at(-1)?.value ?? 0,
      color: themeMode === "light" ? "#d08700" : "#f5b942",
      label: "MA5",
    },
  ];
}

function createMASeries(
  history: StockDailyRecord[],
  visibleCandles: CandlePoint[],
  period: number,
): LivelinePoint[] {
  const offset = history.length - visibleCandles.length;
  const points: LivelinePoint[] = [];

  visibleCandles.forEach((candle, index) => {
    const end = offset + index;
    if (end < period - 1) return;

    let sum = 0;
    for (let i = end - period + 1; i <= end; i++) {
      sum += history[i].close;
    }

    points.push({ time: candle.time + daySecs, value: sum / period });
  });

  return points;
}

function createDisplayDailyCandles(records: StockDailyRecord[]) {
  const latestAxisTime = getLocalDayStartSecs(new Date());
  const axisDateLabels: ChartAxisDateLabel[] = [];
  const candles = records.map((record, index) => {
    const axisTime = latestAxisTime - (records.length - 1 - index) * daySecs;
    axisDateLabels.push({ time: axisTime, date: record.date });

    return {
      time: axisTime - daySecs / 2,
      open: record.open,
      high: record.high,
      low: record.low,
      close: record.close,
    };
  });

  return {
    candles,
    axisDateLabels,
  };
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

function formatChartAxisDate(time: number, labels: ChartAxisDateLabel[]) {
  const matched = labels.find((label) => Math.abs(label.time - time) < axisLabelMatchThresholdSecs);

  return matched?.date ?? formatChartDate(time);
}

function getLocalDayStartSecs(date: Date) {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);

  return localDate.getTime() / 1000;
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

  return daySecs * dailyKVisibleDays;
}

function hasTouchedLimitUp(record: StockDailyRecord) {
  return typeof record.limit_up === "number" && record.limit_up > 0 && record.high >= record.limit_up;
}
