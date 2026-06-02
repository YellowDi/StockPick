import { type FormEvent, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const strategyBaseDateOptions = [
  { id: "today", label: "今天" },
  { id: "prev-1", label: "前一交易日" },
  { id: "prev-2", label: "前二交易日" },
] as const;
const strategyLimitPriceOptions = [
  { id: "auto", label: "自动识别" },
  { id: "ten-percent", label: "10% 涨停" },
  { id: "twenty-percent", label: "20% 涨停" },
] as const;
const strategyMa5RatioOptions = [
  { id: "0", label: "0%" },
  { id: "1", label: "1%" },
  { id: "2", label: "2%" },
  { id: "3", label: "3%" },
] as const;
const strategyOptions = [
  {
    id: "limit-up",
    label: "只看涨停",
    description: "筛选基准日出现涨停的股票",
  },
  {
    id: "limit-up-break-retrace",
    label: "涨停后冲高回落",
    description: "涨停后，下一交易日突破 P 并回落",
  },
  {
    id: "limit-up-pullback-confirm",
    label: "涨停后回踩确认",
    description: "涨停后冲高回落，再观察回踩是否仍保持强势",
  },
] as const;
type StrategyId = (typeof strategyOptions)[number]["id"];
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
export function StrategySwitchButton({
  config,
  onSave,
}: {
  config: StrategyConfig;
  onSave: (config: StrategyConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StrategyConfig>(config);
  const activeStrategy = getStrategyOption(config.strategyId);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(config);
    }

    setOpen(nextOpen);
  }

  function saveStrategy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      ...draft,
      name: draft.name.trim() || defaultStrategyConfig.name,
    });
    setOpen(false);
  }

  return (
    <section className="mt-4 flex justify-center">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-10 bg-card/88 px-4 shadow-[0_12px_42px_rgba(0,0,0,0.14)] backdrop-blur-xl transition-transform active:scale-[0.96]"
            />
          }
        >
            <SlidersHorizontal data-icon="inline-start" />
            策略切换
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {config.enabled ? "启用" : "停用"} · {activeStrategy.label}
            </Badge>
        </DialogTrigger>

        <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl">
          <form onSubmit={saveStrategy}>
            <DialogHeader className="px-5 py-5 pr-12">
              <DialogTitle className="text-xl text-balance">策略切换</DialogTitle>
              <DialogDescription>选择一个筛选逻辑作为当前主策略</DialogDescription>
            </DialogHeader>

            <div className="flex max-h-[min(72vh,720px)] flex-col gap-5 overflow-y-auto px-5 pb-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="flex min-w-0 flex-col gap-2">
                  <Label htmlFor="strategy-name">策略名称</Label>
                  <Input
                    id="strategy-name"
                    className="h-11 bg-background/55"
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.currentTarget.value }))}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="strategy-enabled">是否启用</Label>
                  <div className="flex h-11 min-w-[132px] items-center justify-between gap-3 rounded-md border bg-background/55 px-3">
                    <span className="text-sm">{draft.enabled ? "已启用" : "已停用"}</span>
                    <Switch
                      id="strategy-enabled"
                      checked={draft.enabled}
                      onCheckedChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
                    />
                  </div>
                </div>
              </div>

              <section>
                <h3 className="text-sm font-semibold">基础参数</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <StrategyComboboxField
                    label="基准日"
                    value={draft.baseDate}
                    options={strategyBaseDateOptions}
                    onChange={(baseDate) => setDraft((current) => ({ ...current, baseDate }))}
                  />
                  <StrategyComboboxField
                    label="涨停价 P"
                    value={draft.limitPrice}
                    options={strategyLimitPriceOptions}
                    onChange={(limitPrice) => setDraft((current) => ({ ...current, limitPrice }))}
                  />
                  <StrategyComboboxField
                    label="高于 5 日线比例"
                    value={draft.ma5Ratio}
                    options={strategyMa5RatioOptions}
                    onChange={(ma5Ratio) => setDraft((current) => ({ ...current, ma5Ratio }))}
                  />
                </div>
              </section>

              <fieldset>
                <legend className="text-sm font-semibold">主策略</legend>
                <RadioGroup
                  className="mt-3 gap-2"
                  value={draft.strategyId}
                  onValueChange={(strategyId) => (
                    setDraft((current) => ({ ...current, strategyId: strategyId as StrategyId }))
                  )}
                >
                  {strategyOptions.map((option) => {
                    const selected = draft.strategyId === option.id;
                    const itemId = `strategy-${option.id}`;

                    return (
                      <div
                        key={option.id}
                        className={cn(
                          "flex gap-3 rounded-lg border bg-background/45 p-3 transition-[background-color,border-color,box-shadow]",
                          selected
                            ? "border-ring bg-secondary/70 shadow-[0_10px_34px_rgba(0,0,0,0.16)] ring-2 ring-ring/25"
                            : "hover:border-border hover:bg-accent/60",
                        )}
                      >
                        <RadioGroupItem
                          id={itemId}
                          value={option.id}
                          className="mt-0.5 size-5"
                        />
                        <Label
                          htmlFor={itemId}
                          className="min-w-0 flex-1 cursor-pointer flex-col items-start gap-1 leading-normal"
                        >
                          <span className="block text-sm font-medium text-foreground">
                            {option.label}
                          </span>
                          <span className="block text-sm font-normal text-muted-foreground text-pretty">
                            {option.description}
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </fieldset>

              <section>
                <h3 className="text-sm font-semibold">规则说明</h3>
                <blockquote className="mt-3 rounded-lg bg-background/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
                  冲高：下一交易日最高价突破 P；回落：收盘价低于 P；站上 5 日线：收盘价高于 MA5 指定比例；区间内：收盘价位于基准日最高价和最低价之间。
                </blockquote>
              </section>

              <section>
                <h3 className="text-sm font-semibold">策略预览</h3>
                <p className="mt-3 rounded-lg bg-background/50 px-4 py-3 text-sm leading-6 text-foreground text-pretty">
                  当前策略会筛选：{createStrategyPreview(draft)}
                </p>
              </section>
            </div>

            <Separator />
            <DialogFooter className="mx-0 mb-0 rounded-none border-t-0 bg-transparent px-5 py-5 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="bg-background/55 transition-transform active:scale-[0.96]"
                onClick={() => setDraft(defaultStrategyConfig)}
              >
                恢复默认
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <DialogClose
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-background/55 transition-transform active:scale-[0.96]"
                    />
                  }
                >
                  取消
                </DialogClose>
                <Button type="submit" className="transition-transform active:scale-[0.96]">
                  保存为主策略
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StrategyComboboxField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const comboboxItems = options.map((option) => option.id);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>
      <Combobox
        items={comboboxItems}
        value={value}
        inputValue={getOptionLabel(options, value)}
        itemToStringLabel={(item) => getOptionLabel(options, item)}
        onInputValueChange={(nextValue) => {
          const matchedOption = options.find((option) => option.label === nextValue);
          onChange(matchedOption?.id ?? nextValue);
        }}
        onValueChange={(nextValue) => {
          if (typeof nextValue === "string") {
            onChange(nextValue);
          }
        }}
      >
        <ComboboxInput className="h-11 w-full bg-background/55" showClear />
        <ComboboxContent>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {getOptionLabel(options, item)}
              </ComboboxItem>
            )}
          </ComboboxList>
          <ComboboxEmpty>无匹配，可直接输入</ComboboxEmpty>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

function getStrategyOption(strategyId: StrategyId) {
  return strategyOptions.find((option) => option.id === strategyId) ?? strategyOptions[0];
}

function createStrategyPreview(config: StrategyConfig) {
  const baseDate = getOptionLabel(strategyBaseDateOptions, config.baseDate);
  const limitPriceLabel = getOptionLabel(strategyLimitPriceOptions, config.limitPrice);
  const limitPrice = config.limitPrice === "auto" || limitPriceLabel === "自动识别"
    ? "自动识别的涨停价"
    : limitPriceLabel.includes("涨停") || limitPriceLabel.includes("价")
      ? limitPriceLabel
      : `${limitPriceLabel}涨停价`;
  const ma5Ratio = getOptionLabel(strategyMa5RatioOptions, config.ma5Ratio);

  if (config.strategyId === "limit-up") {
    return `${baseDate}出现涨停的股票。`;
  }

  if (config.strategyId === "limit-up-break-retrace") {
    return `${baseDate}出现涨停的股票；下一交易日最高价突破${limitPrice}后回落。`;
  }

  return `${baseDate}出现涨停的股票；下一交易日最高价突破${limitPrice}后回落；再下一交易日收盘价高于 5 日线 ${ma5Ratio}，并且收盘价位于${baseDate}的最高价和最低价之间。`;
}

function getOptionLabel(
  options: readonly { id: string; label: string }[],
  id: string,
) {
  return options.find((option) => option.id === id)?.label ?? id;
}
