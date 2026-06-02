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
const intradayBarsPerDay = 48;
const candleWidthSecs = 2;
const tradingSessionSecs = intradayBarsPerDay * candleWidthSecs;
const mockDaySecs = 120;
const mockTickStepSecs = 0.65;
const initialLiveBarCount = 36;
const weekWindowOffsetSecs = 0.001;
const dayRangeOptions = [
  { id: "day-1", label: "本日", days: 1 },
  { id: "day-2", label: "2日", days: 2 },
  { id: "day-3", label: "3日", days: 3 },
  { id: "day-4", label: "4日", days: 4 },
  { id: "day-5", label: "5日", days: 5 },
  { id: "day-6", label: "6日", days: 6 },
  { id: "day-7", label: "7日", days: 7 },
] as const;
type ChartRangeId = (typeof dayRangeOptions)[number]["id"] | "week";

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
  const [chartRangeId, setChartRangeId] = useState<ChartRangeId>("day-1");
  const [chartMode, setChartMode] = useState<"line" | "candle">("candle");
  const [isLoading, setIsLoading] = useState(true);
  const live = useLiveMockStock(stock, loadingKey, isLoading);
  const records = live.records;
  const latest = records.at(-1);
  const previous = records.at(-2);
  const change = latest && previous ? latest.close - previous.close : 0;
  const changePct = previous ? (change / previous.close) * 100 : 0;
  const liveCandle = live.candles.at(-1);
  const closedCandles = liveCandle ? live.candles.slice(0, -1) : live.candles;
  const chartColor = change >= 0 ? "#22c55e" : "#ef4444";
  const momentum = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const chartRangeOptions = useMemo(() => {
    const weekDays = getCurrentWeekTradingDayCount(records);

    return [
      ...dayRangeOptions.map((option) => ({
        id: option.id,
        label: option.label,
        secs: option.days * mockDaySecs,
      })),
      {
        id: "week" as const,
        label: "本周",
        secs: weekDays * mockDaySecs + weekWindowOffsetSecs,
      },
    ];
  }, [records]);
  const selectedRange = chartRangeOptions.find((option) => option.id === chartRangeId) ?? chartRangeOptions[0];

  useEffect(() => {
    setIsLoading(true);
    const timer = window.setTimeout(() => setIsLoading(false), 520);

    return () => window.clearTimeout(timer);
  }, [stock.code, loadingKey]);

  useEffect(() => {
    setChartRangeId("day-1");
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
              data={latest ? live.lineData : []}
              value={latest?.close ?? 0}
              mode="candle"
              candles={closedCandles}
              liveCandle={liveCandle}
              candleWidth={candleWidthSecs}
              lineMode={chartMode === "line"}
              lineData={live.lineData}
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
                }
              }}
              windowStyle="rounded"
              grid
              scrub
              badge
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
    if (isLoading || sourceRecords.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setLive((current) => advanceLiveSnapshot(current));
    }, 850);

    return () => window.clearInterval(timer);
  }, [isLoading, sourceRecords.length, stock.code, loadingKey]);

  return live;
}

function createLiveSnapshot(records: StockDailyRecord[]) {
  const currentDayStart = Math.floor(Date.now() / 1000) - initialLiveBarCount * candleWidthSecs;
  const baseTime = currentDayStart - (records.length - 1) * mockDaySecs;
  const candles = createIntradayCandles(records, baseTime);

  return {
    records: records.map((record) => ({ ...record })),
    candles,
    lineData: createLineDataFromCandles(candles),
    clock: currentDayStart + initialLiveBarCount * candleWidthSecs,
    currentDayStart,
  };
}

function advanceLiveSnapshot(live: ReturnType<typeof createLiveSnapshot>) {
  const latest = live.records.at(-1);

  if (!latest) {
    return live;
  }

  const previous = live.records.at(-2);
  const previousClose = previous?.close ?? latest.last ?? latest.open;
  const lastCandle = live.candles.at(-1);
  const nextTime = live.clock + mockTickStepSecs;
  const drift = (previousClose - latest.close) * 0.018;
  const noise = latest.close * ((Math.random() - 0.47) * 0.0018);
  const nextClose = roundPrice(clampPrice(latest.close + drift + noise, latest));
  const addedVolume = Math.round(latest.volume * (0.0015 + Math.random() * 0.003));
  const shouldStartNextDay = nextTime >= live.currentDayStart + tradingSessionSecs;

  if (shouldStartNextDay) {
    const nextRecord = createNextLiveRecord(latest, nextClose, addedVolume);
    const nextDayStart = live.currentDayStart + mockDaySecs;
    const nextCandle = createLiveCandle(nextDayStart, nextRecord.open, nextClose, nextRecord);
    const records = [...live.records, nextRecord].slice(-42);
    const candles = [...live.candles, nextCandle].slice(-intradayBarsPerDay * 14);
    const lineData = [
      ...live.lineData,
      { time: nextDayStart, value: nextRecord.open },
      { time: nextDayStart + mockTickStepSecs, value: nextClose },
    ].slice(-2000);

    return {
      records,
      candles,
      lineData,
      clock: nextDayStart + mockTickStepSecs,
      currentDayStart: nextDayStart,
    };
  }

  const shouldStartNextCandle = Boolean(lastCandle && nextTime >= lastCandle.time + candleWidthSecs);

  const nextRecord: StockDailyRecord = {
    ...latest,
    close: nextClose,
    high: roundPrice(Math.max(latest.high, nextClose)),
    low: roundPrice(Math.min(latest.low, nextClose)),
    volume: latest.volume + addedVolume,
    amount: Math.round((latest.volume + addedVolume) * nextClose * 100),
  };
  const records = [...live.records.slice(0, -1), nextRecord];
  const candles = lastCandle && shouldStartNextCandle
    ? [...live.candles, createLiveCandle(lastCandle.time + candleWidthSecs, lastCandle.close, nextClose, nextRecord)]
    : lastCandle
      ? [...live.candles.slice(0, -1), updateLiveCandle(lastCandle, nextClose)]
      : live.candles;
  const lineData = [...live.lineData, { time: nextTime, value: nextClose }].slice(-2000);

  return { records, candles, lineData, clock: nextTime, currentDayStart: live.currentDayStart };
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

function createIntradayCandles(records: StockDailyRecord[], baseTime: number): CandlePoint[] {
  return records.flatMap((record, index) => {
    const dayStart = baseTime + index * mockDaySecs;
    const barCount = index === records.length - 1 ? initialLiveBarCount : intradayBarsPerDay;
    const values = createIntradayClosePath(record, barCount);

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

function createNextLiveRecord(
  latest: StockDailyRecord,
  close: number,
  addedVolume: number,
): StockDailyRecord {
  const volume = Math.max(addedVolume * 12, Math.round(latest.volume * 0.18));

  return {
    ...latest,
    date: nextBusinessDate(latest.date),
    open: latest.close,
    high: roundPrice(Math.max(latest.close, close)),
    low: roundPrice(Math.min(latest.close, close)),
    close,
    volume,
    amount: Math.round(volume * close * 100),
    last: latest.close,
    limit_up: latest.limit_pct ? roundPrice(latest.close * (1 + latest.limit_pct / 100)) : latest.limit_up,
    limit_down: latest.limit_pct ? roundPrice(latest.close * (1 - latest.limit_pct / 100)) : latest.limit_down,
  };
}

function nextBusinessDate(date: string) {
  const cursor = new Date(`${date}T12:00:00`);

  do {
    cursor.setDate(cursor.getDate() + 1);
  } while (cursor.getDay() === 0 || cursor.getDay() === 6);

  return formatDate(cursor);
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
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
