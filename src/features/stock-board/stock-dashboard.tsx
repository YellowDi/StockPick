import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  RiAddLine as Plus,
  RiArrowLeftSLine as ChevronLeft,
  RiArrowRightSLine as ChevronRight,
  RiCheckboxCircleLine as CheckCircle2,
  RiDatabase2Line as Database,
  RiDeleteBinLine as Trash2,
  RiFileExcelLine as FileExcel,
  RiFilter3Line as ListFilter,
  RiImportLine as ImportIcon,
  RiLoader4Line as LoaderCircle,
  RiLogoutBoxRLine as LogOut,
  RiMoonLine as Moon,
  RiPencilLine as Pencil,
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
  CardTitle,
  Disclosure,
  DisclosureGroup,
  Drawer,
  EmptyState,
  Form,
  Input,
  Label,
  Modal,
  Pagination,
  ScrollShadow,
  Skeleton,
  Spinner,
  Separator,
  Surface,
  Tabs,
  Table,
  TextField,
  Chip,
  toast,
  useOverlayState,
} from "@heroui/react";
import { Liveline, type CandlePoint, type LivelinePoint, type LivelineSeries } from "liveline";

import { BrandLockup } from "@/components/brand-lockup";
import { defaultStrategyConfig, type StrategyConfig } from "@/features/strategy-switch/strategy-config";
import {
  StrategyConfigEditor,
  StrategyConfigPicker,
  StrategyDeleteConfirmModal,
  StrategySwitchButton,
} from "@/features/strategy-switch/strategy-switch-button";
import { stockListMeta } from "@/data/stock-list-meta";
import {
  addStockFilter,
  addManualSelection,
  addSelection,
  createStrategyConfig,
  deleteSelectionBatch,
  deleteSelectionRecords,
  deleteStockFilterGroup,
  deleteStockFilter,
  deleteStrategyConfig,
  importStockFilters,
  listSelectionBatches,
  listSelectionRecords,
  listStockFilterGroups,
  listStockFilters,
  listStocks,
  listStrategyConfigs,
  scanStrategy,
  setStockFilterGroup,
  updateStrategyConfig,
  type DailyKline,
  type ImportStockFiltersResponse,
  type SelectionBatch,
  type SelectionRecord,
  type StockFilter,
  type StockFilterGroup,
  type StockInfo,
  type StrategyConfigDto,
  type StrategyScanResult,
} from "@/lib/stock-api";
import { cn } from "@/lib/utils";
import { isThemeToggleVisible, type ThemeMode } from "@/types/theme";
import type { StockCandidate, StockDailyRecord, StockListKey } from "@/types/stock";

const filterListButtonOrder: ReturnableListKey[] = ["whitelist", "blacklist"];
const selectionHistoryPageSize = 5;
const daySecs = 24 * 60 * 60;
const dailyKVisibleDays = 7;
const axisLabelMatchThresholdSecs = daySecs / 2;
const chartLineWidth = 2.5;
const excelFileNamePattern = /\.(xls|xlsx)$/i;
const mobileChartPadding = { top: 18, right: 56, bottom: 34, left: 0 };
const desktopChartPadding = { top: 28, right: 60, bottom: 52, left: 0 };
const mobileViewportQuery = "(max-width: 767px)";
const defaultFilterGroupId = 0;
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
const exactCodePrefixPattern = /^(SH|SZ)/i;
const stockItemActionClassName = cn(
  "w-10 translate-x-0 shrink-0 overflow-hidden opacity-100 transition-[width,opacity,transform] duration-150",
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
type FilterGroupMeta = {
  groupId: number;
  listKey: ReturnableListKey;
  name: string;
};
type FilterGroupView = FilterGroupMeta & {
  stocks: StockCandidate[];
  isDefault: boolean;
};
type FilterGroupsByList = Record<ReturnableListKey, FilterGroupMeta[]>;
type FilterGroupViewsByList = Record<ReturnableListKey, FilterGroupView[]>;
type FilterDialogTarget = {
  listKey: ReturnableListKey;
  groupId?: number;
  label?: string;
};
type FilterGroupEditorTarget = {
  listKey: ReturnableListKey;
  groupId?: number;
  initialName?: string;
};
type FilterGroupDeleteTarget = FilterGroupView;
type FilterImportTarget = {
  listKey: ReturnableListKey;
  groupId?: number;
  label: string;
  targetStocks: StockCandidate[];
};
type SelectionBatchState = {
  id: number;
  name: string;
  createdAt?: string;
  total: number;
  stocks: StockCandidate[];
  isLoading: boolean;
  error: string | null;
};
type SelectionDeleteConfirmTarget =
  | { type: "batch"; batch: SelectionBatchState }
  | { type: "record"; stock: StockCandidate };
type StockImportDialogState = {
  codeQuery: string;
  nameQuery: string;
  appliedCodeQuery: string;
  appliedNameQuery: string;
  stocks: StockInfo[];
  hasLoaded: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  importPendingCode: string | null;
  importError: string | null;
  pageNum: number;
  pageSize: number;
  total: number;
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

const emptyFilterGroupsByList: FilterGroupsByList = {
  whitelist: [],
  blacklist: [],
};

const initialStockImportDialogState: StockImportDialogState = {
  codeQuery: "",
  nameQuery: "",
  appliedCodeQuery: "",
  appliedNameQuery: "",
  stocks: [],
  hasLoaded: false,
  isLoading: true,
  isLoadingMore: false,
  error: null,
  importPendingCode: null,
  importError: null,
  pageNum: 1,
  pageSize: 50,
  total: 0,
};

const listIcons = {
  initial: ListFilter,
  candidate: CheckCircle2,
  selected: Database,
  whitelist: ShieldCheck,
  blacklist: ShieldX,
} satisfies Record<StockListKey, typeof ListFilter>;

const chartSkeletonBarHeights = ["34%", "48%", "42%", "64%", "58%", "76%", "54%", "68%", "46%", "60%", "72%", "50%"];

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

function StockBoardHeaderSkeleton({ desktop = false }: { desktop?: boolean }) {
  return (
    <div className="min-w-0 space-y-3" aria-hidden="true">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Skeleton className={cn("h-8 rounded-md", desktop ? "w-40" : "w-32")} />
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className={cn("rounded-md", desktop ? "h-12 w-52" : "h-10 w-44")} />
        <Skeleton className="h-4 w-64 max-w-full rounded" />
      </div>
    </div>
  );
}

function StockChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid size-full min-h-[240px] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 rounded-lg border border-border/60 bg-background/25 p-4",
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
      </div>
      <div className="flex min-h-0 items-end gap-1">
        {chartSkeletonBarHeights.map((height, index) => (
          <Skeleton
            key={`${height}-${index}`}
            className="w-full rounded-sm"
            style={{ height }}
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Skeleton className="h-3 rounded" />
        <Skeleton className="h-3 rounded" />
        <Skeleton className="h-3 rounded" />
        <Skeleton className="h-3 rounded" />
      </div>
    </div>
  );
}

function StockListSkeleton({ count = 4, action = true }: { count?: number; action?: boolean }) {
  return (
    <div className="flex w-full flex-col gap-2" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Surface
          key={index}
          variant="transparent"
          className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-3"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <Skeleton className="h-3 w-32 max-w-full rounded" />
          </div>
          {action ? <Skeleton className="size-8 shrink-0 rounded-md" /> : null}
        </Surface>
      ))}
    </div>
  );
}

function SelectionBatchSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="flex w-full flex-col gap-2" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface/70 p-3"
        >
          <Skeleton className="size-7 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-32 max-w-full rounded" />
            <Skeleton className="h-3 w-44 max-w-full rounded" />
          </div>
          <Skeleton className="size-8 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function StockImportResultsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">加载搜索结果...</span>
      <StockListSkeleton count={5} />
    </div>
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
  filterGroups: FilterGroupsByList;
  selectionBatches: SelectionBatchState[];
  chartSelection: ChartSelection | null;
  mobileListKey: StockListKey;
  mobileStrategyDrawerOpen: boolean;
  mobileSelectionHistoryDrawerOpen: boolean;
  mobileFilterListsDrawerOpen: boolean;
  mobileFilterListKey: ReturnableListKey;
  desktopListKey: string;
  filterDialogTarget: FilterDialogTarget | null;
  candidateDialogOpen: boolean;
  candidateResultAvailable: boolean;
  scanError: string | null;
  scanLoading: boolean;
  filterListsError: string | null;
  filterDeletePendingIds: number[];
  filterGroupSavePending: boolean;
  filterGroupDeletePendingIds: number[];
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
  | { type: "open-mobile-strategy-drawer" }
  | { type: "close-mobile-strategy-drawer" }
  | { type: "open-mobile-selection-history-drawer" }
  | { type: "close-mobile-selection-history-drawer" }
  | { type: "open-mobile-filter-lists-drawer"; listKey?: ReturnableListKey }
  | { type: "close-mobile-filter-lists-drawer" }
  | { type: "set-mobile-filter-list"; listKey: ReturnableListKey }
  | { type: "set-desktop-list"; listKey: string }
  | { type: "open-filter-dialog"; target: FilterDialogTarget }
  | { type: "close-filter-dialog" }
  | { type: "open-candidate-dialog" }
  | { type: "close-candidate-dialog" }
  | { type: "scan-start" }
  | { type: "scan-success"; stocks: StockCandidate[] }
  | { type: "scan-error"; error: string }
  | { type: "set-filter-error"; error: string | null }
  | {
    type: "sync-filter-lists";
    whitelist: StockCandidate[];
    blacklist: StockCandidate[];
    whitelistGroups: FilterGroupMeta[];
    blacklistGroups: FilterGroupMeta[];
  }
  | { type: "remove-filter-stock"; stock: StockCandidate; listKey: ReturnableListKey }
  | { type: "delete-filter-start"; filterId: number }
  | { type: "delete-filter-end"; filterId: number }
  | { type: "save-filter-group-start" }
  | { type: "save-filter-group-end" }
  | { type: "delete-filter-group-start"; groupId: number }
  | { type: "delete-filter-group-end"; groupId: number }
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
  | { type: "save-candidate-success" }
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
  filterGroups: emptyFilterGroupsByList,
  selectionBatches: [],
  chartSelection: null,
  mobileListKey: "initial",
  mobileStrategyDrawerOpen: false,
  mobileSelectionHistoryDrawerOpen: false,
  mobileFilterListsDrawerOpen: false,
  mobileFilterListKey: "whitelist",
  desktopListKey: "initial",
  filterDialogTarget: null,
  candidateDialogOpen: false,
  candidateResultAvailable: false,
  scanError: null,
  scanLoading: false,
  filterListsError: null,
  filterDeletePendingIds: [],
  filterGroupSavePending: false,
  filterGroupDeletePendingIds: [],
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
    const [whiteGroups, blackGroups, whiteFilters, blackFilters] = await Promise.all([
      listStockFilterGroups("white", signal),
      listStockFilterGroups("black", signal),
      listStockFilters("white", signal),
      listStockFilters("black", signal),
    ]);
    const whitelist = createStockFilterCandidates(whiteFilters, "whitelist");
    const blacklist = createStockFilterCandidates(blackFilters, "blacklist");
    const whitelistGroups = createFilterGroupMetas(whiteGroups, "whitelist");
    const blacklistGroups = createFilterGroupMetas(blackGroups, "blacklist");

    dispatch({
      type: "sync-filter-lists",
      whitelist,
      blacklist,
      whitelistGroups,
      blacklistGroups,
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

  const openFilterListDialog = useCallback((listKey: ReturnableListKey, groupId?: number, label?: string) => {
    dispatch({ type: "open-filter-dialog", target: { listKey, groupId, label } });
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

  const importStockToList = useCallback(async (stock: StockInfo, targetList: ReturnableListKey, groupId?: number) => {
    await addStockFilter({
      code: stock.code,
      name: stock.name,
      listType: getFilterListType(targetList),
      groupId,
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

  const importStockToSelectionBatch = useCallback(async (stock: StockInfo, batchId: number) => {
    const targetBatch = state.selectionBatches.find((batch) => batch.id === batchId);

    if (!targetBatch) {
      throw new Error("历史选股列表不存在。");
    }

    await addManualSelection({
      batchId,
      code: stock.code,
      name: stock.name,
    });

    try {
      await syncSelectionBatches(state.selectionBatchesPageNum);
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "历史选股同步失败。";

      dispatch({ type: "selection-batches-load-error", error: message });
      toast.danger("历史选股同步失败", {
        description: message,
      });
    }
  }, [state.selectionBatches, state.selectionBatchesPageNum, syncSelectionBatches]);

  const importFilterExcelToList = useCallback(async (
    file: File,
    targetList: ReturnableListKey,
    groupId?: number,
  ): Promise<ImportStockFiltersResponse> => {
    const result = await importStockFilters({
      file,
      listType: getFilterListType(targetList),
      groupId,
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

    return result;
  }, [syncFilterLists]);

  const saveFilterGroup = useCallback(async (
    listKey: ReturnableListKey,
    name: string,
    groupId?: number,
  ) => {
    dispatch({ type: "save-filter-group-start" });

    try {
      await setStockFilterGroup({
        listType: getFilterListType(listKey),
        name,
        groupId,
      });
      await syncFilterLists();
      toast.success(groupId ? "名单分组已更新" : "名单分组已创建", {
        description: name.trim(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存名单分组失败。";

      dispatch({ type: "set-filter-error", error: message });
      toast.danger("保存名单分组失败", {
        description: message,
      });
      throw error;
    } finally {
      dispatch({ type: "save-filter-group-end" });
    }
  }, [syncFilterLists]);

  const removeFilterGroup = useCallback(async (groupId: number) => {
    dispatch({ type: "delete-filter-group-start", groupId });

    try {
      await deleteStockFilterGroup(groupId);
      await syncFilterLists();
      toast.success("名单分组已删除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除名单分组失败。";

      dispatch({ type: "set-filter-error", error: message });
      toast.danger("删除名单分组失败", {
        description: message,
      });
      throw error;
    } finally {
      dispatch({ type: "delete-filter-group-end", groupId });
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
      dispatch({ type: "save-candidate-success" });
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

  async function startStrategyScan(options: { openSheetOnStart?: boolean; closeMobileStrategyDrawer?: boolean } = {}) {
    const configId = state.strategyConfig.id;

    if (!configId) {
      const message = "请先保存策略配置后再开始筛选。";

      dispatch({ type: "scan-error", error: message });
      toast.danger("策略扫描失败", {
        description: message,
      });
      return;
    }

    if (options.closeMobileStrategyDrawer) {
      dispatch({ type: "close-mobile-strategy-drawer" });
    }

    if (options.openSheetOnStart) {
      dispatch({ type: "open-candidate-dialog" });
    }

    dispatch({ type: "scan-start" });

    try {
      const results = await scanStrategy({ config_id: configId });
      const stocks = createScanStockCandidates(results);

      dispatch({ type: "scan-success", stocks });
      if (!options.openSheetOnStart) {
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
    importStockToSelectionBatch,
    importFilterExcelToList,
    saveFilterGroup,
    removeFilterGroup,
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
    openMobileStrategyDrawer: () => dispatch({ type: "open-mobile-strategy-drawer" }),
    closeMobileStrategyDrawer: () => dispatch({ type: "close-mobile-strategy-drawer" }),
    openMobileSelectionHistoryDrawer: () => dispatch({ type: "open-mobile-selection-history-drawer" }),
    closeMobileSelectionHistoryDrawer: () => dispatch({ type: "close-mobile-selection-history-drawer" }),
    openMobileFilterListsDrawer: (listKey?: ReturnableListKey) => dispatch({ type: "open-mobile-filter-lists-drawer", listKey }),
    closeMobileFilterListsDrawer: () => dispatch({ type: "close-mobile-filter-lists-drawer" }),
    setMobileFilterListKey: (listKey: ReturnableListKey) => dispatch({ type: "set-mobile-filter-list", listKey }),
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
  importStockToSelectionBatch,
  importFilterExcelToList,
  saveFilterGroup,
  removeFilterGroup,
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
  openMobileStrategyDrawer,
  closeMobileStrategyDrawer,
  openMobileSelectionHistoryDrawer,
  closeMobileSelectionHistoryDrawer,
  openMobileFilterListsDrawer,
  closeMobileFilterListsDrawer,
  setMobileFilterListKey,
  setDesktopListKey,
  setStrategyConfig,
  saveStrategyConfig,
  removeStrategyConfig,
}: StockDashboardProps & ReturnType<typeof useStockDashboard>) {
  const isDesktopViewport = useIsDesktopViewport();
  const [selectionDeleteTarget, setSelectionDeleteTarget] = useState<SelectionDeleteConfirmTarget | null>(null);
  const [filterGroupEditorTarget, setFilterGroupEditorTarget] = useState<FilterGroupEditorTarget | null>(null);
  const [filterGroupDeleteTarget, setFilterGroupDeleteTarget] = useState<FilterGroupDeleteTarget | null>(null);
  const visibleFilterGroups = useMemo(
    () => createFilterGroupViewsByList(visibleStockGroups, state.filterGroups),
    [state.filterGroups, visibleStockGroups],
  );
  const candidateResultButtonVisible = state.candidateResultAvailable
    && (visibleStockGroups.initial.length > 0 || visibleStockGroups.candidate.length > 0);
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

  function requestRemoveStockFromHistory(stock: StockCandidate) {
    setSelectionDeleteTarget({ type: "record", stock });
  }

  function requestRemoveSelectionBatch(id: number) {
    const batch = state.selectionBatches.find((item) => item.id === id);

    if (batch) {
      setSelectionDeleteTarget({ type: "batch", batch });
    }
  }

  function openCreateFilterGroupEditor(listKey: ReturnableListKey) {
    setFilterGroupEditorTarget({ listKey });
  }

  function openEditFilterGroupEditor(group: FilterGroupView) {
    if (group.isDefault) {
      return;
    }

    setFilterGroupEditorTarget({
      listKey: group.listKey,
      groupId: group.groupId,
      initialName: group.name,
    });
  }

  function requestDeleteFilterGroup(group: FilterGroupView) {
    if (group.isDefault) {
      return;
    }

    setFilterGroupDeleteTarget(group);
  }

  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden text-foreground">
      <div
        className="pointer-events-none fixed inset-0 -z-10 hidden md:block"
        style={{ background: "var(--desktop-board-glow-background)" }}
      />
      <div className="mobile-dashboard-shell md:hidden">
        <div className="mobile-dashboard-main">
          <div ref={stockBoardRef} className="mobile-stock-board-region">
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

          <MobileStatusMessages
            strategyConfigError={state.strategyConfigError}
            filterListsError={state.filterListsError}
            selectionBatchesError={state.selectionBatchesError}
          />
        </div>

        <MobileBottomActions
          stockGroups={visibleStockGroups}
          selectionBatchesTotal={state.selectionBatchesTotal}
          selectionBatchesLoading={state.selectionBatchesLoading}
          onOpenStrategyDrawer={openMobileStrategyDrawer}
          onOpenSelectionHistoryDrawer={openMobileSelectionHistoryDrawer}
          onOpenFilterListsDrawer={() => openMobileFilterListsDrawer()}
        />
      </div>
      <div className="mx-auto hidden min-h-dvh w-full max-w-[1680px] md:grid md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <DesktopStockBoard
          stock={selectedStock}
          isLoading={state.scanLoading}
          error={state.scanError}
          themeMode={themeMode}
          onThemeToggle={onThemeToggle}
        />
        <DesktopStockSidebar
          activeListKey={state.desktopListKey}
          filterListsError={state.filterListsError}
          selectionBatchesError={state.selectionBatchesError}
          stockGroups={visibleStockGroups}
          filterGroups={visibleFilterGroups}
          selectionBatches={state.selectionBatches}
          selectionBatchesLoading={state.selectionBatchesLoading}
          selectionBatchesPageNum={state.selectionBatchesPageNum}
          selectionBatchesTotal={state.selectionBatchesTotal}
          selectionBatchDeletePendingIds={state.selectionBatchDeletePendingIds}
          filterGroupDeletePendingIds={state.filterGroupDeletePendingIds}
          strategyConfig={state.strategyConfig}
          strategyConfigs={state.strategyConfigs}
          strategyConfigLoading={state.strategyConfigLoading}
          strategyConfigError={state.strategyConfigError}
          strategySavePending={state.strategySavePending}
          strategyDeletePendingId={state.strategyDeletePendingId}
          scanLoading={state.scanLoading}
          candidateResultButtonVisible={candidateResultButtonVisible}
          onLogout={onLogout}
          onReload={reloadStrategyScan}
          onActiveListChange={setDesktopListKey}
          onOpenFilterList={openFilterListDialog}
          onCreateFilterGroup={openCreateFilterGroupEditor}
          onEditFilterGroup={openEditFilterGroupEditor}
          onDeleteFilterGroup={requestDeleteFilterGroup}
          onOpenCandidateDialog={openCandidateDialog}
          onImportStockToSelectionBatch={importStockToSelectionBatch}
          onRemoveFromHistory={requestRemoveStockFromHistory}
          onDeleteSelectionBatch={requestRemoveSelectionBatch}
          onSelectionHistoryPageChange={changeSelectionHistoryPage}
          onStrategySelect={setStrategyConfig}
          onStrategySave={saveStrategyConfig}
          onStrategyDelete={removeStrategyConfig}
          onStrategyScan={startStrategyScan}
          {...sharedStockListProps}
        />
      </div>
      {state.candidateDialogOpen ? (
        isDesktopViewport ? (
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
        ) : (
          <MobileCandidateDrawer
            activeListKey={state.mobileListKey}
            stockGroups={visibleStockGroups}
            chartSelection={state.chartSelection}
            candidateStockCodes={candidateStockCodes}
            candidateSavePending={state.candidateSavePending}
            scanLoading={state.scanLoading}
            scanError={state.scanError}
            onClose={closeCandidateDialog}
            onActiveListChange={setMobileListKey}
            onAddToCandidate={addStockToCandidate}
            onAddStocksToCandidate={addStocksToCandidate}
            onRemoveFromCandidate={removeStockFromCandidate}
            onClearCandidateStocks={clearCandidateStocks}
            onSaveCandidateSelection={saveCandidateSelection}
            onToggleChart={toggleSelectedStock}
          />
        )
      ) : null}
      {state.mobileStrategyDrawerOpen ? (
        <MobileStrategyConfigDrawer
          strategyConfig={state.strategyConfig}
          strategyConfigs={state.strategyConfigs}
          strategyConfigLoading={state.strategyConfigLoading}
          strategySavePending={state.strategySavePending}
          strategyDeletePendingId={state.strategyDeletePendingId}
          scanLoading={state.scanLoading}
          candidateResultButtonVisible={candidateResultButtonVisible}
          onClose={closeMobileStrategyDrawer}
          onStrategySelect={setStrategyConfig}
          onStrategySave={saveStrategyConfig}
          onStrategyDelete={removeStrategyConfig}
          onStrategyScan={() => startStrategyScan({ openSheetOnStart: true, closeMobileStrategyDrawer: true })}
          onOpenCandidateDialog={() => {
            closeMobileStrategyDrawer();
            openCandidateDialog();
          }}
        />
      ) : null}
      {state.mobileSelectionHistoryDrawerOpen ? (
        <MobileSelectionHistoryDrawer
          key={state.selectionBatchesPageNum}
          selectionBatches={state.selectionBatches}
          selectionBatchesLoading={state.selectionBatchesLoading}
          selectionBatchesPageNum={state.selectionBatchesPageNum}
          selectionBatchesTotal={state.selectionBatchesTotal}
          selectionBatchDeletePendingIds={state.selectionBatchDeletePendingIds}
          chartSelection={state.chartSelection}
          selectionRecordDeletePendingIds={state.selectionRecordDeletePendingIds}
          onClose={closeMobileSelectionHistoryDrawer}
          onImportStockToSelectionBatch={importStockToSelectionBatch}
          onRemoveFromHistory={requestRemoveStockFromHistory}
          onDeleteSelectionBatch={requestRemoveSelectionBatch}
          onToggleChart={toggleSelectedStock}
          onPageChange={changeSelectionHistoryPage}
        />
      ) : null}
      {state.mobileFilterListsDrawerOpen ? (
        <MobileFilterListsDrawer
          activeListKey={state.mobileFilterListKey}
          stockGroups={visibleStockGroups}
          filterGroups={visibleFilterGroups}
          chartSelection={state.chartSelection}
          filterDeletePendingIds={state.filterDeletePendingIds}
          filterGroupDeletePendingIds={state.filterGroupDeletePendingIds}
          selectionRecordDeletePendingIds={state.selectionRecordDeletePendingIds}
          candidateStockCodes={candidateStockCodes}
          onClose={closeMobileFilterListsDrawer}
          onActiveListChange={setMobileFilterListKey}
          onImportStock={importStockToList}
          onImportFilterExcel={importFilterExcelToList}
          onCreateFilterGroup={openCreateFilterGroupEditor}
          onEditFilterGroup={openEditFilterGroupEditor}
          onDeleteFilterGroup={requestDeleteFilterGroup}
          onAddToCandidate={addStockToCandidate}
          onRemoveFromCandidate={removeStockFromCandidate}
          onToggleChart={toggleSelectedStock}
          onDeleteFromFilterList={deleteStockFromFilterList}
        />
      ) : null}
      {isDesktopViewport && state.filterDialogTarget ? (
        <FilterListDialog
          targetList={state.filterDialogTarget.listKey}
          groupId={state.filterDialogTarget.groupId}
          displayLabel={state.filterDialogTarget.label}
          stocks={getFilterGroupStocks(
            visibleStockGroups[state.filterDialogTarget.listKey],
            state.filterDialogTarget.groupId,
          )}
          stockGroups={visibleStockGroups}
          chartSelection={state.chartSelection}
          filterDeletePendingIds={state.filterDeletePendingIds}
          selectionRecordDeletePendingIds={state.selectionRecordDeletePendingIds}
          candidateStockCodes={candidateStockCodes}
          onClose={closeFilterListDialog}
          onImportStock={importStockToList}
          onImportFilterExcel={importFilterExcelToList}
          onAddToCandidate={addStockToCandidate}
          onRemoveFromCandidate={removeStockFromCandidate}
          onToggleChart={toggleSelectedStock}
          onDeleteFromFilterList={deleteStockFromFilterList}
        />
      ) : null}
      <SelectionDeleteConfirmModal
        isOpen={selectionDeleteTarget !== null}
        target={selectionDeleteTarget}
        selectionBatchDeletePendingIds={state.selectionBatchDeletePendingIds}
        selectionRecordDeletePendingIds={state.selectionRecordDeletePendingIds}
        onOpenChange={(open) => {
          if (!open) {
            setSelectionDeleteTarget(null);
          }
        }}
        onDeleteSelectionBatch={removeSelectionBatch}
        onRemoveFromHistory={removeStockFromHistory}
      />
      <FilterGroupNameModal
        target={filterGroupEditorTarget}
        saving={state.filterGroupSavePending}
        onOpenChange={(open) => {
          if (!open) {
            setFilterGroupEditorTarget(null);
          }
        }}
        onSave={saveFilterGroup}
      />
      <FilterGroupDeleteConfirmModal
        target={filterGroupDeleteTarget}
        deleting={Boolean(
          filterGroupDeleteTarget?.groupId
          && state.filterGroupDeletePendingIds.includes(filterGroupDeleteTarget.groupId),
        )}
        onOpenChange={(open) => {
          if (!open) {
            setFilterGroupDeleteTarget(null);
          }
        }}
        onDelete={removeFilterGroup}
      />
    </main>
  );
}

function SelectionDeleteConfirmModal({
  isOpen,
  target,
  selectionBatchDeletePendingIds,
  selectionRecordDeletePendingIds,
  onOpenChange,
  onDeleteSelectionBatch,
  onRemoveFromHistory,
}: {
  isOpen: boolean;
  target: SelectionDeleteConfirmTarget | null;
  selectionBatchDeletePendingIds: number[];
  selectionRecordDeletePendingIds: number[];
  onOpenChange: (open: boolean) => void;
  onDeleteSelectionBatch: (id: number) => void | Promise<void>;
  onRemoveFromHistory: (stock: StockCandidate) => void | Promise<void>;
}) {
  const modalState = useOverlayState({ isOpen, onOpenChange });
  const batchId = target?.type === "batch" ? target.batch.id : null;
  const recordId = target?.type === "record" ? target.stock.selectionRecordId : null;
  const deleting = Boolean(
    (batchId && selectionBatchDeletePendingIds.includes(batchId))
    || (recordId && selectionRecordDeletePendingIds.includes(recordId)),
  );
  const title = target?.type === "batch" ? "删除历史选股？" : "删除历史选股条目？";
  const description = target?.type === "batch"
    ? `将删除「${target.batch.name}」及其中已保存的股票记录。删除后不可恢复。`
    : `将从历史选股中删除「${target?.stock.name ?? "当前股票"} ${target?.stock.code ?? ""}」。删除后不可恢复。`;

  async function confirmDelete() {
    if (!target) {
      return;
    }

    if (target.type === "batch") {
      await onDeleteSelectionBatch(target.batch.id);
    } else {
      await onRemoveFromHistory(target.stock);
    }

    modalState.close();
  }

  return (
    <Modal state={modalState}>
      <Modal.Trigger className="sr-only" tabIndex={-1} aria-label="打开删除历史选股确认" />
      <Modal.Backdrop variant="blur" isDismissable={!deleting}>
        <Modal.Container size="sm" scroll="inside">
          <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0">
            <Modal.Header className="p-5">
              <div className="flex flex-col gap-2">
                <Modal.Heading className="text-xl text-balance">{title}</Modal.Heading>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </Modal.Header>
            <Separator />
            <Modal.Footer className="mx-0 mb-0 rounded-none border-t-0 bg-transparent p-5 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="bg-background/55 transition-transform active:scale-[0.96]"
                isDisabled={deleting}
                slot="close"
              >
                取消
              </Button>
              <Button
                type="button"
                variant="danger"
                className="transition-transform active:scale-[0.96]"
                isDisabled={deleting || !target}
                onClick={() => void confirmDelete()}
              >
                {deleting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
                确认删除
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function FilterGroupNameModal({
  target,
  saving,
  onOpenChange,
  onSave,
}: {
  target: FilterGroupEditorTarget | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (listKey: ReturnableListKey, name: string, groupId?: number) => void | Promise<void>;
}) {
  const modalState = useOverlayState({ isOpen: target !== null, onOpenChange });
  const [name, setName] = useState("");
  const title = target?.groupId ? "重命名名单分组" : "新增名单分组";
  const listLabel = target ? stockListMeta[target.listKey].label : "名单";

  useEffect(() => {
    setName(target?.initialName ?? "");
  }, [target]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!target || saving) {
      return;
    }

    await onSave(target.listKey, name, target.groupId);
    modalState.close();
  }

  return (
    <Modal state={modalState}>
      <Modal.Trigger className="sr-only" tabIndex={-1} aria-label="打开名单分组编辑" />
      <Modal.Backdrop variant="blur" isDismissable={!saving}>
        <Modal.Container size="sm" scroll="inside">
          <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0">
            <Form onSubmit={(event) => void handleSubmit(event)}>
              <Modal.Header className="p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Badge.Anchor>
                    <StockSectionIconBox icon={listIcons[target?.listKey ?? "whitelist"]} active />
                  </Badge.Anchor>
                  <div className="min-w-0">
                    <Modal.Heading className="truncate text-xl text-balance">{title}</Modal.Heading>
                    <p className="mt-1 text-sm text-muted-foreground">{listLabel}</p>
                  </div>
                </div>
              </Modal.Header>
              <Separator />
              <Modal.Body className="p-5">
                <TextField fullWidth value={name} onChange={setName} isRequired>
                  <Label>分组名称</Label>
                  <Input placeholder={`${listLabel} #1`} autoFocus />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="mx-0 mb-0 rounded-none border-t-0 bg-transparent p-5 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="bg-background/55 transition-transform active:scale-[0.96]"
                  isDisabled={saving}
                  slot="close"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  className="transition-transform active:scale-[0.96]"
                  isDisabled={saving || !name.trim()}
                >
                  {saving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <CheckCircle2 data-icon="inline-start" />}
                  保存
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function FilterGroupDeleteConfirmModal({
  target,
  deleting,
  onOpenChange,
  onDelete,
}: {
  target: FilterGroupDeleteTarget | null;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (groupId: number) => void | Promise<void>;
}) {
  const modalState = useOverlayState({ isOpen: target !== null, onOpenChange });
  const label = target?.name ?? "当前分组";

  async function confirmDelete() {
    if (!target || target.isDefault) {
      return;
    }

    await onDelete(target.groupId);
    modalState.close();
  }

  return (
    <Modal state={modalState}>
      <Modal.Trigger className="sr-only" tabIndex={-1} aria-label="打开删除名单分组确认" />
      <Modal.Backdrop variant="blur" isDismissable={!deleting}>
        <Modal.Container size="sm" scroll="inside">
          <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0">
            <Modal.Header className="p-5">
              <div className="flex flex-col gap-2">
                <Modal.Heading className="text-xl text-balance">删除名单分组？</Modal.Heading>
                <p className="text-sm leading-6 text-muted-foreground">
                  将删除「{label}」。删除后不可恢复。
                </p>
              </div>
            </Modal.Header>
            <Separator />
            <Modal.Footer className="mx-0 mb-0 rounded-none border-t-0 bg-transparent p-5 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="bg-background/55 transition-transform active:scale-[0.96]"
                isDisabled={deleting}
                slot="close"
              >
                取消
              </Button>
              <Button
                type="button"
                variant="danger"
                className="transition-transform active:scale-[0.96]"
                isDisabled={deleting || !target || target.isDefault}
                onClick={() => void confirmDelete()}
              >
                {deleting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
                确认删除
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
    case "open-mobile-strategy-drawer":
      return { ...state, mobileStrategyDrawerOpen: true };
    case "close-mobile-strategy-drawer":
      return { ...state, mobileStrategyDrawerOpen: false };
    case "open-mobile-selection-history-drawer":
      return { ...state, mobileSelectionHistoryDrawerOpen: true };
    case "close-mobile-selection-history-drawer":
      return { ...state, mobileSelectionHistoryDrawerOpen: false };
    case "open-mobile-filter-lists-drawer":
      return {
        ...state,
        mobileFilterListsDrawerOpen: true,
        mobileFilterListKey: action.listKey ?? state.mobileFilterListKey,
      };
    case "close-mobile-filter-lists-drawer":
      return { ...state, mobileFilterListsDrawerOpen: false };
    case "set-mobile-filter-list":
      return { ...state, mobileFilterListKey: action.listKey };
    case "set-desktop-list":
      return { ...state, desktopListKey: action.listKey };
    case "open-filter-dialog":
      return { ...state, filterDialogTarget: action.target };
    case "close-filter-dialog":
      return { ...state, filterDialogTarget: null };
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
      return syncFilterListsState(state, action.whitelist, action.blacklist, action.whitelistGroups, action.blacklistGroups);
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
    case "save-filter-group-start":
      return { ...state, filterGroupSavePending: true, filterListsError: null };
    case "save-filter-group-end":
      return { ...state, filterGroupSavePending: false };
    case "delete-filter-group-start":
      return {
        ...state,
        filterGroupDeletePendingIds: state.filterGroupDeletePendingIds.includes(action.groupId)
          ? state.filterGroupDeletePendingIds
          : [...state.filterGroupDeletePendingIds, action.groupId],
        filterListsError: null,
      };
    case "delete-filter-group-end":
      return {
        ...state,
        filterGroupDeletePendingIds: state.filterGroupDeletePendingIds.filter((pendingId) => pendingId !== action.groupId),
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
    case "save-candidate-success":
      return {
        ...clearCandidateStocksState(state),
        candidateDialogOpen: false,
        candidateResultAvailable: false,
      };
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
    candidateResultAvailable: true,
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

function syncFilterListsState(
  state: StockDashboardState,
  whitelist: StockCandidate[],
  blacklist: StockCandidate[],
  whitelistGroups: FilterGroupMeta[],
  blacklistGroups: FilterGroupMeta[],
): StockDashboardState {
  const knownRecords = createKnownRecordsMap(state);

  const stockGroups = {
    ...state.stockGroups,
    whitelist: whitelist.map((stock) => hydrateStockCandidate(stock, knownRecords)),
    blacklist: blacklist.map((stock) => hydrateStockCandidate(stock, knownRecords)),
  };
  const filterGroups = {
    whitelist: whitelistGroups,
    blacklist: blacklistGroups,
  };

  if (!state.chartSelection || (state.chartSelection.listKey !== "whitelist" && state.chartSelection.listKey !== "blacklist")) {
    return {
      ...state,
      stockGroups,
      filterGroups,
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
    filterGroups,
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
    ...(isStockRedListHighlighted(stock) ? { highlight: true } : {}),
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
};

type ActiveStockBoardAction =
  | { type: "set-chart-mode"; chartMode: ChartMode };

const initialActiveStockBoardState: ActiveStockBoardState = {
  chartMode: "candle",
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
  const chartPadding = mobileChartPadding;

  return (
    <section className="mobile-stock-panel">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <BrandLockup className="min-w-0" />
        <div className="flex shrink-0 items-center gap-2">
          {isThemeToggleVisible(themeMode) ? (
            <Button
              type="button"
              variant="outline"
              isIconOnly
              className="size-10 bg-background/55 backdrop-blur-xl"
              aria-label={themeMode === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
              onClick={onThemeToggle}
            >
              {themeMode === "dark" ? <Sun /> : <Moon />}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            isIconOnly
            className="size-10 bg-background/55 backdrop-blur-xl"
            aria-label={isLoading ? "加载中" : "重载"}
            isDisabled={isLoading}
            onClick={onReload}
          >
            <RefreshCcw className={cn(isLoading && "animate-spin")} />
          </Button>
          <Button
            type="button"
            variant="outline"
            isIconOnly
            className="size-10 bg-background/55 backdrop-blur-xl"
            aria-label="退出登录"
            onClick={onLogout}
          >
            <LogOut />
          </Button>
        </div>
      </div>

      <div className="mt-4 min-w-0">
        <div className="flex min-h-10 min-w-0 flex-wrap items-center gap-2 text-left">
          <h1 className="max-w-full truncate text-2xl font-semibold leading-tight tracking-normal text-foreground sm:text-[1.65rem]">
            {stock.name}
          </h1>
          <span className="text-sm text-muted-foreground tabular-nums">{stock.code}</span>
          <Chip variant="soft" className="bg-background/35 backdrop-blur">
            {stockListMeta[stock.list].label}
          </Chip>
          <Chip
            variant="soft"
            className={cn("bg-background/55 backdrop-blur", !latest && "text-destructive")}
          >
            {latest ? "行情正常" : "无数据"}
          </Chip>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
          <span
            className={cn(
              "text-[2.65rem] font-semibold leading-none tabular-nums",
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
              "pb-1 text-base font-semibold tabular-nums",
              latest ? positive ? "text-stock-up" : "text-stock-down" : "text-muted-foreground",
            )}
          >
            <AnimatedDigits
              key={`change-${stock.code}:${latest?.date ?? ""}:${change}:${changePct}`}
              value={latest ? `${formatSigned(change)}  ${formatSigned(changePct)}%` : "--"}
            />
          </span>
          {latest ? (
            <span className="pb-1 text-xs text-muted-foreground tabular-nums">{latest.date}</span>
          ) : null}
        </div>
      </div>

      <StockStrategyPanel
        id="stock-details-panel"
        strategyResult={stock.strategyResult}
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex rounded-lg bg-background/45 p-1 shadow-[0_10px_34px_rgba(0,0,0,0.14)] backdrop-blur-xl">
          {chartModeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cn(
                "h-10 min-w-14 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors",
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
        <span className="truncate text-xs text-muted-foreground">最近 {dailyKVisibleDays} 日</span>
      </div>

      <div className="mobile-stock-chart">
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
          <EmptyChart error={error ?? chartStock.records[0]?.error} className="min-h-0" />
        )}
      </div>

      <div className="mt-4">
        <DailyKlineDetailSection records={sourceRecords} />
      </div>
    </section>
  );
}

function activeStockBoardReducer(
  state: ActiveStockBoardState,
  action: ActiveStockBoardAction,
): ActiveStockBoardState {
  switch (action.type) {
    case "set-chart-mode":
      return { ...state, chartMode: action.chartMode };
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
  const chartPadding = mobileChartPadding;
  const title = error ? "策略扫描失败" : isLoading ? "正在扫描" : "等待策略筛选";
  const description = error ?? (isLoading ? "正在从策略扫描接口加载候选股票" : "选择策略并开始筛选后显示候选行情");
  const showSkeleton = isLoading && !error;

  return (
    <section className="mobile-stock-panel">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <BrandLockup className="min-w-0" />
        <div className="flex shrink-0 items-center gap-2">
          {isThemeToggleVisible(themeMode) ? (
            <Button
              type="button"
              variant="outline"
              isIconOnly
              className="size-10 bg-background/55 backdrop-blur-xl"
              aria-label={themeMode === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
              onClick={onThemeToggle}
            >
              {themeMode === "dark" ? <Sun /> : <Moon />}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            isIconOnly
            className="size-10 bg-background/55 backdrop-blur-xl"
            aria-label={isLoading ? "加载中" : "重载"}
            isDisabled={isLoading}
            onClick={onReload}
          >
            <RefreshCcw className={cn(isLoading && "animate-spin")} />
          </Button>
          <Button
            type="button"
            variant="outline"
            isIconOnly
            className="size-10 bg-background/55 backdrop-blur-xl"
            aria-label="退出登录"
            onClick={onLogout}
          >
            <LogOut />
          </Button>
        </div>
      </div>

      <div className="mt-4 min-w-0">
        {showSkeleton ? (
          <>
            <StockBoardHeaderSkeleton />
            <span className="sr-only">{description}</span>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold leading-tight tracking-normal text-foreground text-balance">
              {title}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground text-pretty">
              {description}
            </p>
          </>
        )}
      </div>

      <div className="mobile-stock-chart">
        {showSkeleton ? (
          <StockChartSkeleton />
        ) : (
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
        )}
      </div>
    </section>
  );
}

function MobileStrategyConfigDrawer({
  strategyConfig,
  strategyConfigs,
  strategyConfigLoading,
  strategySavePending,
  strategyDeletePendingId,
  scanLoading,
  candidateResultButtonVisible,
  onClose,
  onStrategySelect,
  onStrategySave,
  onStrategyDelete,
  onStrategyScan,
  onOpenCandidateDialog,
}: {
  strategyConfig: StrategyConfig;
  strategyConfigs: StrategyConfig[];
  strategyConfigLoading: boolean;
  strategySavePending: boolean;
  strategyDeletePendingId: number | null;
  scanLoading: boolean;
  candidateResultButtonVisible: boolean;
  onClose: () => void;
  onStrategySelect: (config: StrategyConfig) => void;
  onStrategySave: (config: StrategyConfig) => void | Promise<void>;
  onStrategyDelete: (id: number) => void | Promise<void>;
  onStrategyScan: () => void | Promise<void>;
  onOpenCandidateDialog: () => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<StrategyConfig>(strategyConfig);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StrategyConfig | null>(null);
  const drawerState = useOverlayState({
    isOpen: true,
    onOpenChange: (open) => {
      if (!open) {
        setEditorOpen(false);
        setDeleteConfirmOpen(false);
        setDeleteTarget(null);
        onClose();
      }
    },
  });

  function openEditor(nextConfig: StrategyConfig) {
    setEditingConfig(nextConfig);
    setEditorOpen(true);
  }

  function handleCreate() {
    openEditor(defaultStrategyConfig);
  }

  function handleRequestDelete(nextConfig: StrategyConfig) {
    setDeleteTarget(nextConfig);
    setDeleteConfirmOpen(true);
  }

  return (
    <>
      <Drawer state={drawerState}>
        <Drawer.Trigger className="hidden" />
        <Drawer.Backdrop variant="transparent">
          <Drawer.Content placement="bottom">
            <Drawer.Dialog className="mx-auto flex h-[min(86dvh,760px)] min-h-[480px] w-full max-w-[760px] flex-col overflow-hidden p-0">
              <Drawer.Handle className="pb-1 pt-2" />
              <Drawer.CloseTrigger className="z-20" />
              <Drawer.Header className="px-4 pb-3 pt-0">
                <div className="flex min-w-0 items-center gap-3 pr-8">
                  <Badge.Anchor>
                    <StockSectionIconBox icon={Search} active />
                    <StockCountBadge count={strategyConfigs.length || 1} active />
                  </Badge.Anchor>
                  <div className="min-w-0">
                    <Drawer.Heading className="truncate text-lg text-balance">策略筛选</Drawer.Heading>
                    <p className="mt-1 truncate text-sm text-muted-foreground">选择配置，保存后开始筛选</p>
                  </div>
                </div>
              </Drawer.Header>
              <StrategyConfigPicker
                config={strategyConfig}
                configs={strategyConfigs}
                configsLoading={strategyConfigLoading}
                deletePendingId={strategyDeletePendingId}
                className="flex min-h-0 flex-1 flex-col"
                contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
                onSelect={onStrategySelect}
                onCreate={handleCreate}
                onEdit={openEditor}
                onRequestDelete={handleRequestDelete}
              />
              <Drawer.Footer className="mx-0 mb-0 rounded-none border-t border-border/60 bg-background/95 p-4">
                <div
                  className={cn(
                    "grid w-full gap-2",
                    candidateResultButtonVisible ? "grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]" : "grid-cols-1",
                  )}
                >
                  <Button
                    type="button"
                    className="h-11 w-full min-w-0"
                    isDisabled={scanLoading || strategySavePending}
                    onClick={() => {
                      if (!strategyConfig.id) {
                        toast.info("请先选择或保存配置后再开始筛选");
                        return;
                      }

                      void onStrategyScan();
                    }}
                  >
                    {scanLoading ? (
                      <LoaderCircle data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <Search data-icon="inline-start" />
                    )}
                    <span className="min-w-0 truncate">{scanLoading ? "筛选中" : "开始筛选"}</span>
                  </Button>
                  {candidateResultButtonVisible ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full min-w-0 bg-background/55 px-3 transition-transform active:scale-[0.96]"
                      aria-label="打开上一次筛选结果"
                      onClick={onOpenCandidateDialog}
                    >
                      <ListFilter data-icon="inline-start" className="shrink-0" />
                      <span className="min-w-0 truncate">上一次结果</span>
                    </Button>
                  ) : null}
                </div>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
      <MobileStrategyConfigEditorSheet
        isOpen={editorOpen}
        config={editingConfig}
        savePending={strategySavePending}
        onOpenChange={setEditorOpen}
        onSave={onStrategySave}
        onSaved={() => setEditorOpen(false)}
      />
      <StrategyDeleteConfirmModal
        isOpen={deleteConfirmOpen}
        target={deleteTarget}
        deletePendingId={strategyDeletePendingId}
        onOpenChange={(nextOpen) => {
          setDeleteConfirmOpen(nextOpen);

          if (!nextOpen) {
            setDeleteTarget(null);
          }
        }}
        onDelete={onStrategyDelete}
      />
    </>
  );
}

function MobileStrategyConfigEditorSheet({
  isOpen,
  config,
  savePending,
  onOpenChange,
  onSave,
  onSaved,
}: {
  isOpen: boolean;
  config: StrategyConfig;
  savePending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: StrategyConfig) => void | Promise<void>;
  onSaved: () => void;
}) {
  const drawerState = useOverlayState({ isOpen, onOpenChange });
  const isExistingConfig = Boolean(config.id);

  return (
    <Drawer state={drawerState}>
      <Drawer.Trigger className="hidden" />
      <Drawer.Backdrop variant="transparent">
        <Drawer.Content placement="bottom">
          <Drawer.Dialog className="mx-auto flex h-[min(82dvh,720px)] min-h-[460px] w-full max-w-[760px] flex-col overflow-hidden p-0">
            <Drawer.Handle className="pb-1 pt-2" />
            <Drawer.CloseTrigger className="z-20" />
            <Drawer.Header className="px-4 pb-3 pt-0">
              <div className="min-w-0 pr-8">
                <Drawer.Heading className="truncate text-lg text-balance">
                  {isExistingConfig ? "修改策略配置" : "新建策略配置"}
                </Drawer.Heading>
                <p className="mt-1 truncate text-sm text-muted-foreground">设置策略名称、计算参数和规则开关</p>
              </div>
            </Drawer.Header>
            <StrategyConfigEditor
              config={config}
              savePending={savePending}
              className="flex min-h-0 flex-1 flex-col"
              contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
              onSave={onSave}
              onSaved={() => {
                onSaved();
                drawerState.close();
              }}
              renderFooter={(actions) => (
                <Drawer.Footer className="mx-0 mb-0 rounded-none border-t border-border/60 bg-background/95 p-4 sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-background/55 transition-transform active:scale-[0.96]"
                    slot="close"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    className="transition-transform active:scale-[0.96]"
                    isDisabled={actions.isSaving}
                  >
                    {actions.isSaving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
                    保存配置
                  </Button>
                </Drawer.Footer>
              )}
            />
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
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

function DesktopStockSidebar({
  activeListKey,
  filterListsError,
  selectionBatchesError,
  stockGroups,
  filterGroups,
  selectionBatches,
  selectionBatchesLoading,
  selectionBatchesPageNum,
  selectionBatchesTotal,
  selectionBatchDeletePendingIds,
  filterGroupDeletePendingIds,
  strategyConfig,
  strategyConfigs,
  strategyConfigLoading,
  strategyConfigError,
  strategySavePending,
  strategyDeletePendingId,
  scanLoading,
  candidateResultButtonVisible,
  onLogout,
  onReload,
  onActiveListChange,
  onOpenFilterList,
  onCreateFilterGroup,
  onEditFilterGroup,
  onDeleteFilterGroup,
  onOpenCandidateDialog,
  onImportStockToSelectionBatch,
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
  filterGroups: FilterGroupViewsByList;
  selectionBatches: SelectionBatchState[];
  selectionBatchesLoading: boolean;
  selectionBatchesPageNum: number;
  selectionBatchesTotal: number;
  selectionBatchDeletePendingIds: number[];
  filterGroupDeletePendingIds: number[];
  strategyConfig: StrategyConfig;
  strategyConfigs: StrategyConfig[];
  strategyConfigLoading: boolean;
  strategyConfigError: string | null;
  strategySavePending: boolean;
  strategyDeletePendingId: number | null;
  scanLoading: boolean;
  candidateResultButtonVisible: boolean;
  onLogout: () => void;
  onReload: () => void;
  onActiveListChange: (key: string) => void;
  onOpenFilterList: (listKey: ReturnableListKey, groupId?: number, label?: string) => void;
  onCreateFilterGroup: (listKey: ReturnableListKey) => void;
  onEditFilterGroup: (group: FilterGroupView) => void;
  onDeleteFilterGroup: (group: FilterGroupView) => void;
  onOpenCandidateDialog: () => void;
  onImportStockToSelectionBatch: (stock: StockInfo, batchId: number) => void | Promise<void>;
  onRemoveFromHistory: (stock: StockCandidate) => void | Promise<void>;
  onDeleteSelectionBatch: (id: number) => void | Promise<void>;
  onSelectionHistoryPageChange: (pageNum: number) => void;
  onStrategySelect: (config: StrategyConfig) => void;
  onStrategySave: (config: StrategyConfig) => void | Promise<void>;
  onStrategyDelete: (id: number) => void | Promise<void>;
  onStrategyScan: () => void | Promise<void>;
} & StockListSharedProps) {
  const [filterGroupStackList, setFilterGroupStackList] = useState<ReturnableListKey | null>(null);

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 bg-transparent p-4">
      <Card className="shrink-0 bg-card/72 p-3 shadow-sm backdrop-blur-xl">
        <CardContent className="flex flex-col gap-3 p-0">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 min-w-0 flex-1 justify-start bg-background/45 px-3 shadow-sm"
              aria-label={scanLoading ? "加载中" : "重载"}
              isDisabled={scanLoading}
              onClick={onReload}
            >
              <RefreshCcw data-icon="inline-start" className={cn(scanLoading && "animate-spin")} />
              <span className="min-w-0 truncate">{scanLoading ? "加载中" : "重载"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              isIconOnly
              className="size-10 shrink-0 bg-background/45 px-0 shadow-sm"
              aria-label="退出登录"
              onClick={onLogout}
            >
              <LogOut />
            </Button>
          </div>
          <div className="h-px bg-border/70" />
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
          {candidateResultButtonVisible ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-start bg-background/40 px-3 shadow-sm"
              aria-label="打开上一次筛选结果"
              onClick={onOpenCandidateDialog}
            >
              <ListFilter data-icon="inline-start" />
              <span className="min-w-0 flex-1 truncate text-left">上一次筛选结果</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                待选 {stockGroups.initial.length} / 候选 {stockGroups.candidate.length}
              </span>
            </Button>
          ) : null}
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

      <DesktopStockDisclosureGroup
        activeListKey={activeListKey}
        selectionBatches={selectionBatches}
        selectionBatchesLoading={selectionBatchesLoading}
        selectionBatchesPageNum={selectionBatchesPageNum}
        selectionBatchesTotal={selectionBatchesTotal}
        selectionBatchDeletePendingIds={selectionBatchDeletePendingIds}
        onActiveListChange={onActiveListChange}
        onImportStockToSelectionBatch={onImportStockToSelectionBatch}
        onRemoveFromHistory={onRemoveFromHistory}
        onDeleteSelectionBatch={onDeleteSelectionBatch}
        onSelectionHistoryPageChange={onSelectionHistoryPageChange}
        {...stockListProps}
      />

      <div className="mt-auto flex shrink-0 flex-col gap-3">
        <Card className="shrink-0 bg-card/72 p-3 shadow-sm backdrop-blur-xl">
          <CardContent className="p-0">
            <FilterListButtonGroup
              stockGroups={stockGroups}
              filterGroups={filterGroups}
              openListKey={filterGroupStackList}
              filterGroupDeletePendingIds={filterGroupDeletePendingIds}
              className="grid-cols-1"
              buttonClassName="h-11 w-full bg-background/35 px-3"
              onToggleList={(listKey) => {
                setFilterGroupStackList((current) => current === listKey ? null : listKey);
              }}
              onOpenFilterGroup={(group) => {
                onOpenFilterList(group.listKey, group.groupId, group.name);
                setFilterGroupStackList(null);
              }}
              onCreateFilterGroup={onCreateFilterGroup}
              onEditFilterGroup={onEditFilterGroup}
              onDeleteFilterGroup={onDeleteFilterGroup}
            />
          </CardContent>
        </Card>
      </div>
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
  onImportStockToSelectionBatch,
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
  onImportStockToSelectionBatch: (stock: StockInfo, batchId: number) => void | Promise<void>;
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

          onActiveListChange(nextListKey ? String(nextListKey) : "");
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
            onImportStockToSelectionBatch={onImportStockToSelectionBatch}
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
  onImportStockToSelectionBatch,
  onDeleteSelectionBatch,
  onRemoveFromHistory,
  onToggleChart,
}: {
  batch: SelectionBatchState;
  expanded: boolean;
  deletePending: boolean;
  onImportStockToSelectionBatch: (stock: StockInfo, batchId: number) => void | Promise<void>;
  onDeleteSelectionBatch: (id: number) => void | Promise<void>;
  onRemoveFromHistory: (stock: StockCandidate) => void | Promise<void>;
} & Pick<StockListSharedProps, "chartSelection" | "selectionRecordDeletePendingIds" | "onToggleChart">) {
  const value = getSelectionBatchDisclosureValue(batch.id);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  return (
    <>
      <Disclosure
        id={value}
        className={cn(
          "overflow-hidden rounded-[min(32px,var(--radius-3xl))] border border-border/60 bg-surface/70 px-3 shadow-sm",
          expanded && "bg-surface",
        )}
      >
        <Disclosure.Heading className="flex min-w-0">
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

        <Disclosure.Content className="overflow-hidden">
          <div className="pb-3">
            {batch.error ? (
              <div className="flex min-h-20 flex-col justify-center gap-1 px-1 text-left">
                <div className="text-sm font-medium text-destructive">记录加载失败</div>
                <div className="text-xs text-muted-foreground text-pretty">{batch.error}</div>
              </div>
            ) : batch.isLoading ? (
              <StockListSkeleton count={3} action={false} />
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
            <div className="mt-3 grid grid-cols-2 gap-2 px-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full border-destructive/35 bg-background/45 text-destructive hover:bg-destructive/10"
                aria-label={`删除已选列表：${batch.name}`}
                isDisabled={deletePending}
                onClick={() => void onDeleteSelectionBatch(batch.id)}
              >
                {deletePending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
                删除已选列表
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full bg-background/45"
                aria-label={`添加股票到历史选股：${batch.name}`}
                isDisabled={batch.isLoading}
                onClick={() => setImportDialogOpen(true)}
              >
                <Plus data-icon="inline-start" />
                添加股票
              </Button>
            </div>
          </div>
        </Disclosure.Content>
      </Disclosure>
      {importDialogOpen ? (
        <SelectionStockImportDialog
          batch={batch}
          onClose={() => setImportDialogOpen(false)}
          onImportStock={onImportStockToSelectionBatch}
        />
      ) : null}
    </>
  );
}

function DesktopSelectionBatchesLoadingState() {
  return (
    <div className="shrink-0" aria-busy="true" aria-live="polite">
      <span className="sr-only">加载历史选股...</span>
      <SelectionBatchSkeletonList />
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
  filterGroups,
  openListKey,
  filterGroupDeletePendingIds,
  className,
  buttonClassName,
  onToggleList,
  onOpenFilterGroup,
  onCreateFilterGroup,
  onEditFilterGroup,
  onDeleteFilterGroup,
}: {
  stockGroups: Pick<StockGroups, "initial" | "candidate" | ReturnableListKey>;
  filterGroups: FilterGroupViewsByList;
  openListKey: ReturnableListKey | null;
  filterGroupDeletePendingIds: number[];
  className?: string;
  buttonClassName?: string;
  onToggleList: (listKey: ReturnableListKey) => void;
  onOpenFilterGroup: (group: FilterGroupView) => void;
  onCreateFilterGroup: (listKey: ReturnableListKey) => void;
  onEditFilterGroup: (group: FilterGroupView) => void;
  onDeleteFilterGroup: (group: FilterGroupView) => void;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {filterListButtonOrder.map((listKey) => {
        const Icon = listIcons[listKey];
        const meta = stockListMeta[listKey];
        const groups = filterGroups[listKey];
        const open = openListKey === listKey;

        return (
          <div key={listKey} className="relative isolate min-w-0">
            <FilterGroupStackPanel
              listKey={listKey}
              groups={groups}
              open={open}
              deletePendingIds={filterGroupDeletePendingIds}
              onOpenGroup={onOpenFilterGroup}
              onCreateGroup={onCreateFilterGroup}
              onEditGroup={onEditFilterGroup}
              onDeleteGroup={onDeleteFilterGroup}
            />
            <Button
              type="button"
              variant="outline"
              className={cn(
                "min-w-0 justify-start",
                open && "border-ring/60 bg-secondary/70",
                buttonClassName,
              )}
              aria-label={`展开${meta.label}分组`}
              aria-expanded={open}
              aria-controls={`filter-group-stack-${listKey}`}
              onClick={() => onToggleList(listKey)}
            >
              <Icon data-icon="inline-start" className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">{meta.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {stockGroups[listKey].length}
              </span>
              <ChevronRight
                className={cn(
                  "ml-0 size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                  open && "-rotate-90",
                )}
              />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function FilterGroupStackPanel({
  listKey,
  groups,
  open,
  deletePendingIds,
  onOpenGroup,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
}: {
  listKey: ReturnableListKey;
  groups: FilterGroupView[];
  open: boolean;
  deletePendingIds: number[];
  onOpenGroup: (group: FilterGroupView) => void;
  onCreateGroup: (listKey: ReturnableListKey) => void;
  onEditGroup: (group: FilterGroupView) => void;
  onDeleteGroup: (group: FilterGroupView) => void;
}) {
  const meta = stockListMeta[listKey];

  return (
    <div
      id={`filter-group-stack-${listKey}`}
      className={cn(
        "absolute inset-x-0 bottom-[calc(100%+0.6rem)] z-30 origin-bottom transition-[opacity,transform] duration-200 ease-out",
        open
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-3 scale-[0.97] opacity-0",
      )}
      aria-hidden={!open}
    >
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card/92 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-2 py-1.5">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold">{meta.label}分组</div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">选择分组后管理股票</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            isIconOnly
            className="size-8 shrink-0 rounded-md"
            aria-label={`新增${meta.label}分组`}
            onClick={() => onCreateGroup(listKey)}
          >
            <Plus />
          </Button>
        </div>
        <div className="mt-1 flex flex-col gap-2">
          {groups.map((group, index) => {
            const deleting = group.groupId > 0 && deletePendingIds.includes(group.groupId);

            return (
              <div
                key={`${group.listKey}:${group.groupId}`}
                className="group/filter-group flex min-w-0 items-center gap-2 rounded-lg border border-border/65 bg-background/50 p-1 shadow-sm transition-[background-color,border-color,box-shadow,opacity,transform] duration-200 ease-out hover:border-ring/45 hover:bg-default/50"
                style={{
                  opacity: open ? 1 : 0,
                  transform: open
                    ? `translateY(0) scale(${1 - index * 0.014})`
                    : `translateY(${18 + index * 8}px) scale(${0.94 - index * 0.014})`,
                  transitionDelay: open ? `${index * 42}ms` : "0ms",
                }}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 text-left outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={() => onOpenGroup(group)}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/55 text-muted-foreground">
                    {listKey === "whitelist" ? <ShieldCheck className="size-4" /> : <ShieldX className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-none">{group.name}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {group.isDefault ? "默认分组" : `ID ${group.groupId}`}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-md border border-border/60 bg-background/55 px-2 py-1 text-xs tabular-nums text-muted-foreground">
                    {group.stocks.length}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  isIconOnly
                  className="size-8 shrink-0 rounded-md text-muted-foreground"
                  aria-label={`重命名${group.name}`}
                  isDisabled={group.isDefault || deleting}
                  onClick={() => onEditGroup(group)}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  isIconOnly
                  className="size-8 shrink-0 rounded-md text-muted-foreground hover:text-destructive"
                  aria-label={`删除${group.name}`}
                  isDisabled={group.isDefault || deleting}
                  onClick={() => onDeleteGroup(group)}
                >
                  {deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
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
}: Omit<StockBoardProps, "onLogout" | "onReload">) {
  if (!stock) {
    return (
      <DesktopStockBoardLoading
        isLoading={isLoading}
        error={error}
        themeMode={themeMode}
        onThemeToggle={onThemeToggle}
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
    />
  );
}

function DesktopPageHeader() {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 pt-4">
      <BrandLockup />
    </div>
  );
}

function DesktopActiveStockBoard({
  stock,
  isLoading,
  error,
  themeMode,
  onThemeToggle,
}: Omit<StockBoardProps, "stock" | "onLogout" | "onReload"> & {
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
  } = useStockBoardModel(stock, themeMode);

  return (
    <section className="relative min-h-0 min-w-0 px-5 pb-4 lg:px-8">
      <div className="relative z-10 flex w-full flex-col">
        <DesktopPageHeader />
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
          onChartModeChange={(nextChartMode) => dispatchBoard({ type: "set-chart-mode", chartMode: nextChartMode })}
        />
        <DesktopStockInfoPanel
          sourceRecords={sourceRecords}
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
  onChartModeChange: (chartMode: ChartMode) => void;
}) {
  return (
    <section
      className="relative pt-4"
    >
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
}: {
  sourceRecords: StockDailyRecord[];
}) {
  return (
    <section className="w-full pb-6 pt-4">
      <DailyKlineDetailSection records={sourceRecords} />
    </section>
  );
}

function DesktopStockBoardLoading({
  isLoading,
  error,
  themeMode,
  onThemeToggle,
}: {
  isLoading: boolean;
  error: string | null;
  themeMode: ThemeMode;
  onThemeToggle: () => void;
}) {
  const chartColor = themeMode === "light" ? "#4f6f8f" : "#8fb6d8";
  const showSkeleton = isLoading && !error;

  return (
    <section className="relative min-h-0 min-w-0 px-5 pb-4 lg:px-8">
      <div className="relative z-10 flex w-full flex-col">
        <DesktopPageHeader />
        <section
          className="relative pt-4"
        >
          <div className="relative h-[clamp(320px,44vh,440px)] w-full overflow-hidden">
            {showSkeleton ? (
              <StockChartSkeleton className="min-h-0" />
            ) : (
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
            )}
          </div>
        </section>

        <section className="flex flex-row items-start justify-between gap-3 pb-6 pt-4">
          <div className="min-w-0">
            {showSkeleton ? (
              <>
                <StockBoardHeaderSkeleton desktop />
                <span className="sr-only">正在从策略扫描接口加载候选股票</span>
              </>
            ) : error || isLoading ? (
              <>
                <CardTitle className="text-2xl text-balance">
                  {error ? "策略扫描失败" : "正在扫描"}
                </CardTitle>
                <CardDescription className="mt-2 text-pretty">
                  {error ?? "正在从策略扫描接口加载候选股票"}
                </CardDescription>
              </>
            ) : null}
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

function MobileCandidateDrawer({
  activeListKey,
  stockGroups,
  chartSelection,
  candidateStockCodes,
  candidateSavePending,
  scanLoading,
  scanError,
  onClose,
  onActiveListChange,
  onAddStocksToCandidate,
  onClearCandidateStocks,
  onSaveCandidateSelection,
  onAddToCandidate,
  onRemoveFromCandidate,
  onToggleChart,
}: {
  activeListKey: StockListKey;
  stockGroups: Record<StockListKey, StockCandidate[]>;
  chartSelection: ChartSelection | null;
  candidateStockCodes: Set<string>;
  candidateSavePending: boolean;
  scanLoading: boolean;
  scanError: string | null;
  onClose: () => void;
  onActiveListChange: (key: StockListKey) => void;
  onAddStocksToCandidate: (stocks: StockCandidate[]) => void;
  onClearCandidateStocks: () => void;
  onSaveCandidateSelection: () => void | Promise<void>;
  onAddToCandidate: (stock: StockCandidate) => void;
  onRemoveFromCandidate: (stock: StockCandidate) => void;
  onToggleChart: (code: string, listKey: StockListKey, selectionBatchId?: number) => void;
}) {
  const drawerState = useOverlayState({
    isOpen: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
  });
  const availableStocks = stockGroups.initial.filter((stock) => !candidateStockCodes.has(getComparableStockCode(stock.code)));
  const candidateStocks = stockGroups.candidate;
  const currentListKey: Extract<StockListKey, "initial" | "candidate"> = activeListKey === "candidate"
    ? "candidate"
    : "initial";
  const tabs = [
    {
      key: "initial" as const,
      label: "筛选结果",
      description: "本次策略筛选返回的待选股票",
      count: availableStocks.length,
      stocks: availableStocks,
    },
    {
      key: "candidate" as const,
      label: "等待保存为已选",
      description: "这些股票会在保存后进入历史选股",
      count: candidateStocks.length,
      stocks: candidateStocks,
    },
  ];

  return (
    <Drawer state={drawerState}>
      <Drawer.Trigger className="hidden" />
      <Drawer.Backdrop variant="transparent">
        <Drawer.Content placement="bottom">
          <Drawer.Dialog className="mx-auto h-[min(78dvh,680px)] min-h-[420px] w-full max-w-[760px] overflow-hidden p-0">
            <Drawer.Handle className="pb-1 pt-2" />
            <Drawer.CloseTrigger className="z-20" />
            <Drawer.Header className="px-4 pb-3 pt-0">
              <div className="flex min-w-0 items-center gap-3 pr-8">
                <Badge.Anchor>
                  <StockSectionIconBox icon={ListFilter} active />
                  <StockCountBadge count={availableStocks.length + candidateStocks.length} active />
                </Badge.Anchor>
                <div className="min-w-0">
                  <Drawer.Heading className="truncate text-lg text-balance">筛选结果</Drawer.Heading>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    在筛选结果和待保存列表之间切换
                  </p>
                </div>
              </div>
            </Drawer.Header>

            <Drawer.Body className="flex min-h-0 flex-col overflow-hidden p-0">
              {scanLoading ? (
                <div className="mx-4 mb-3 flex shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-background/45 px-3 py-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  正在执行策略筛选...
                </div>
              ) : null}
              {scanError ? (
                <Alert status="danger" className="mx-4 mb-3 shrink-0">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>策略扫描失败</Alert.Title>
                    <Alert.Description>{scanError}</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
              <Tabs
                selectedKey={currentListKey}
                onSelectionChange={(key) => {
                  const nextKey = String(key);

                  if (nextKey === "initial" || nextKey === "candidate") {
                    onActiveListChange(nextKey);
                  }
                }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <Tabs.ListContainer className="shrink-0 px-4 pb-3">
                  <Tabs.List aria-label="筛选结果列表">
                    {tabs.map((tab, index) => (
                      <Tabs.Tab
                        key={tab.key}
                        id={tab.key}
                      >
                        {index > 0 ? <Tabs.Separator /> : null}
                        <Tabs.Indicator />
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="min-w-0 truncate">{tab.label}</span>
                          <span className="shrink-0 tabular-nums">{tab.count}</span>
                        </span>
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>

                {tabs.map((tab) => (
                  <Tabs.Panel
                    key={tab.key}
                    id={tab.key}
                    className="min-h-0 flex-1 overflow-hidden"
                  >
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate text-sm font-semibold">{tab.label}</h3>
                            <Chip size="sm" variant="soft" className="shrink-0 tabular-nums">
                              {tab.count}
                            </Chip>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{tab.description}</p>
                        </div>
                        {tab.key === "initial" ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 shrink-0 bg-background/45"
                            isDisabled={availableStocks.length === 0}
                            onClick={() => onAddStocksToCandidate(availableStocks)}
                          >
                            <Plus data-icon="inline-start" />
                            全部添加
                          </Button>
                        ) : (
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 bg-background/45 px-3"
                              isDisabled={candidateStocks.length === 0}
                              onClick={onClearCandidateStocks}
                            >
                              <Trash2 data-icon="inline-start" />
                              清空
                            </Button>
                            <Button
                              type="button"
                              className="h-10 px-3"
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
                      </div>

                      <ScrollShadow orientation="vertical" className="min-h-0 flex-1 p-4">
                        {tab.stocks.length > 0 ? (
                          <div className="flex w-full flex-col gap-2">
                            {tab.stocks.map((stock) => (
                              <StockListButton
                                key={stock.code}
                                stock={stock}
                                active={chartSelection?.listKey === tab.key && chartSelection.code === stock.code}
                                onClick={() => onToggleChart(stock.code, tab.key)}
                                action={getStockListAction({
                                  stock,
                                  listKey: tab.key,
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
                          <div className="flex min-h-48 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 bg-background/30 px-4 text-center text-sm">
                            <div className="font-medium">
                              {tab.key === "initial" ? "暂无筛选结果" : "暂无待保存股票"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {tab.key === "initial" ? "开始筛选后会在这里展示结果" : "从筛选结果添加股票"}
                            </div>
                          </div>
                        )}
                      </ScrollShadow>
                    </div>
                  </Tabs.Panel>
                ))}
              </Tabs>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

function MobileSelectionHistoryDrawer({
  selectionBatches,
  selectionBatchesLoading,
  selectionBatchesPageNum,
  selectionBatchesTotal,
  selectionBatchDeletePendingIds,
  chartSelection,
  selectionRecordDeletePendingIds,
  onClose,
  onImportStockToSelectionBatch,
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
  onClose: () => void;
  onImportStockToSelectionBatch: (stock: StockInfo, batchId: number) => void | Promise<void>;
  onRemoveFromHistory: (stock: StockCandidate) => void | Promise<void>;
  onDeleteSelectionBatch: (id: number) => void | Promise<void>;
  onToggleChart: (code: string, listKey: StockListKey, selectionBatchId?: number) => void;
  onPageChange: (pageNum: number) => void;
}) {
  const [openItems, setOpenItems] = useState<string[]>([]);
  const pageCount = getPageCount(selectionBatchesTotal, selectionHistoryPageSize);
  const drawerState = useOverlayState({
    isOpen: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
  });

  return (
    <Drawer state={drawerState}>
      <Drawer.Trigger className="hidden" />
      <Drawer.Backdrop variant="transparent">
        <Drawer.Content placement="bottom">
          <Drawer.Dialog className="mx-auto flex h-[min(78dvh,680px)] min-h-[420px] w-full max-w-[760px] flex-col overflow-hidden p-0">
            <Drawer.Handle className="pb-1 pt-2" />
            <Drawer.CloseTrigger className="z-20" />
            <Drawer.Header className="px-4 pb-3 pt-0">
              <div className="flex min-w-0 items-center justify-between gap-3 pr-8">
                <div className="flex min-w-0 items-center gap-3">
                  <Badge.Anchor>
                    <StockSectionIconBox icon={Database} active />
                    <StockCountBadge count={selectionBatchesLoading ? "..." : selectionBatchesTotal} active />
                  </Badge.Anchor>
                  <div className="min-w-0">
                    <Drawer.Heading className="truncate text-lg text-balance">历史选股</Drawer.Heading>
                  </div>
                </div>
                <SelectionHistoryPagination
                  loading={selectionBatchesLoading}
                  pageNum={selectionBatchesPageNum}
                  pageCount={pageCount}
                  total={selectionBatchesTotal}
                  onPageChange={onPageChange}
                />
              </div>
            </Drawer.Header>
            <Drawer.Body className="min-h-0 overflow-y-auto px-4 pb-5 pt-0">
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
                        onImportStockToSelectionBatch={onImportStockToSelectionBatch}
                        onDeleteSelectionBatch={onDeleteSelectionBatch}
                        onRemoveFromHistory={onRemoveFromHistory}
                        onToggleChart={(code, listKey, selectionBatchId) => {
                          onToggleChart(code, listKey, selectionBatchId);
                          onClose();
                        }}
                      />
                    );
                  })}
                </DisclosureGroup>
              ) : selectionBatchesLoading ? (
                <div className="py-1" aria-busy="true" aria-live="polite">
                  <span className="sr-only">加载历史选股...</span>
                  <SelectionBatchSkeletonList count={4} />
                </div>
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center gap-1 text-sm">
                  <div className="font-medium">暂无历史选股</div>
                  <div className="text-xs text-muted-foreground">保存候选后会生成历史选股条目</div>
                </div>
              )}
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

function MobileStatusMessages({
  strategyConfigError,
  filterListsError,
  selectionBatchesError,
}: {
  strategyConfigError: string | null;
  filterListsError: string | null;
  selectionBatchesError: string | null;
}) {
  if (!strategyConfigError && !filterListsError && !selectionBatchesError) {
    return null;
  }

  return (
    <div className="mobile-list-region">
      {strategyConfigError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          策略配置失败：{strategyConfigError}
        </p>
      ) : null}
      {filterListsError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          名单操作失败：{filterListsError}
        </p>
      ) : null}
      {selectionBatchesError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          历史选股失败：{selectionBatchesError}
        </p>
      ) : null}
    </div>
  );
}

function MobileBottomActions({
  stockGroups,
  selectionBatchesTotal,
  selectionBatchesLoading,
  onOpenStrategyDrawer,
  onOpenSelectionHistoryDrawer,
  onOpenFilterListsDrawer,
}: {
  stockGroups: Pick<StockGroups, ReturnableListKey>;
  selectionBatchesTotal: number;
  selectionBatchesLoading: boolean;
  onOpenStrategyDrawer: () => void;
  onOpenSelectionHistoryDrawer: () => void;
  onOpenFilterListsDrawer: () => void;
}) {
  const filterCount = stockGroups.whitelist.length + stockGroups.blacklist.length;

  return (
    <div className="mobile-bottom-actions">
      <div className="mobile-bottom-actions__inner">
        <div className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full min-w-0 justify-center gap-1 bg-background/55 px-2 shadow-sm"
            aria-label="打开策略筛选"
            onClick={onOpenStrategyDrawer}
          >
            <Search data-icon="inline-start" className="shrink-0" />
            <span className="min-w-0 truncate">策略筛选</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full min-w-0 justify-center gap-1 bg-background/55 px-2 shadow-sm"
            aria-label="打开历史选股"
            onClick={onOpenSelectionHistoryDrawer}
          >
            <Database data-icon="inline-start" className="shrink-0" />
            <span className="min-w-0 truncate">历史选股</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {selectionBatchesLoading ? "..." : selectionBatchesTotal}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full min-w-0 justify-center gap-1 bg-background/55 px-2 shadow-sm"
            aria-label="打开红黑名单"
            onClick={onOpenFilterListsDrawer}
          >
            <ShieldCheck data-icon="inline-start" className="shrink-0" />
            <span className="min-w-0 truncate">红黑名单</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{filterCount}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function StockStrategyPanel({
  id,
  strategyResult,
}: {
  id: string;
  strategyResult?: StrategyScanResult;
}) {
  return (
    <div
      id={id}
      className="mt-4"
    >
      <section>
        <h2 className="mb-2 text-sm font-semibold">策略命中</h2>
        <StrategyBasicInfo strategyResult={strategyResult} />
      </section>
    </div>
  );
}

function DailyKlineDetailSection({ records }: { records: StockDailyRecord[] }) {
  return (
    <section>
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
        <StrategyInfoItem
          label="第X-2天收盘价偏离MA5的百分比"
          value={formatPercent(strategyResult.x2_ma5_pct)}
          className="col-span-2"
        />
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
      ...(result.highlight === true ? { highlight: true } : {}),
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
      ...(record.highlight === true ? { highlight: true } : {}),
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
    ...(isStockRedListHighlighted(stock) ? { highlight: true } : {}),
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

function createFilterGroupMetas(
  groups: StockFilterGroup[],
  listKey: ReturnableListKey,
): FilterGroupMeta[] {
  const seenGroupIds = new Set<number>();

  return groups.flatMap((group) => {
    if (!Number.isFinite(group.groupId) || group.groupId <= 0 || seenGroupIds.has(group.groupId)) {
      return [];
    }

    const name = group.name.trim();

    if (!name) {
      return [];
    }

    seenGroupIds.add(group.groupId);
    return [{ groupId: group.groupId, listKey, name }];
  });
}

function createFilterGroupViews(
  stocks: StockCandidate[],
  groupMetas: FilterGroupMeta[],
  listKey: ReturnableListKey,
): FilterGroupView[] {
  const stocksByGroupId = new Map<number, StockCandidate[]>();

  for (const stock of stocks) {
    const groupId = getFilterGroupId(stock);

    stocksByGroupId.set(groupId, [...(stocksByGroupId.get(groupId) ?? []), stock]);
  }

  const views = groupMetas.map((group) => ({
    ...group,
    stocks: stocksByGroupId.get(group.groupId) ?? [],
    isDefault: false,
  }));
  const knownGroupIds = new Set(groupMetas.map((group) => group.groupId));
  const fallbackStocks = [
    ...(stocksByGroupId.get(defaultFilterGroupId) ?? []),
    ...Array.from(stocksByGroupId.entries()).flatMap(([groupId, groupStocks]) => (
      groupId !== defaultFilterGroupId && !knownGroupIds.has(groupId) ? groupStocks : []
    )),
  ];

  if (groupMetas.length === 0 || fallbackStocks.length > 0) {
    views.unshift({
      groupId: defaultFilterGroupId,
      listKey,
      name: groupMetas.length === 0 ? `${stockListMeta[listKey].label} #1` : "未分组",
      stocks: fallbackStocks,
      isDefault: true,
    });
  }

  return views;
}

function createFilterGroupViewsByList(
  stockGroups: StockGroups,
  filterGroups: FilterGroupsByList,
): FilterGroupViewsByList {
  return {
    whitelist: createFilterGroupViews(stockGroups.whitelist, filterGroups.whitelist, "whitelist"),
    blacklist: createFilterGroupViews(stockGroups.blacklist, filterGroups.blacklist, "blacklist"),
  };
}

function getFilterGroupId(stock: StockCandidate) {
  return typeof stock.filterGroupId === "number" && Number.isFinite(stock.filterGroupId) && stock.filterGroupId > 0
    ? stock.filterGroupId
    : defaultFilterGroupId;
}

function getFilterGroupStocks(stocks: StockCandidate[], groupId?: number) {
  if (typeof groupId !== "number") {
    return stocks;
  }

  return stocks.filter((stock) => getFilterGroupId(stock) === groupId);
}

function isExcelFile(file: File) {
  return excelFileNamePattern.test(file.name);
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
      filter.groupId,
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
  filterGroupId?: number,
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
    ...(filterGroupId && filterGroupId > 0 ? { filterGroupId } : {}),
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

function createStockCodeSet(stocks: { code: string }[]) {
  return new Set(stocks.map((stock) => getComparableStockCode(stock.code)));
}

function isStockRedListHighlighted(stock: StockCandidate) {
  return stock.highlight === true || stock.strategyResult?.highlight === true;
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

const StockListButton = memo(function StockListButton({
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
  const highlighted = isStockRedListHighlighted(stock);

  return (
    <Surface
      variant="transparent"
      className={cn(
        "group/stock-item flex w-full min-w-0 flex-nowrap items-center gap-2 rounded-lg border bg-background/40 p-1 transition-[background-color,border-color] [content-visibility:auto] [contain-intrinsic-size:52px]",
        active
          ? "border-ring/70 bg-secondary/80"
          : "border-transparent hover:border-border/80 hover:bg-default/50 focus-within:bg-default/50 [&:has(button:hover)]:bg-default/50",
        highlighted && "border-stock-up/60 bg-stock-up/10 ring-1 ring-inset ring-stock-up/50",
        active && highlighted && "border-stock-up/70 ring-stock-up/60",
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center rounded-md p-2 text-left outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={`${stock.name} ${stock.code}${highlighted ? "，红名单内股票" : ""}`}
        aria-pressed={active}
        onClick={onClick}
      >
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate font-medium">{stock.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{stock.code}</span>
          {highlighted ? (
            <span className="shrink-0 rounded border border-stock-up/35 bg-stock-up/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-stock-up">
              红名单
            </span>
          ) : null}
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
            className="size-10 rounded-md border border-border/70 bg-background/35 text-muted-foreground hover:border-ring/60 hover:text-foreground md:size-8"
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
});

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
  const drawerState = useOverlayState({
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
    <Drawer state={drawerState}>
      <Drawer.Trigger className="hidden" />
      <Drawer.Backdrop variant="transparent" isDismissable={false}>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="h-full w-[min(28rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-none border-l border-border/70 p-0">
            <Drawer.Handle className="hidden" />
            <Drawer.CloseTrigger className="z-20" />
            <Drawer.Header className="px-5 py-4 pr-12">
              <div className="flex min-w-0 items-center gap-3">
                <Badge.Anchor>
                  <StockSectionIconBox icon={ListFilter} active />
                  <StockCountBadge count={availableStocks.length + candidateStocks.length} active />
                </Badge.Anchor>
                <div className="min-w-0">
                  <Drawer.Heading className="truncate text-xl text-balance">筛选结果</Drawer.Heading>
                  <p className="mt-1 text-sm text-muted-foreground">
                    将筛选结果加入待保存列表后，可保存为历史选股
                  </p>
                </div>
              </div>
            </Drawer.Header>

            <Drawer.Body className="min-h-0 overflow-hidden p-0">
              <div className="flex h-full min-h-0 flex-col">
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
                  className="border-t border-border/60"
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
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
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
    <section className={cn("flex min-h-0 flex-1 flex-col", className)}>
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

function MobileFilterListsDrawer({
  activeListKey,
  stockGroups,
  filterGroups,
  chartSelection,
  filterDeletePendingIds,
  filterGroupDeletePendingIds,
  selectionRecordDeletePendingIds,
  candidateStockCodes,
  onClose,
  onActiveListChange,
  onImportStock,
  onImportFilterExcel,
  onCreateFilterGroup,
  onEditFilterGroup,
  onDeleteFilterGroup,
  onAddToCandidate,
  onRemoveFromCandidate,
  onToggleChart,
  onDeleteFromFilterList,
}: {
  activeListKey: ReturnableListKey;
  stockGroups: StockGroups;
  filterGroups: FilterGroupViewsByList;
  chartSelection: ChartSelection | null;
  filterDeletePendingIds: number[];
  filterGroupDeletePendingIds: number[];
  selectionRecordDeletePendingIds: number[];
  candidateStockCodes: Set<string>;
  onClose: () => void;
  onActiveListChange: (listKey: ReturnableListKey) => void;
  onImportStock: (stock: StockInfo, targetList: ReturnableListKey, groupId?: number) => Promise<void>;
  onImportFilterExcel: (file: File, targetList: ReturnableListKey, groupId?: number) => Promise<ImportStockFiltersResponse>;
  onCreateFilterGroup: (listKey: ReturnableListKey) => void;
  onEditFilterGroup: (group: FilterGroupView) => void;
  onDeleteFilterGroup: (group: FilterGroupView) => void;
} & Pick<
  StockListSharedProps,
  "onAddToCandidate" | "onRemoveFromCandidate" | "onToggleChart" | "onDeleteFromFilterList"
>) {
  const [importTarget, setImportTarget] = useState<FilterImportTarget | null>(null);
  const drawerState = useOverlayState({
    isOpen: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
  });
  const filterCount = stockGroups.whitelist.length + stockGroups.blacklist.length;

  return (
    <>
      <Drawer state={drawerState}>
        <Drawer.Trigger className="hidden" />
        <Drawer.Backdrop variant="transparent">
          <Drawer.Content placement="bottom">
            <Drawer.Dialog className="mx-auto flex h-[min(82dvh,720px)] min-h-[460px] w-full max-w-[760px] flex-col overflow-hidden p-0">
              <Drawer.Handle className="pb-1 pt-2" />
              <Drawer.CloseTrigger className="z-20" />
              <Drawer.Header className="px-4 pb-3 pt-0">
                <div className="flex min-w-0 items-center gap-3 pr-8">
                  <Badge.Anchor>
                    <StockSectionIconBox icon={ShieldCheck} active />
                    <StockCountBadge count={filterCount} active />
                  </Badge.Anchor>
                  <div className="min-w-0">
                    <Drawer.Heading className="truncate text-lg text-balance">红黑名单</Drawer.Heading>
                    <p className="mt-1 truncate text-sm text-muted-foreground">管理红名单和黑名单股票</p>
                  </div>
                </div>
              </Drawer.Header>
              <Drawer.Body className="min-h-0 overflow-hidden p-0">
                <Tabs
                  selectedKey={activeListKey}
                  onSelectionChange={(key) => {
                    const nextKey = String(key);

                    if (nextKey === "whitelist" || nextKey === "blacklist") {
                      onActiveListChange(nextKey);
                    }
                  }}
                  className="flex h-full min-h-0 flex-col"
                >
                  <Tabs.ListContainer className="shrink-0 px-4 pb-3">
                    <Tabs.List aria-label="红黑名单">
                      {filterListButtonOrder.map((listKey, index) => {
                        const meta = stockListMeta[listKey];

                        return (
                          <Tabs.Tab key={listKey} id={listKey}>
                            {index > 0 ? <Tabs.Separator /> : null}
                            <Tabs.Indicator />
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="min-w-0 truncate">{meta.label}</span>
                              <span className="shrink-0 tabular-nums">{stockGroups[listKey].length}</span>
                            </span>
                          </Tabs.Tab>
                        );
                      })}
                    </Tabs.List>
                  </Tabs.ListContainer>
                  {filterListButtonOrder.map((listKey) => (
                    <Tabs.Panel key={listKey} id={listKey} className="min-h-0 flex-1 overflow-hidden p-0">
                      <MobileFilterGroupPanel
                        listKey={listKey}
                        groups={filterGroups[listKey]}
                        chartSelection={chartSelection}
                        filterDeletePendingIds={filterDeletePendingIds}
                        filterGroupDeletePendingIds={filterGroupDeletePendingIds}
                        selectionRecordDeletePendingIds={selectionRecordDeletePendingIds}
                        candidateStockCodes={candidateStockCodes}
                        onCreateFilterGroup={onCreateFilterGroup}
                        onEditFilterGroup={onEditFilterGroup}
                        onDeleteFilterGroup={onDeleteFilterGroup}
                        onImportStock={(group) => setImportTarget({
                          listKey: group.listKey,
                          groupId: group.groupId,
                          label: group.name,
                          targetStocks: group.stocks,
                        })}
                        onImportFilterExcel={(file, group) => onImportFilterExcel(file, group.listKey, group.groupId)}
                        onAddToCandidate={onAddToCandidate}
                        onRemoveFromCandidate={onRemoveFromCandidate}
                        onToggleChart={(code, nextListKey) => {
                          onToggleChart(code, nextListKey);
                          onClose();
                        }}
                        onDeleteFromFilterList={onDeleteFromFilterList}
                      />
                    </Tabs.Panel>
                  ))}
                </Tabs>
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
      {importTarget ? (
        <FilterStockImportDrawer
          targetList={importTarget.listKey}
          groupId={importTarget.groupId}
          targetLabel={importTarget.label}
          targetStocks={importTarget.targetStocks}
          stockGroups={stockGroups}
          onClose={() => setImportTarget(null)}
          onImportStock={onImportStock}
        />
      ) : null}
    </>
  );
}

function MobileFilterGroupPanel({
  listKey,
  groups,
  chartSelection,
  filterDeletePendingIds,
  filterGroupDeletePendingIds,
  selectionRecordDeletePendingIds,
  candidateStockCodes,
  onCreateFilterGroup,
  onEditFilterGroup,
  onDeleteFilterGroup,
  onImportStock,
  onImportFilterExcel,
  onAddToCandidate,
  onRemoveFromCandidate,
  onToggleChart,
  onDeleteFromFilterList,
}: {
  listKey: ReturnableListKey;
  groups: FilterGroupView[];
  filterGroupDeletePendingIds: number[];
  onCreateFilterGroup: (listKey: ReturnableListKey) => void;
  onEditFilterGroup: (group: FilterGroupView) => void;
  onDeleteFilterGroup: (group: FilterGroupView) => void;
  onImportStock: (group: FilterGroupView) => void;
  onImportFilterExcel: (file: File, group: FilterGroupView) => Promise<ImportStockFiltersResponse>;
} & StockListSharedProps) {
  const meta = stockListMeta[listKey];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{meta.label}分组</h3>
            <Chip size="sm" variant="soft" className="shrink-0 tabular-nums">
              {groups.length}
            </Chip>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">按分组管理名单股票</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 bg-background/45 px-3"
          onClick={() => onCreateFilterGroup(listKey)}
        >
          <Plus data-icon="inline-start" />
          新增分组
        </Button>
      </div>
      <ScrollShadow orientation="vertical" className="min-h-0 flex-1 px-4 pb-4 pt-3">
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const deleting = group.groupId > 0 && filterGroupDeletePendingIds.includes(group.groupId);

            return (
              <section
                key={`${group.listKey}:${group.groupId}`}
                className="overflow-hidden rounded-xl border border-border/65 bg-surface/70 shadow-sm"
              >
                <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border/55 px-3 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/55 text-muted-foreground">
                      {listKey === "whitelist" ? <ShieldCheck className="size-4" /> : <ShieldX className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-none">{group.name}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {group.isDefault ? "默认分组" : `ID ${group.groupId}`}
                      </span>
                    </span>
                    <Chip size="sm" variant="soft" className="shrink-0 tabular-nums">
                      {group.stocks.length}
                    </Chip>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    isIconOnly
                    className="size-8 shrink-0 rounded-md text-muted-foreground"
                    aria-label={`重命名${group.name}`}
                    isDisabled={group.isDefault || deleting}
                    onClick={() => onEditFilterGroup(group)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    isIconOnly
                    className="size-8 shrink-0 rounded-md text-muted-foreground hover:text-destructive"
                    aria-label={`删除${group.name}`}
                    isDisabled={group.isDefault || deleting}
                    onClick={() => onDeleteFilterGroup(group)}
                  >
                    {deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                  </Button>
                </div>
                <FilterListCurrentStocks
                  listKey={listKey}
                  stocks={group.stocks}
                  emptyLabel={group.name}
                  className="px-3 py-3"
                  scrollClassName="max-h-52 pr-2"
                  chartSelection={chartSelection}
                  filterDeletePendingIds={filterDeletePendingIds}
                  selectionRecordDeletePendingIds={selectionRecordDeletePendingIds}
                  candidateStockCodes={candidateStockCodes}
                  onAddToCandidate={onAddToCandidate}
                  onRemoveFromCandidate={onRemoveFromCandidate}
                  onToggleChart={onToggleChart}
                  onDeleteFromFilterList={onDeleteFromFilterList}
                />
                <FilterListAddStockLauncher
                  metaLabel={group.name}
                  onOpen={() => onImportStock(group)}
                  onImportExcel={(file) => onImportFilterExcel(file, group)}
                />
              </section>
            );
          })}
        </div>
      </ScrollShadow>
    </div>
  );
}

function FilterListDialog({
  targetList,
  groupId,
  displayLabel,
  stocks: currentStocks,
  stockGroups,
  chartSelection,
  filterDeletePendingIds,
  selectionRecordDeletePendingIds,
  candidateStockCodes,
  onClose,
  onImportStock,
  onImportFilterExcel,
  onAddToCandidate,
  onRemoveFromCandidate,
  onToggleChart,
  onDeleteFromFilterList,
}: {
  targetList: ReturnableListKey;
  groupId?: number;
  displayLabel?: string;
  stocks: StockCandidate[];
  stockGroups: StockGroups;
  chartSelection: ChartSelection | null;
  filterDeletePendingIds: number[];
  selectionRecordDeletePendingIds: number[];
  candidateStockCodes: Set<string>;
  onClose: () => void;
  onImportStock: (stock: StockInfo, targetList: ReturnableListKey, groupId?: number) => Promise<void>;
  onImportFilterExcel: (file: File, targetList: ReturnableListKey, groupId?: number) => Promise<ImportStockFiltersResponse>;
} & Pick<
  StockListSharedProps,
  "onAddToCandidate" | "onRemoveFromCandidate" | "onToggleChart" | "onDeleteFromFilterList"
>) {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const modalState = useOverlayState({
    isOpen: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
  });
  const meta = stockListMeta[targetList];
  const Icon = listIcons[targetList];
  const label = displayLabel ?? meta.label;

  return (
    <>
      <Modal state={modalState}>
        <Modal.Trigger className="sr-only" aria-label={`打开${meta.label}弹窗`}>
          打开{meta.label}弹窗
        </Modal.Trigger>
        <Modal.Backdrop variant="blur">
          <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
              <Modal.CloseTrigger className="z-20" />
              <Modal.Header className="p-5 pr-12">
                <div className="flex min-w-0 items-center gap-3">
                  <Badge.Anchor>
                    <StockSectionIconBox icon={Icon} active />
                    <StockCountBadge count={currentStocks.length} active />
                  </Badge.Anchor>
                  <div className="min-w-0">
                    <Modal.Heading className="truncate text-xl text-balance">{label}</Modal.Heading>
                    <p className="mt-1 text-sm text-muted-foreground">管理名单股票，支持添加和删除</p>
                  </div>
                </div>
              </Modal.Header>

              <Modal.Body className="flex max-h-[min(82vh,780px)] min-h-0 flex-col overflow-hidden p-0">
                <FilterListCurrentStocks
                  listKey={targetList}
                  stocks={currentStocks}
                  emptyLabel={label}
                  chartSelection={chartSelection}
                  filterDeletePendingIds={filterDeletePendingIds}
                  selectionRecordDeletePendingIds={selectionRecordDeletePendingIds}
                  candidateStockCodes={candidateStockCodes}
                  onAddToCandidate={onAddToCandidate}
                  onRemoveFromCandidate={onRemoveFromCandidate}
                  onToggleChart={onToggleChart}
                  onDeleteFromFilterList={onDeleteFromFilterList}
                />

                <FilterListAddStockLauncher
                  metaLabel={label}
                  onOpen={() => setIsImportDialogOpen(true)}
                  onImportExcel={(file) => onImportFilterExcel(file, targetList, groupId)}
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      {isImportDialogOpen ? (
        <FilterStockImportDialog
          targetList={targetList}
          groupId={groupId}
          targetLabel={label}
          targetStocks={currentStocks}
          stockGroups={stockGroups}
          onClose={() => setIsImportDialogOpen(false)}
          onImportStock={onImportStock}
        />
      ) : null}
    </>
  );
}

function FilterListAddStockLauncher({
  metaLabel,
  onOpen,
  onImportExcel,
}: {
  metaLabel: string;
  onOpen: () => void;
  onImportExcel: (file: File) => Promise<ImportStockFiltersResponse>;
}) {
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [isExcelImporting, setIsExcelImporting] = useState(false);

  const handleExcelImportClick = useCallback(() => {
    if (!isExcelImporting) {
      excelInputRef.current?.click();
    }
  }, [isExcelImporting]);

  const handleExcelFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;

    input.value = "";

    if (!file) {
      return;
    }

    if (!isExcelFile(file)) {
      toast.danger("Excel导入失败", {
        description: "请选择 .xls 或 .xlsx 文件。",
      });
      return;
    }

    setIsExcelImporting(true);

    try {
      const result = await onImportExcel(file);

      if (result.errors.length > 0) {
        const errorPreview = result.errors.slice(0, 3).join("、");
        const suffix = result.errors.length > 3 ? ` 等 ${result.errors.length} 项` : "";

        toast.warning("Excel导入完成，存在错误列", {
          description: `${errorPreview}${suffix}`,
        });
      } else {
        toast.success(`已从Excel导入${metaLabel}`, {
          description: file.name,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Excel导入失败。";

      toast.danger("Excel导入失败", {
        description: message,
      });
    } finally {
      setIsExcelImporting(false);
    }
  }, [metaLabel, onImportExcel]);

  return (
    <section className="shrink-0 border-t border-border/60 px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/55 text-muted-foreground">
            <ImportIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">添加股票</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">打开搜索浮窗后添加到{metaLabel}</p>
          </div>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
          <input
            ref={excelInputRef}
            type="file"
            className="hidden"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => void handleExcelFileChange(event)}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            isDisabled={isExcelImporting}
            onClick={handleExcelImportClick}
          >
            {isExcelImporting ? (
              <Spinner size="sm" color="current" data-icon="inline-start" />
            ) : (
              <FileExcel data-icon="inline-start" />
            )}
            从 Excel 导入
          </Button>
          <Button type="button" className="w-full sm:w-auto" onClick={onOpen}>
            <Plus data-icon="inline-start" />
            添加股票
          </Button>
        </div>
      </div>
    </section>
  );
}

function FilterStockImportDrawer({
  targetList,
  groupId,
  targetLabel,
  targetStocks,
  stockGroups,
  onClose,
  onImportStock,
}: {
  targetList: ReturnableListKey;
  groupId?: number;
  targetLabel?: string;
  targetStocks?: StockCandidate[];
  stockGroups: StockGroups;
  onClose: () => void;
  onImportStock: (stock: StockInfo, targetList: ReturnableListKey, groupId?: number) => Promise<void>;
}) {
  const meta = stockListMeta[targetList];
  const label = targetLabel ?? meta.label;
  const oppositeList = getOppositeReturnableListKey(targetList);
  const importDialog = useStockImportDialog(
    targetList,
    label,
    (stock, listKey) => onImportStock(stock, listKey, groupId),
    "添加名单失败",
    "添加名单失败。",
  );
  const drawerState = useOverlayState({
    isOpen: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
  });
  const {
    codeQuery,
    nameQuery,
    stocks: importStocks,
    hasLoaded,
    isLoading,
    isLoadingMore,
    error,
    importPendingCode,
    importError,
    filteredStocks,
    visibleStocks,
    pageNum,
    pageSize,
    total,
    pageCount,
    hasMore,
    setCodeQuery,
    setNameQuery,
    handleSearch,
    handleResetSearch,
    handleImportStock,
    goToPage,
  } = importDialog;

  return (
    <Drawer state={drawerState}>
      <Drawer.Trigger className="hidden" />
      <Drawer.Backdrop variant="transparent">
        <Drawer.Content placement="bottom">
          <Drawer.Dialog className="mx-auto flex h-[min(82dvh,720px)] min-h-[440px] w-full max-w-[760px] flex-col overflow-hidden p-0">
            <Drawer.Handle className="pb-1 pt-2" />
            <Drawer.CloseTrigger className="z-20" />
            <Drawer.Header className="px-4 pb-3 pt-0">
              <div className="flex min-w-0 items-center gap-3 pr-8">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/55 text-muted-foreground">
                  <ImportIcon className="size-4" />
                </span>
                <div className="min-w-0">
                  <Drawer.Heading className="truncate text-lg text-balance">添加到{label}</Drawer.Heading>
                  <p className="mt-1 truncate text-sm text-muted-foreground">搜索股票后选择是否添加</p>
                </div>
              </div>
            </Drawer.Header>
            <Drawer.Body className="flex min-h-0 flex-col overflow-hidden p-0">
              <StockImportSearchForm
                codeQuery={codeQuery}
                nameQuery={nameQuery}
                isLoading={isLoading}
                onCodeQueryChange={setCodeQuery}
                onNameQueryChange={setNameQuery}
                onSearch={handleSearch}
                onReset={handleResetSearch}
              />
              {hasLoaded && !isLoading && !error ? (
                <StockImportSummary
                  listLabel={label}
                  filteredCount={filteredStocks.length}
                />
              ) : null}
              {importError ? (
                <StockImportError message={importError} />
              ) : null}
              <StockImportResults
                metaLabel={label}
                stocks={importStocks}
                visibleStocks={visibleStocks}
                hasLoaded={hasLoaded}
                isLoading={isLoading}
                isLoadingMore={isLoadingMore}
                error={error}
                importPendingCode={importPendingCode}
                className="min-h-0 flex-1"
                targetStocks={targetStocks ?? stockGroups[targetList]}
                oppositeList={oppositeList}
                oppositeStocks={stockGroups[oppositeList]}
                pageNum={pageNum}
                pageSize={pageSize}
                total={total}
                pageCount={pageCount}
                hasMore={hasMore}
                onImportStock={handleImportStock}
                onPageChange={goToPage}
              />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

function FilterStockImportDialog({
  targetList,
  groupId,
  targetLabel,
  targetStocks,
  stockGroups,
  onClose,
  onImportStock,
}: {
  targetList: ReturnableListKey;
  groupId?: number;
  targetLabel?: string;
  targetStocks?: StockCandidate[];
  stockGroups: StockGroups;
  onClose: () => void;
  onImportStock: (stock: StockInfo, targetList: ReturnableListKey, groupId?: number) => Promise<void>;
}) {
  const meta = stockListMeta[targetList];
  const label = targetLabel ?? meta.label;
  const oppositeList = getOppositeReturnableListKey(targetList);
  const importDialog = useStockImportDialog(
    targetList,
    label,
    (stock, listKey) => onImportStock(stock, listKey, groupId),
    "添加名单失败",
    "添加名单失败。",
  );
  const modalState = useOverlayState({
    isOpen: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
  });
  const {
    codeQuery,
    nameQuery,
    stocks: importStocks,
    hasLoaded,
    isLoading,
    isLoadingMore,
    error,
    importPendingCode,
    importError,
    filteredStocks,
    visibleStocks,
    pageNum,
    pageSize,
    total,
    pageCount,
    hasMore,
    setCodeQuery,
    setNameQuery,
    handleSearch,
    handleResetSearch,
    handleImportStock,
    goToPage,
  } = importDialog;

  return (
    <Modal state={modalState}>
      <Modal.Trigger className="sr-only" aria-label={`打开添加到${label}弹窗`}>
        打开添加到{label}弹窗
      </Modal.Trigger>
      <Modal.Backdrop variant="blur">
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
            <Modal.CloseTrigger className="z-20" />
            <Modal.Header className="p-5 pr-12">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/55 text-muted-foreground">
                  <ImportIcon className="size-4" />
                </span>
                <div className="min-w-0">
                  <Modal.Heading className="truncate text-xl text-balance">添加到{label}</Modal.Heading>
                  <p className="mt-1 text-sm text-muted-foreground">搜索股票后选择是否添加</p>
                </div>
              </div>
            </Modal.Header>

            <Modal.Body className="flex max-h-[min(78vh,680px)] min-h-0 flex-col overflow-hidden p-0">
              <StockImportSearchForm
                codeQuery={codeQuery}
                nameQuery={nameQuery}
                isLoading={isLoading}
                onCodeQueryChange={setCodeQuery}
                onNameQueryChange={setNameQuery}
                onSearch={handleSearch}
                onReset={handleResetSearch}
              />
              {hasLoaded && !isLoading && !error ? (
                <StockImportSummary
                  listLabel={label}
                  filteredCount={filteredStocks.length}
                />
              ) : null}
              {importError ? (
                <StockImportError message={importError} />
              ) : null}
              <StockImportResults
                metaLabel={label}
                stocks={importStocks}
                visibleStocks={visibleStocks}
                hasLoaded={hasLoaded}
                isLoading={isLoading}
                isLoadingMore={isLoadingMore}
                error={error}
                importPendingCode={importPendingCode}
                className="min-h-0 flex-1"
                targetStocks={targetStocks ?? stockGroups[targetList]}
                oppositeList={oppositeList}
                oppositeStocks={stockGroups[oppositeList]}
                pageNum={pageNum}
                pageSize={pageSize}
                total={total}
                pageCount={pageCount}
                hasMore={hasMore}
                onImportStock={handleImportStock}
                onPageChange={goToPage}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function SelectionStockImportDialog({
  batch,
  onClose,
  onImportStock,
}: {
  batch: SelectionBatchState;
  onClose: () => void;
  onImportStock: (stock: StockInfo, batchId: number) => void | Promise<void>;
}) {
  const importDialog = useStockImportDialog(
    batch.id,
    batch.name,
    onImportStock,
    "添加历史选股失败",
    "添加历史选股失败。",
  );
  const modalState = useOverlayState({
    isOpen: true,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
  });
  const {
    codeQuery,
    nameQuery,
    stocks: importStocks,
    hasLoaded,
    isLoading,
    isLoadingMore,
    error,
    importPendingCode,
    importError,
    filteredStocks,
    visibleStocks,
    pageNum,
    pageSize,
    total,
    pageCount,
    hasMore,
    setCodeQuery,
    setNameQuery,
    handleSearch,
    handleResetSearch,
    handleImportStock,
    goToPage,
  } = importDialog;

  return (
    <Modal state={modalState}>
      <Modal.Trigger className="sr-only" aria-label={`打开添加到${batch.name}弹窗`}>
        打开添加到{batch.name}弹窗
      </Modal.Trigger>
      <Modal.Backdrop variant="blur">
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
            <Modal.CloseTrigger className="z-20" />
            <Modal.Header className="p-5 pr-12">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/55 text-muted-foreground">
                  <ImportIcon className="size-4" />
                </span>
                <div className="min-w-0">
                  <Modal.Heading className="truncate text-xl text-balance">添加到{batch.name}</Modal.Heading>
                  <p className="mt-1 text-sm text-muted-foreground">搜索股票后添加到当前历史选股</p>
                </div>
              </div>
            </Modal.Header>

            <Modal.Body className="flex max-h-[min(78vh,680px)] min-h-0 flex-col overflow-hidden p-0">
              <StockImportSearchForm
                codeQuery={codeQuery}
                nameQuery={nameQuery}
                isLoading={isLoading}
                onCodeQueryChange={setCodeQuery}
                onNameQueryChange={setNameQuery}
                onSearch={handleSearch}
                onReset={handleResetSearch}
              />
              {hasLoaded && !isLoading && !error ? (
                <StockImportSummary
                  listLabel={batch.name}
                  filteredCount={filteredStocks.length}
                />
              ) : null}
              {importError ? (
                <StockImportError message={importError} />
              ) : null}
              <StockImportResults
                metaLabel={batch.name}
                stocks={importStocks}
                visibleStocks={visibleStocks}
                hasLoaded={hasLoaded}
                isLoading={isLoading}
                isLoadingMore={isLoadingMore}
                error={error}
                importPendingCode={importPendingCode}
                className="min-h-0 flex-1"
                targetStocks={batch.stocks}
                pageNum={pageNum}
                pageSize={pageSize}
                total={total}
                pageCount={pageCount}
                hasMore={hasMore}
                onImportStock={handleImportStock}
                onPageChange={goToPage}
              />
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
  emptyLabel,
  className,
  scrollClassName,
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
  emptyLabel?: string;
  className?: string;
  scrollClassName?: string;
} & StockListSharedProps) {
  const meta = stockListMeta[listKey];
  const label = emptyLabel ?? meta.label;
  const activeCode = chartSelection?.listKey === listKey ? chartSelection.code : null;

  return (
    <section className={cn("flex min-h-0 flex-1 flex-col px-5 pb-5", className)}>
      {stocks.length > 0 ? (
        <ScrollShadow orientation="vertical" className={cn("min-h-0 flex-1 pr-2", scrollClassName)}>
          <div className="flex w-full flex-col gap-2">
            {stocks.map((stock) => (
              <StockListButton
                key={stock.code}
                stock={stock}
                active={activeCode === stock.code}
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
        <div className="flex min-h-24 flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 bg-background/30 text-center text-sm">
          <div className="font-medium">暂无股票</div>
          <div className="text-xs text-muted-foreground">点击添加股票后搜索添加到{label}</div>
        </div>
      )}
    </section>
  );
}

function useStockImportDialog<TTarget>(
  target: TTarget,
  targetLabel: string,
  onImportStock: (stock: StockInfo, target: TTarget) => void | Promise<void>,
  errorTitle: string,
  errorFallback: string,
) {
  const requestIdRef = useRef(0);
  const [dialogState, setDialogState] = useState<StockImportDialogState>(initialStockImportDialogState);
  const {
    codeQuery,
    nameQuery,
    appliedCodeQuery,
    appliedNameQuery,
    stocks,
    hasLoaded,
    isLoading,
    isLoadingMore,
    error,
    importPendingCode,
    importError,
    pageNum,
    pageSize,
    total,
  } = dialogState;
  const filteredStocks = useMemo(() => {
    const normalizedCodeQuery = getComparableStockCode(appliedCodeQuery);
    const normalizedNameQuery = appliedNameQuery.trim().toLowerCase();

    if (!normalizedCodeQuery && !normalizedNameQuery) {
      return stocks;
    }

    return stocks.filter((stock) => {
      const matchesCode = !normalizedCodeQuery
        || getComparableStockCode(stock.code).includes(normalizedCodeQuery);
      const matchesName = !normalizedNameQuery
        || stock.name.toLowerCase().includes(normalizedNameQuery);

      return matchesCode && matchesName;
    });
  }, [appliedCodeQuery, appliedNameQuery, stocks]);
  const visibleStocks = filteredStocks;
  const hasMore = stocks.length < total;

  const cancelActiveStockLoad = useCallback(() => {
    requestIdRef.current += 1;
  }, [requestIdRef]);

  const setCodeQuery = useCallback((value: string) => {
    setDialogState((current) => ({
      ...current,
      codeQuery: value,
      importError: null,
    }));
  }, []);

  const setNameQuery = useCallback((value: string) => {
    setDialogState((current) => ({
      ...current,
      nameQuery: value,
      importError: null,
    }));
  }, []);

  const loadStocks = useCallback(async (pageNum: number, signal?: AbortSignal) => {
    const requestId = requestIdRef.current + 1;

    requestIdRef.current = requestId;
    setDialogState((current) => ({
      ...current,
      hasLoaded: current.hasLoaded && current.pageNum !== pageNum,
      isLoading: !current.hasLoaded,
      isLoadingMore: current.hasLoaded && current.pageNum !== pageNum,
      error: null,
    }));

    try {
      const response = await listStocks({
        page_num: pageNum,
        page_size: dialogState.pageSize,
      }, signal);

      if (requestId === requestIdRef.current) {
        setDialogState((current) => ({
          ...current,
          stocks: response.list,
          hasLoaded: true,
          pageNum: response.page_num,
          total: response.total,
        }));
      }
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      if (requestId === requestIdRef.current) {
        setDialogState((current) => ({
          ...current,
          error: loadError instanceof Error ? loadError.message : "股票列表加载失败。",
        }));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setDialogState((current) => ({
          ...current,
          isLoading: false,
          isLoadingMore: false,
        }));
      }
    }
  }, [dialogState.pageSize]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      void loadStocks(pageNum + 1);
    }
  }, [isLoadingMore, hasMore, loadStocks, pageNum]);

  const pageCount = Math.ceil(total / pageSize);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= pageCount) {
      void loadStocks(page);
    }
  }, [loadStocks, pageCount]);

  useEffect(() => {
    const controller = new AbortController();

    void loadStocks(1, controller.signal);

    return () => {
      controller.abort();
      cancelActiveStockLoad();
    };
  }, [cancelActiveStockLoad, loadStocks]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setDialogState((current) => ({
      ...current,
      appliedCodeQuery: current.codeQuery.trim(),
      appliedNameQuery: current.nameQuery.trim(),
      importError: null,
    }));
  }

  const handleResetSearch = useCallback(() => {
    setDialogState((current) => ({
      ...current,
      codeQuery: "",
      nameQuery: "",
      appliedCodeQuery: "",
      appliedNameQuery: "",
      importError: null,
    }));
  }, []);

  const handleImportStock = useCallback(async (stock: StockInfo) => {
    const stockCodeKey = getComparableStockCode(stock.code);

    setDialogState((current) => ({
      ...current,
      importPendingCode: stockCodeKey,
      importError: null,
    }));

    try {
      await onImportStock(stock, target);
      setDialogState((current) => ({
        ...current,
        importPendingCode: null,
        importError: null,
      }));
      toast.success(`已添加到${targetLabel}`, {
        description: `${stock.name} ${stock.code}`,
      });
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : errorFallback;

      setDialogState((current) => ({
        ...current,
        importPendingCode: null,
        importError: message,
      }));
      toast.danger(errorTitle, {
        description: message,
      });
    }
  }, [errorFallback, errorTitle, onImportStock, target, targetLabel]);

  return {
    codeQuery,
    nameQuery,
    stocks,
    hasLoaded,
    isLoading,
    isLoadingMore,
    error,
    importPendingCode,
    importError,
    filteredStocks,
    visibleStocks,
    pageNum,
    pageSize,
    total,
    pageCount,
    hasMore,
    setCodeQuery,
    setNameQuery,
    handleSearch,
    handleResetSearch,
    handleImportStock,
    loadMore,
    goToPage,
  };
}

function StockImportSearchForm({
  codeQuery,
  nameQuery,
  isLoading,
  onCodeQueryChange,
  onNameQueryChange,
  onSearch,
  onReset,
}: {
  codeQuery: string;
  nameQuery: string;
  isLoading: boolean;
  onCodeQueryChange: (value: string) => void;
  onNameQueryChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
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
        <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:self-end">
          <Button type="button" variant="outline" className="h-10 w-full md:w-auto" onClick={onReset}>
            <RefreshCcw data-icon="inline-start" />
            重置
          </Button>
          <Button type="submit" className="h-10 w-full md:w-auto" isDisabled={isLoading}>
            {isLoading ? <Spinner size="sm" color="current" data-icon="inline-start" /> : <Search data-icon="inline-start" />}
            搜索
          </Button>
        </div>
      </div>
    </Form>
  );
}

function StockImportSummary({
  listLabel,
  filteredCount,
}: {
  listLabel: string;
  filteredCount: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <Chip size="sm" variant="soft">结果 {filteredCount}</Chip>
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

type StockImportResultRow = {
  stock: StockInfo;
  stockCodeKey: string;
  inTargetList: boolean;
  inOppositeList: boolean;
  isImporting: boolean;
};

const StockImportResults = memo(function StockImportResults({
  metaLabel,
  stocks,
  visibleStocks,
  hasLoaded,
  isLoading,
  isLoadingMore,
  error,
  importPendingCode,
  className,
  targetStocks,
  oppositeList,
  oppositeStocks,
  pageNum,
  total,
  pageCount,
  onImportStock,
  onPageChange,
}: {
  metaLabel: string;
  stocks: StockInfo[];
  visibleStocks: StockInfo[];
  hasLoaded: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  importPendingCode: string | null;
  className?: string;
  targetStocks: StockCandidate[];
  oppositeList?: ReturnableListKey;
  oppositeStocks?: StockCandidate[];
  pageNum: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasMore: boolean;
  onImportStock: (stock: StockInfo) => void | Promise<void>;
  onPageChange: (page: number) => void;
}) {
  const containerClassName = cn("min-h-[320px] overflow-y-auto px-5 pb-5", className);
  const targetListCodes = useMemo(
    () => createStockCodeSet(targetStocks),
    [targetStocks],
  );
  const oppositeListCodes = useMemo(
    () => createStockCodeSet(oppositeStocks ?? []),
    [oppositeStocks],
  );
  const resultRows = useMemo<StockImportResultRow[]>(
    () => visibleStocks.map((stock) => {
      const stockCodeKey = getComparableStockCode(stock.code);

      return {
        stock,
        stockCodeKey,
        inTargetList: targetListCodes.has(stockCodeKey),
        inOppositeList: oppositeListCodes.has(stockCodeKey),
        isImporting: importPendingCode === stockCodeKey,
      };
    }),
    [importPendingCode, oppositeListCodes, targetListCodes, visibleStocks],
  );
  const importDisabled = Boolean(importPendingCode);

  if (isLoading && stocks.length === 0) {
    return (
      <div className={containerClassName}>
        <StockImportResultsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClassName}>
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>搜索失败</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      </div>
    );
  }

  if (!hasLoaded) {
    return (
      <div className={containerClassName}>
        <EmptyState className="flex min-h-48 items-center justify-center text-center text-muted-foreground">
          正在加载股票列表
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {resultRows.length > 0 ? (
        <div className="flex w-full flex-col gap-2">
          {resultRows.map((row) => (
            <StockImportResultItem
              key={row.stock.code}
              row={row}
              oppositeList={oppositeList}
              metaLabel={metaLabel}
              importDisabled={importDisabled}
              onImportStock={onImportStock}
            />
          ))}
          {pageCount > 1 ? (
            <div className="flex items-center justify-between border-t border-border/60 px-1 pt-3">
              <span className="text-xs text-muted-foreground">
                共 {total} 条，第 {pageNum}/{pageCount} 页
              </span>
              <Pagination className="mx-0 w-auto justify-end">
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Link
                      isDisabled={pageNum <= 1 || isLoadingMore}
                      aria-label="上一页"
                      className={cn(pageNum <= 1 && "pointer-events-none opacity-50")}
                      onPress={() => onPageChange(pageNum - 1)}
                    >
                      <ChevronLeft data-icon="inline-start" />
                    </Pagination.Link>
                  </Pagination.Item>
                  <Pagination.Item>
                    <Pagination.Link
                      isDisabled={pageNum >= pageCount || isLoadingMore}
                      aria-label="下一页"
                      className={cn(pageNum >= pageCount && "pointer-events-none opacity-50")}
                      onPress={() => onPageChange(pageNum + 1)}
                    >
                      <ChevronRight data-icon="inline-start" />
                    </Pagination.Link>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState className="flex min-h-48 items-center justify-center text-center text-muted-foreground">
          暂无匹配股票
        </EmptyState>
      )}
    </div>
  );
});

const StockImportResultItem = memo(function StockImportResultItem({
  row,
  oppositeList,
  metaLabel,
  importDisabled,
  onImportStock,
}: {
  row: StockImportResultRow;
  oppositeList?: ReturnableListKey;
  metaLabel: string;
  importDisabled: boolean;
  onImportStock: (stock: StockInfo) => void | Promise<void>;
}) {
  const { stock, inTargetList, inOppositeList, isImporting } = row;
  const importTitle = oppositeList ? (inOppositeList ? "移入名单" : "添加到名单") : "添加股票";

  return (
    <Surface
      variant="transparent"
      className="group/stock-item flex w-full flex-nowrap items-center gap-2 rounded-lg border border-border bg-background/45 p-2 [contain-intrinsic-size:64px] [content-visibility:auto]"
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
        {oppositeList && inOppositeList && !inTargetList ? (
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
            className="size-10 rounded-md bg-background/55 md:size-8"
            aria-label={`${importTitle}：${stock.name} ${stock.code}`}
            isDisabled={importDisabled}
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
});

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

function getDailyKWindowSecs(records: StockDailyRecord[]) {
  const visibleRecords = records.slice(-dailyKVisibleDays);

  if (visibleRecords.length <= 1) {
    return daySecs * dailyKVisibleDays;
  }

  return daySecs * dailyKVisibleDays;
}
