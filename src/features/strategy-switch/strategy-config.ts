export type StrategyConfig = {
  id?: number;
  name: string;
  enabled: boolean;
  rule2Enabled: boolean;
  rule3Enabled: boolean;
  x: number;
  y: number;
};

export const defaultStrategyConfig: StrategyConfig = {
  name: "涨停回踩确认",
  enabled: true,
  rule2Enabled: true,
  rule3Enabled: true,
  x: 3,
  y: 2,
};
