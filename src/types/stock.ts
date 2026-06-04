import type { StrategyScanResult } from "@/lib/stock-api";

export type StockDataStatus = "成功" | "无数据";

export type StockListKey = "initial" | "candidate" | "selected" | "whitelist" | "blacklist";

export interface StockDailyRecord {
  code: string;
  name: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
  last?: number;
  limit_up?: number;
  limit_down?: number;
  limit_pct?: number;
  status: StockDataStatus;
  error?: string;
}

export interface StockCandidate {
  code: string;
  name: string;
  list: StockListKey;
  records: StockDailyRecord[];
  filterId?: number;
  selectionBatchId?: number;
  selectionRecordId?: number;
  strategyResult?: StrategyScanResult;
}
