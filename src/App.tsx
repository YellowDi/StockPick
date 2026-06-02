import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Database,
  ListFilter,
  RefreshCcw,
  ShieldCheck,
  ShieldX,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Liveline, type CandlePoint, type LivelinePoint } from "liveline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { mockStockGroups, stockListMeta } from "@/data/mock-stocks";
import { cn } from "@/lib/utils";
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

const listIcons = {
  initial: ListFilter,
  selected: CheckCircle2,
  whitelist: ShieldCheck,
  blacklist: ShieldX,
} satisfies Record<StockListKey, typeof ListFilter>;

function App() {
  const allStocks = useMemo(() => listOrder.flatMap((key) => mockStockGroups[key]), []);
  const [selectedCode, setSelectedCode] = useState(allStocks[0]?.code ?? "");
  const [loadingKey, setLoadingKey] = useState(0);
  const selectedStock = allStocks.find((stock) => stock.code === selectedCode) ?? allStocks[0];

  function selectStock(code: string) {
    setSelectedCode(code);
    setLoadingKey((key) => key + 1);
  }

  return (
    <main className="min-h-screen px-4 py-4 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-4">
        <StockBoard
          stock={selectedStock}
          loadingKey={loadingKey}
          onReload={() => setLoadingKey((key) => key + 1)}
        />

        <section className="grid gap-4 xl:grid-cols-4">
          {listOrder.map((key) => (
            <StockColumn
              key={key}
              listKey={key}
              stocks={mockStockGroups[key]}
              selectedCode={selectedStock.code}
              onSelect={selectStock}
            />
          ))}
        </section>
      </div>
    </main>
  );
}

