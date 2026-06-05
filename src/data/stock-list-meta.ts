import type { StockListKey } from "@/types/stock";

const listLabels: Record<StockListKey, string> = {
  initial: "待选",
  candidate: "候选",
  selected: "历史选股",
  whitelist: "红名单",
  blacklist: "黑名单",
};

export const stockListMeta = {
  initial: {
    label: listLabels.initial,
    description: "策略筛选结果",
  },
  candidate: {
    label: listLabels.candidate,
    description: "待保存为选股",
  },
  selected: {
    label: listLabels.selected,
    description: "已保存选股批次",
  },
  whitelist: {
    label: listLabels.whitelist,
    description: "可加入候选",
  },
  blacklist: {
    label: listLabels.blacklist,
    description: "可加入候选",
  },
} satisfies Record<StockListKey, { label: string; description: string }>;
