import type { StockCandidate, StockDailyRecord, StockListKey } from "@/types/stock";

const dayMs = 24 * 60 * 60 * 1000;

const listLabels: Record<StockListKey, string> = {
  initial: "待选",
  selected: "已选",
  whitelist: "白名单",
  blacklist: "黑名单",
};

const stockSeeds = [
  {
    code: "300750",
    name: "宁德时代",
    list: "initial",
    base: 198.4,
    trend: 0.74,
    volatility: 3.8,
    reason: "放量突破 20 日高点",
  },
  {
    code: "601138",
    name: "工业富联",
    list: "initial",
    base: 38.6,
    trend: 0.28,
    volatility: 1.35,
    reason: "算力链成交持续放大",
  },
  {
    code: "300308",
    name: "中际旭创",
    list: "initial",
    base: 167.2,
    trend: 0.91,
    volatility: 4.65,
    reason: "强势整理后重回均线上方",
  },
  {
    code: "600519",
    name: "贵州茅台",
    list: "selected",
    base: 1538,
    trend: -1.6,
    volatility: 18.5,
    reason: "高流动性核心观察标的",
  },
  {
    code: "600036",
    name: "招商银行",
    list: "selected",
    base: 36.8,
    trend: 0.08,
    volatility: 0.7,
    reason: "低波动修复趋势",
  },
  {
    code: "000858",
    name: "五粮液",
    list: "whitelist",
    base: 146.2,
    trend: -0.16,
    volatility: 2.1,
    reason: "估值回落到跟踪区间",
  },
  {
    code: "002371",
    name: "北方华创",
    list: "whitelist",
    base: 341.5,
    trend: 1.24,
    volatility: 7.4,
    reason: "设备订单预期稳定",
  },
  {
    code: "002594",
    name: "比亚迪",
    list: "blacklist",
    base: 226.3,
    trend: -0.58,
    volatility: 4.2,
    reason: "短线跌破跟踪止损位",
  },
  {
    code: "000001",
    name: "平安银行",
    list: "blacklist",
    base: 10.3,
    trend: -0.03,
    volatility: 0.24,
    reason: "量能不足，暂不跟踪",
  },
  {
    code: "688999",
    name: "缺失样例",
    list: "initial",
    base: 0,
    trend: 0,
    volatility: 0,
    reason: "模拟后端返回无数据",
    noData: true,
  },
] satisfies Array<{
  code: string;
  name: string;
  list: StockListKey;
  base: number;
  trend: number;
  volatility: number;
  reason: string;
  noData?: boolean;
}>;

export const mockStockGroups = stockSeeds.reduce(
  (groups, seed, index) => {
    groups[seed.list].push({
      code: seed.code,
      name: seed.name,
      list: seed.list,
      records: seed.noData
        ? [createNoDataRecord(seed.code, seed.name)]
        : createHistory(seed, index + 3),
      reason: seed.reason,
    });

    return groups;
  },
  {
    initial: [],
    selected: [],
    whitelist: [],
    blacklist: [],
  } as Record<StockListKey, StockCandidate[]>,
);

export const stockListMeta = {
  initial: {
    label: listLabels.initial,
    description: "候选待加入",
  },
  selected: {
    label: listLabels.selected,
    description: "行情图表来源",
  },
  whitelist: {
    label: listLabels.whitelist,
    description: "可加入已选",
  },
  blacklist: {
    label: listLabels.blacklist,
    description: "可加入已选",
  },
} satisfies Record<StockListKey, { label: string; description: string }>;

function createHistory(
  seed: (typeof stockSeeds)[number],
  salt: number,
): StockDailyRecord[] {
  const dates = recentBusinessDates(28);
  let previousClose = roundPrice(seed.base * (0.985 + salt * 0.002));

  return dates.map((date, index) => {
    const cycle = Math.sin((index + salt) * 0.78) * seed.volatility;
    const secondaryCycle = Math.cos((index + salt) * 0.37) * seed.volatility * 0.38;
    const close = roundPrice(seed.base + seed.trend * index + cycle + secondaryCycle);
    const open = roundPrice(previousClose + Math.sin(index + salt * 1.7) * seed.volatility * 0.28);
    const high = roundPrice(Math.max(open, close) + seed.volatility * (0.36 + ((index + salt) % 5) * 0.08));
    const low = roundPrice(Math.max(0.01, Math.min(open, close) - seed.volatility * (0.3 + ((index + salt) % 4) * 0.07)));
    const volume = Math.round((880_000 + (index + 1) * 42_000 + salt * 55_000) * (1 + Math.abs(Math.sin(index + salt)) * 0.55));
    const amount = Math.round(volume * close * 100);
    const limitPct = 10;

    const record: StockDailyRecord = {
      code: seed.code,
      name: seed.name,
      date,
      open,
      high,
      low,
      close,
      volume,
      amount,
      last: previousClose,
      limit_up: roundPrice(previousClose * (1 + limitPct / 100)),
      limit_down: roundPrice(previousClose * (1 - limitPct / 100)),
      limit_pct: limitPct,
      status: "成功",
    };

    previousClose = close;
    return record;
  });
}

function createNoDataRecord(code: string, name: string): StockDailyRecord {
  return {
    code,
    name,
    date: formatDate(new Date()),
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    volume: 0,
    amount: 0,
    status: "无数据",
    error: "mock: 后端暂无该股票行情",
  };
}

function recentBusinessDates(count: number) {
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setHours(15, 0, 0, 0);

  while (dates.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(formatDate(cursor));
    }
    cursor.setTime(cursor.getTime() - dayMs);
  }

  return dates.reverse();
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}