function StockBoard({
  stock,
  loadingKey,
  onReload,
}: {
  stock: StockCandidate;
  loadingKey: number;
  onReload: () => void;
}) {
  const [chartRangeId, setChartRangeId] = useState<ChartRangeId>("realtime");
  const [chartMode, setChartMode] = useState<"line" | "candle">("candle");
  const [isLoading, setIsLoading] = useState(true);
  const live = useLiveMockStock(stock, loadingKey, isLoading, chartRangeId === "realtime");
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
  const chartColor = change >= 0 ? "#ef4444" : "#22c55e";
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

  useEffect(() => {
    setIsLoading(true);
    const timer = window.setTimeout(() => setIsLoading(false), 520);

    return () => window.clearTimeout(timer);
  }, [stock.code, loadingKey]);

  useEffect(() => {
    setChartRangeId("realtime");
    setChartMode("candle");
  }, [stock.code]);

  return (
    <Card className="overflow-hidden bg-card/92">
      <CardHeader className="gap-4 lg:flex lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-2xl tracking-normal">{stock.name}</CardTitle>
            <Badge variant="outline">{stock.code}</Badge>
            <Badge variant={latest ? "secondary" : "destructive"}>
              {latest ? "行情正常" : "无数据"}
            </Badge>
          </div>
          <CardDescription className="mt-2">{stock.reason}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TrendBadge change={change} changePct={changePct} />
          <Badge variant="outline">{stockListMeta[stock.list].label}</Badge>
          <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={onReload}>
            <RefreshCcw data-icon="inline-start" className={cn(isLoading && "animate-spin")} />
            {isLoading ? "加载中" : "重载"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[420px] overflow-hidden rounded-lg border bg-background/80 lg:h-[480px]">
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
              onModeChange={(mode) => setChartMode(mode)}
              theme="dark"
              color={chartColor}
              window={selectedRange.secs}
              windows={chartRangeOptions}
              onWindowChange={(secs) => {
                const nextRange = chartRangeOptions.find((option) => option.secs === secs);

                if (nextRange) {
                  setChartRangeId(nextRange.id);
                  setChartMode(nextRange.id === "realtime" || nextRange.id === "today" ? "candle" : "line");
                }
              }}
              windowStyle="rounded"
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
              padding={{ top: 18, right: 82, bottom: 34, left: 14 }}
              className="size-full"
            />
          ) : (
            <EmptyChart error={stock.records[0]?.error} />
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="最新价" value={latest ? latest.close.toFixed(2) : "--"} tone={change >= 0 ? "up" : "down"} loading={isLoading} />
            <Metric label="涨跌幅" value={latest ? `${formatSigned(changePct)}%` : "--"} tone={change >= 0 ? "up" : "down"} loading={isLoading} />
            <Metric label="最高" value={latest ? latest.high.toFixed(2) : "--"} />
            <Metric label="最低" value={latest ? latest.low.toFixed(2) : "--"} />
            <Metric label="成交量" value={latest ? formatVolume(latest.volume) : "--"} />
            <Metric label="成交额" value={latest ? formatAmount(latest.amount) : "--"} />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">最近 7 日</h2>
              <span className="text-xs text-muted-foreground">OHLC</span>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[1.1fr_repeat(4,0.8fr)] bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                <span>日期</span>
                <span className="text-right">开</span>
                <span className="text-right">高</span>
                <span className="text-right">低</span>
                <span className="text-right">收</span>
              </div>
              {records.slice(-7).map((record) => (
                <div
                  key={record.date}
                  className="grid grid-cols-[1.1fr_repeat(4,0.8fr)] border-t px-3 py-2 text-xs"
                >
                  <span className="truncate text-muted-foreground">{record.date.slice(5)}</span>
                  <span className="text-right tabular-nums">{record.open.toFixed(2)}</span>
                  <span className="text-right tabular-nums">{record.high.toFixed(2)}</span>
                  <span className="text-right tabular-nums">{record.low.toFixed(2)}</span>
                  <span className={cn("text-right tabular-nums", record.close >= record.open ? "text-stock-up" : "text-stock-down")}>
                    {record.close.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </CardContent>
    </Card>
  );
}

function useLiveMockStock(
  stock: StockCandidate,
  loadingKey: number,
  isLoading: boolean,
  shouldStream: boolean,
) {
  const sourceRecords = useMemo(
    () => stock.records.filter((record) => record.status === "成功"),
    [stock],
  );
  const [live, setLive] = useState(() => createLiveSnapshot(sourceRecords));

  useEffect(() => {
    setLive(createLiveSnapshot(sourceRecords));
  }, [sourceRecords, stock.code, loadingKey]);

  useEffect(() => {
    if (isLoading || !shouldStream || sourceRecords.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setLive((current) => advanceLiveSnapshot(current));
    }, 850);

    return () => window.clearInterval(timer);
  }, [isLoading, shouldStream, sourceRecords.length, stock.code, loadingKey]);

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
  onSelect,
}: {
  listKey: StockListKey;
  stocks: StockCandidate[];
  selectedCode: string;
  onSelect: (code: string) => void;
}) {
  const Icon = listIcons[listKey];
  const meta = stockListMeta[listKey];

  return (
    <Card className="min-h-[360px] bg-card/84">
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
            active={stock.code === selectedCode}
            onClick={() => onSelect(stock.code)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function StockListButton({
  stock,
  active,
  onClick,
}: {
  stock: StockCandidate;
  active: boolean;
  onClick: () => void;
}) {
  const latest = latestSuccessRecord(stock);
  const previous = previousSuccessRecord(stock);
  const changePct = latest && previous ? ((latest.close - previous.close) / previous.close) * 100 : 0;
  const positive = changePct >= 0;

  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      className={cn(
        "h-auto justify-start rounded-lg border px-3 py-3 text-left",
        active ? "border-ring bg-secondary" : "border-transparent bg-background/40 hover:border-border",
      )}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate font-medium">{stock.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{stock.code}</span>
        </span>
        <span className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate text-muted-foreground">{stock.reason}</span>
          {latest ? (
            <span className={cn("shrink-0 tabular-nums", positive ? "text-stock-up" : "text-stock-down")}>
              {formatSigned(changePct)}%
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 text-destructive">
              <Ban className="size-3" />
              无数据
            </span>
          )}
        </span>
      </span>
    </Button>
  );
}

function Metric({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background/55 px-3 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          loading && "animate-pulse",
          tone === "up" && "text-stock-up",
          tone === "down" && "text-stock-down",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TrendBadge({ change, changePct }: { change: number; changePct: number }) {
  const positive = change >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;

  return (
    <Badge variant="outline" className={cn(positive ? "text-stock-up" : "text-stock-down")}>
      <Icon className="mr-1 size-3" />
      {formatSigned(change)} / {formatSigned(changePct)}%
    </Badge>
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
    const indices = history
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => !weekStart || new Date(`${record.date}T12:00:00`) >= weekStart)
      .map(({ index }) => index)
      .slice(-7);
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

  for (let index = 0; index < count; index++) {
    const rightAnchorIndex = anchors.findIndex((anchor) => anchor.index >= index);
    const right = anchors[Math.max(0, rightAnchorIndex)];
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

export default App;
