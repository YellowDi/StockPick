import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  ChartCandlestick,
  CheckCircle2,
  Database,
  ListFilter,
  LineChart,
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
const daySecs = 24 * 60 * 60;
const candleWidthSecs = 6.5 * 60 * 60;
const chartWindows = [
  { label: "6日", secs: 6 * daySecs },
  { label: "12日", secs: 12 * daySecs },
  { label: "20日", secs: 20 * daySecs },
  { label: "全部", secs: 36 * daySecs },
];

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
  const [windowSecs, setWindowSecs] = useState(chartWindows[0].secs);
  const [chartMode, setChartMode] = useState<"line" | "candle">("candle");
  const [isLoading, setIsLoading] = useState(true);
  const records = stock.records.filter((record) => record.status === "成功");
  const latest = records.at(-1);
  const previous = records.at(-2);
  const change = latest && previous ? latest.close - previous.close : 0;
  const changePct = previous ? (change / previous.close) * 100 : 0;
  const chartData = toLivelinePoints(records);
  const candles = toCandles(records);
  const liveCandle = candles.at(-1);
  const closedCandles = liveCandle ? candles.slice(0, -1) : candles;
  const chartColor = change >= 0 ? "#22c55e" : "#ef4444";
  const momentum = change > 0 ? "up" : change < 0 ? "down" : "flat";

  useEffect(() => {
    setIsLoading(true);
    const timer = window.setTimeout(() => setIsLoading(false), 520);

    return () => window.clearTimeout(timer);
  }, [stock.code, loadingKey]);

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
          <div className="flex rounded-md border bg-background/55 p-0.5">
            <Button
              type="button"
              variant={chartMode === "line" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              aria-pressed={chartMode === "line"}
              onClick={() => setChartMode("line")}
            >
              <LineChart data-icon="inline-start" />
              线
            </Button>
            <Button
              type="button"
              variant={chartMode === "candle" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              aria-pressed={chartMode === "candle"}
              onClick={() => setChartMode("candle")}
            >
              <ChartCandlestick data-icon="inline-start" />
              K
            </Button>
          </div>
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
              data={latest ? chartData : []}
              value={latest?.close ?? 0}
              mode="candle"
              candles={closedCandles}
              liveCandle={liveCandle}
              candleWidth={candleWidthSecs}
              lineMode={chartMode === "line"}
              lineData={chartData}
              lineValue={latest?.close}
              theme="dark"
              color={chartColor}
              window={windowSecs}
              windows={chartWindows}
              onWindowChange={setWindowSecs}
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
              <h2 className="text-sm font-medium">最近 5 日</h2>
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
              {records.slice(-5).map((record) => (
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

function toLivelinePoints(records: StockDailyRecord[]): LivelinePoint[] {
  return records.flatMap((record) => {
    const openTime = toMarketOpenTime(record.date);
    const midHighFirst = record.close >= record.open;
    const firstSwing = midHighFirst ? record.high : record.low;
    const secondSwing = midHighFirst ? record.low : record.high;

    return [
      { time: openTime, value: record.open },
      { time: openTime + 90 * 60, value: firstSwing },
      { time: openTime + 240 * 60, value: secondSwing },
      { time: openTime + candleWidthSecs, value: record.close },
    ];
  });
}

function toCandles(records: StockDailyRecord[]): CandlePoint[] {
  return records.map((record) => ({
    time: toMarketOpenTime(record.date),
    open: record.open,
    high: record.high,
    low: record.low,
    close: record.close,
  }));
}

function toMarketOpenTime(date: string) {
  return Math.floor(new Date(`${date}T09:30:00`).getTime() / 1000);
}

function formatChartTime(time: number) {
  const date = new Date(time * 1000);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${month}-${day}`;
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

export default App;
