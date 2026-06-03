export type StrategyId =
  | "limit-up"
  | "limit-up-break-retrace"
  | "limit-up-pullback-confirm";

export type StrategyConfig = {
  name: string;
  enabled: boolean;
  baseDate: string;
  limitPrice: string;
  ma5Ratio: string;
  strategyId: StrategyId;
};

export const defaultStrategyConfig: StrategyConfig = {
  name: "涨停回踩确认",
  enabled: true,
  baseDate: "today",
  limitPrice: "auto",
  ma5Ratio: "2",
  strategyId: "limit-up-pullback-confirm",
};
