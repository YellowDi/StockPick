import { type FormEvent, type ReactNode, useEffect, useReducer, useState } from "react";
import {
  RiAddLine as Plus,
  RiCheckboxCircleLine as CheckCircle2,
  RiDeleteBinLine as Trash2,
  RiEqualizerLine as SlidersHorizontal,
  RiLoader4Line as LoaderCircle,
} from "@remixicon/react";
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
  Chip,
  useOverlayState,
  type Key,
} from "@heroui/react";

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

export type StrategyConfigEditorActions = {
  draft: StrategyConfig;
  normalizedDraft: StrategyConfig;
  isDirty: boolean;
  isSaving: boolean;
  canDelete: boolean;
  saveDraft: () => Promise<void>;
  deleteDraft: () => Promise<void>;
  restoreDefault: () => void;
};

type StrategyConfigEditorProps = {
  config: StrategyConfig;
  configs?: StrategyConfig[];
  configsLoading?: boolean;
  savePending?: boolean;
  deletePendingId?: number | null;
  className?: string;
  contentClassName?: string;
  showInlineSave?: boolean;
  onSave: (config: StrategyConfig) => void | Promise<void>;
  onSelect?: (config: StrategyConfig) => void;
  onDelete?: (id: number) => void | Promise<void>;
  onSaved?: (config: StrategyConfig) => void;
  onDeleted?: () => void;
  renderFooter?: (actions: StrategyConfigEditorActions) => ReactNode;
};

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
  const [editorVersion, setEditorVersion] = useState(0);
  const modalState = useOverlayState({ isOpen: open, onOpenChange: handleOpenChange });

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setEditorVersion((version) => version + 1);
    }

    setOpen(nextOpen);
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
          <Chip variant="soft" className="hidden sm:inline-flex">
            {config.name}
          </Chip>
        </Button>

        <Modal.Backdrop variant="blur">
          <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl">
              <Modal.CloseTrigger />
              <Modal.Header className="p-5 pr-12">
                <div className="flex flex-col gap-2">
                  <Modal.Heading className="text-xl text-balance">策略配置</Modal.Heading>
                  <p className="text-sm text-muted-foreground">管理后端策略配置，并选择当前扫描使用的配置</p>
                </div>
              </Modal.Header>

              <StrategyConfigEditor
                key={editorVersion}
                config={config}
                configs={configs}
                configsLoading={configsLoading}
                savePending={savePending}
                deletePendingId={deletePendingId}
                contentClassName="flex max-h-[min(72vh,720px)] flex-col gap-5 overflow-y-auto px-5 pb-5"
                onSelect={onSelect}
                onSave={onSave}
                onDelete={onDelete}
                onSaved={() => modalState.close()}
                onDeleted={() => modalState.close()}
                renderFooter={(actions) => (
                  <>
                    <Separator />
                    <Modal.Footer className="mx-0 mb-0 rounded-none border-t-0 bg-transparent p-5 sm:justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-background/55 transition-transform active:scale-[0.96]"
                        slot="close"
                      >
                        取消
                      </Button>
                      <Button
                        type="submit"
                        className="transition-transform active:scale-[0.96]"
                        isDisabled={actions.isSaving}
                      >
                        {actions.isSaving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
                        保存配置
                      </Button>
                    </Modal.Footer>
                  </>
                )}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export function StrategyConfigEditor({
  config,
  configs = emptyStrategyConfigs,
  configsLoading = false,
  savePending = false,
  deletePendingId = null,
  className,
  contentClassName,
  showInlineSave = false,
  onSave,
  onSelect,
  onDelete,
  onSaved,
  onDeleted,
  renderFooter,
}: StrategyConfigEditorProps) {
  const [localSavePending, setLocalSavePending] = useState(false);
  const [draft, dispatchDraft] = useReducer(strategyDraftReducer, config);
  const visibleConfigs = configs.length > 0 ? configs : [config];
  const normalizedDraft = normalizeStrategyConfig(draft);
  const isSaving = savePending || localSavePending;
  const isDirty = isStrategyConfigDirty(draft, config);
  const canDelete = Boolean(draft.id && onDelete);
  const actions: StrategyConfigEditorActions = {
    draft,
    normalizedDraft,
    isDirty,
    isSaving,
    canDelete,
    saveDraft,
    deleteDraft,
    restoreDefault,
  };

  useEffect(() => {
    dispatchDraft({ type: "reset", config });
  }, [config]);

  async function saveDraft() {
    setLocalSavePending(true);

    try {
      await onSave(normalizedDraft);
      onSaved?.(normalizedDraft);
    } finally {
      setLocalSavePending(false);
    }
  }

  async function deleteDraft() {
    if (!draft.id || !onDelete) {
      return;
    }

    await onDelete(draft.id);
    onDeleted?.();
  }

  function restoreDefault() {
    dispatchDraft({ type: "restore-default" });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveDraft();
  }

  return (
    <form className={cn("min-h-0", className)} onSubmit={handleSubmit}>
      <div className={cn("flex flex-col gap-5", contentClassName)}>
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
                      : "hover:border-border hover:bg-default/60",
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
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="bg-background/55 transition-transform active:scale-[0.96]"
              onClick={restoreDefault}
            >
              <Plus data-icon="inline-start" />
              新建配置
            </Button>
            {canDelete ? (
              <Button
                type="button"
                variant="outline"
                className="bg-background/55 text-destructive transition-transform hover:text-destructive active:scale-[0.96]"
                isDisabled={deletePendingId === draft.id}
                onClick={() => void deleteDraft()}
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
        </section>

        <section>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="strategy-name">配置名称</Label>
            <Input
              id="strategy-name"
              className="bg-background/55"
              value={draft.name}
              onChange={(event) => dispatchDraft({ type: "name", value: event.target.value })}
            />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold">计算参数</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2">
              <Label id="strategy-x-label" htmlFor="strategy-x">往前推第 X 天</Label>
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

        {showInlineSave ? (
          <section>
            <Button type="submit" className="w-full" isDisabled={isSaving}>
              {isSaving ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <CheckCircle2 data-icon="inline-start" />}
              保存配置
            </Button>
          </section>
        ) : null}
      </div>
      {renderFooter?.(actions)}
    </form>
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
      aria-labelledby={`${id}-label`}
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
      <Switch id={id} size="lg" aria-label={label} isSelected={checked} onChange={onCheckedChange}>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
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

function isStrategyConfigDirty(draft: StrategyConfig, baseline: StrategyConfig) {
  return !areStrategyConfigsEqual(normalizeStrategyConfig(draft), normalizeStrategyConfig(baseline));
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

function areStrategyConfigsEqual(left: StrategyConfig, right: StrategyConfig) {
  return left.id === right.id
    && left.name === right.name
    && left.enabled === right.enabled
    && left.rule2Enabled === right.rule2Enabled
    && left.rule3Enabled === right.rule3Enabled
    && left.x === right.x
    && left.y === right.y;
}

function getStrategyRulesLabel(config: StrategyConfig) {
  const rules = [
    "规则1",
    config.rule2Enabled ? "规则2" : null,
    config.rule3Enabled ? "规则3" : null,
  ].filter(Boolean).join("+");

  return `X=${normalizeStrategyX(config.x)} · Y=${config.y}% · ${rules}`;
}
