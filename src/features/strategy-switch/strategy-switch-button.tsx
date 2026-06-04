import { type FormEvent, useReducer, useState } from "react";
import {
  Button,
  Input,
  InputGroup,
  Label,
  ListBox,
  Modal,
  Select,
  Separator,
  Switch,
  Tag,
  useOverlayState,
  type Key,
} from "@heroui/react";
import { CheckCircle2, LoaderCircle, Plus, SlidersHorizontal, Trash2 } from "lucide-react";

import { defaultStrategyConfig, type StrategyConfig } from "@/features/strategy-switch/strategy-config";
import { cn } from "@/lib/utils";

const emptyStrategyConfigs: StrategyConfig[] = [];
const strategyXOptions = Array.from({ length: 8 }, (_, value) => value);

type StrategyDraftAction =
  | { type: "reset"; config: StrategyConfig }
  | { type: "restore-default" }
  | { type: "name"; value: string }
  | { type: "enabled"; value: boolean }
  | { type: "rule2"; value: boolean }
  | { type: "rule3"; value: boolean }
  | { type: "x"; value: string }
  | { type: "y"; value: string };

export function StrategySwitchButton({
  config,
  configs = emptyStrategyConfigs,
  configsLoading = false,
  savePending = false,
  deletePendingId = null,
  className,
  buttonClassName,
  onSave,
  onSelect,
  onDelete,
}: {
  config: StrategyConfig;
  configs?: StrategyConfig[];
  configsLoading?: boolean;
  savePending?: boolean;
  deletePendingId?: number | null;
  className?: string;
  buttonClassName?: string;
  onSave: (config: StrategyConfig) => void | Promise<void>;
  onSelect?: (config: StrategyConfig) => void;
  onDelete?: (id: number) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [localSavePending, setLocalSavePending] = useState(false);
  const [draft, dispatchDraft] = useReducer(strategyDraftReducer, config);
  const modalState = useOverlayState({ isOpen: open, onOpenChange: handleOpenChange });
  const isSaving = savePending || localSavePending;
  const visibleConfigs = configs.length > 0 ? configs : [config];

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      dispatchDraft({ type: "reset", config });
    }

    setOpen(nextOpen);
  }

  async function saveStrategy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalSavePending(true);

    try {
      await onSave(normalizeStrategyConfig(draft));
      modalState.close();
    } finally {
      setLocalSavePending(false);
    }
  }

  async function deleteStrategy() {
    if (!draft.id || !onDelete) {
      return;
    }

    await onDelete(draft.id);
    modalState.close();
  }

  return (
    <section className={cn("mt-4 flex justify-center", className)}>
      <Modal state={modalState}>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 bg-card/88 px-4 shadow-[0_12px_42px_rgba(0,0,0,0.14)] backdrop-blur-xl transition-transform active:scale-[0.96]",
            buttonClassName,
          )}
        >
          <SlidersHorizontal data-icon="inline-start" />
          策略切换
          <Tag variant="surface" className="hidden sm:inline-flex">
            {config.enabled ? "启用" : "停用"} · {getStrategyRulesLabel(config)}
          </Tag>
        </Button>

        <Modal.Backdrop variant="blur">
          <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl">
              <Modal.CloseTrigger />
              <form onSubmit={saveStrategy}>
                <Modal.Header className="p-5 pr-12">
                  <div className="flex flex-col gap-2">
                    <Modal.Heading className="text-xl text-balance">策略配置</Modal.Heading>
                    <p className="text-sm text-muted-foreground">管理后端策略配置，并选择当前扫描使用的配置</p>
                  </div>
                </Modal.Header>

                <div className="flex max-h-[min(72vh,720px)] flex-col gap-5 overflow-y-auto px-5 pb-5">
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">配置列表</h3>
                  {configsLoading ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <LoaderCircle className="size-3.5 animate-spin" />
                      加载中
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground tabular-nums">{visibleConfigs.length}</span>
                  )}
                </div>
                <div className="grid gap-2">
                  {visibleConfigs.map((item, index) => {
                    const active = isSameStrategyConfig(item, config);

                    return (
                      <button
                        key={item.id ?? `${item.name}:${index}`}
                        type="button"
                        className={cn(
                          "flex min-w-0 items-center gap-3 rounded-lg border bg-background/45 p-3 text-left transition-[background-color,border-color,box-shadow]",
                          active
                            ? "border-ring bg-secondary/70 shadow-[0_10px_34px_rgba(0,0,0,0.16)] ring-2 ring-ring/25"
                            : "hover:border-border hover:bg-accent/60",
                        )}
                        aria-pressed={active}
                        onClick={() => {
                          dispatchDraft({ type: "reset", config: item });
                          onSelect?.(item);
                        }}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background/70 text-muted-foreground">
                          {active ? <CheckCircle2 className="size-4 text-primary" /> : <SlidersHorizontal className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {item.enabled ? "启用" : "停用"} · {getStrategyRulesLabel(item)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="flex min-w-0 flex-col gap-2">
                  <Label htmlFor="strategy-name">配置名称</Label>
                  <Input
                    id="strategy-name"
                    className="bg-background/55"
                    value={draft.name}
                    onChange={(event) => dispatchDraft({ type: "name", value: event.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="strategy-enabled">是否启用</Label>
                  <div className="flex h-8 min-w-[132px] items-center justify-between gap-3 rounded-md border bg-background/55 px-3">
                    <span className="text-sm">{draft.enabled ? "已启用" : "已停用"}</span>
                    <Switch
                      id="strategy-enabled"
                      aria-label="是否启用"
                      isSelected={draft.enabled}
                      onChange={(value) => dispatchDraft({ type: "enabled", value })}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold">计算参数</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="strategy-x">往前推第 X 天</Label>
                    <StrategyXSelect
                      id="strategy-x"
                      value={normalizeStrategyX(draft.x)}
                      onValueChange={(value) => dispatchDraft({ type: "x", value })}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <Label htmlFor="strategy-y">MA5 百分比偏移</Label>
                    <InputGroup className="bg-background/55">
                      <InputGroup.Input
                        id="strategy-y"
                        type="number"
                        min={0}
                        step={0.1}
                        value={String(draft.y)}
                        onChange={(event) => dispatchDraft({ type: "y", value: event.target.value })}
                      />
                      <InputGroup.Suffix>%</InputGroup.Suffix>
                    </InputGroup>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold">规则开关</h3>
                <div className="mt-3 grid gap-2">
                  <StrategyRuleSwitch
                    id="strategy-rule2"
                    label="规则 2：基准日-1天，冲高比基准日收盘价高，且有回落"
                    checked={draft.rule2Enabled}
                    onCheckedChange={(value) => dispatchDraft({ type: "rule2", value })}
                  />
                  <StrategyRuleSwitch
                    id="strategy-rule3"
                    label="规则 3：基准日-2天收盘价在五日线之上一定百分比，且在基准日的最高点和最低点之间"
                    checked={draft.rule3Enabled}
                    onCheckedChange={(value) => dispatchDraft({ type: "rule3", value })}
                  />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold">策略预览</h3>
                <p className="mt-3 rounded-lg bg-background/50 px-4 py-3 text-sm leading-6 text-foreground text-pretty">
                  当前配置会使用 X={normalizeStrategyX(draft.x)}；
                  {draft.rule2Enabled ? "启用规则 2：基准日-1天，冲高比基准日收盘价高，且有回落" : "停用规则 2"}；
                  {draft.rule3Enabled ? `启用规则 3：基准日-2天收盘价在五日线之上 ${draft.y}%，且在基准日最高点和最低点之间` : "停用规则 3"}。
                </p>
              </section>
                </div>

                <Separator />
                <Modal.Footer className="mx-0 mb-0 rounded-none border-t-0 bg-transparent p-5 sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-background/55 transition-transform active:scale-[0.96]"
                      onClick={() => dispatchDraft({ type: "restore-default" })}
                    >
                      <Plus data-icon="inline-start" />
                      新建配置
                    </Button>
                    {draft.id && onDelete ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-background/55 text-destructive transition-transform hover:text-destructive active:scale-[0.96]"
                        isDisabled={deletePendingId === draft.id}
                        onClick={() => void deleteStrategy()}
                      >
                        {deletePendingId === draft.id ? (
                          <LoaderCircle data-icon="inline-start" className="animate-spin" />
                        ) : (
                          <Trash2 data-icon="inline-start" />
                        )}
                        删除
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-background/55 transition-transform active:scale-[0.96]"
                      slot="close"
                    >
                      取消
                    </Button>
                    <Button type="submit" className="transition-transform active:scale-[0.96]" isDisabled={isSaving}>
                      {isSaving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
                      保存配置
                    </Button>
                  </div>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

function StrategyXSelect({
  id,
  value,
  onValueChange,
}: {
  id: string;
  value: number;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select
      value={String(value)}
      onChange={(nextValue: Key | null) => {
        if (nextValue !== null) {
          onValueChange(String(nextValue));
        }
      }}
    >
      <Select.Trigger
        id={id}
        className="w-full bg-background/55"
      >
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {strategyXOptions.map((option) => {
            const optionValue = String(option);

            return (
            <ListBox.Item key={optionValue} id={optionValue} textValue={option === 0 ? "0 天（今日实时）" : `${option} 天`}>
              {option === 0 ? "0 天（今日实时）" : `${option} 天`}
            </ListBox.Item>
            );
          })}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function StrategyRuleSwitch({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/45 p-3">
      <Label htmlFor={id} className="min-w-0 flex-1 text-sm font-medium">
        {label}
      </Label>
      <Switch id={id} aria-label={label} isSelected={checked} onChange={onCheckedChange} />
    </div>
  );
}

function strategyDraftReducer(
  state: StrategyConfig,
  action: StrategyDraftAction,
): StrategyConfig {
  switch (action.type) {
    case "reset":
      return action.config;
    case "restore-default":
      return defaultStrategyConfig;
    case "name":
      return { ...state, name: action.value };
    case "enabled":
      return { ...state, enabled: action.value };
    case "rule2":
      return { ...state, rule2Enabled: action.value };
    case "rule3":
      return { ...state, rule3Enabled: action.value };
    case "x":
      return { ...state, x: parseNumberInput(action.value, state.x) };
    case "y":
      return { ...state, y: parseNumberInput(action.value, state.y) };
  }

  return state;
}

function normalizeStrategyConfig(config: StrategyConfig): StrategyConfig {
  return {
    ...config,
    name: config.name.trim() || defaultStrategyConfig.name,
    x: normalizeStrategyX(config.x),
    y: Math.max(0, config.y),
  };
}

function normalizeStrategyX(value: number) {
  return Math.min(7, Math.max(0, Math.round(value)));
}

function parseNumberInput(value: string, fallback: number) {
  const nextValue = Number(value);

  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function isSameStrategyConfig(left: StrategyConfig, right: StrategyConfig) {
  if (left.id && right.id) {
    return left.id === right.id;
  }

  return left.name === right.name;
}

function getStrategyRulesLabel(config: StrategyConfig) {
  const rules = [
    "规则1",
    config.rule2Enabled ? "规则2" : null,
    config.rule3Enabled ? "规则3" : null,
  ].filter(Boolean).join("+");

  return `X=${normalizeStrategyX(config.x)} · Y=${config.y}% · ${rules}`;
}
