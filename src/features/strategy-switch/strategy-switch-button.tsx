import { type FormEvent, type ReactNode, useEffect, useReducer, useState } from "react";
import {
  RiAddLine as Plus,
  RiCheckboxCircleLine as CheckCircle2,
  RiDeleteBinLine as Trash2,
  RiEdit2Line as Edit,
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
  | { type: "name"; value: string }
  | { type: "enabled"; value: boolean }
  | { type: "rule2"; value: boolean }
  | { type: "rule3"; value: boolean }
  | { type: "x"; value: string }
  | { type: "y"; value: string };

export type StrategyConfigEditorActions = {
  isSaving: boolean;
};

type StrategyConfigPickerProps = {
  config: StrategyConfig;
  configs?: StrategyConfig[];
  configsLoading?: boolean;
  deletePendingId?: number | null;
  className?: string;
  contentClassName?: string;
  onSelect?: (config: StrategyConfig) => void;
  onCreate: () => void;
  onEdit: (config: StrategyConfig) => void;
  onRequestDelete?: (config: StrategyConfig) => void;
};

type StrategyConfigEditorProps = {
  config: StrategyConfig;
  savePending?: boolean;
  className?: string;
  contentClassName?: string;
  onSave: (config: StrategyConfig) => void | Promise<void>;
  onSaved?: (config: StrategyConfig) => void;
  renderFooter?: (actions: StrategyConfigEditorActions) => ReactNode;
};

type StrategyConfigEditorModalProps = {
  isOpen: boolean;
  config: StrategyConfig;
  savePending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: StrategyConfig) => void | Promise<void>;
  onSaved?: (config: StrategyConfig) => void;
};

type StrategyDeleteConfirmModalProps = {
  isOpen: boolean;
  target: StrategyConfig | null;
  deletePendingId?: number | null;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: number) => void | Promise<void>;
  onDeleted?: (config: StrategyConfig) => void;
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<StrategyConfig>(config);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StrategyConfig | null>(null);
  const pickerState = useOverlayState({ isOpen: pickerOpen, onOpenChange: handlePickerOpenChange });

  function handlePickerOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setEditorOpen(false);
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }

    setPickerOpen(nextOpen);
  }

  function openEditor(nextConfig: StrategyConfig) {
    setEditingConfig(nextConfig);
    setEditorOpen(true);
  }

  function handleCreate() {
    openEditor(defaultStrategyConfig);
  }

  function handleSelect(nextConfig: StrategyConfig) {
    onSelect?.(nextConfig);
    pickerState.close();
  }

  function handleRequestDelete(nextConfig: StrategyConfig) {
    setDeleteTarget(nextConfig);
    setDeleteConfirmOpen(true);
  }

  return (
    <section className={cn("mt-4 flex justify-center", className)}>
      <Modal state={pickerState}>
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
                  <Modal.Heading className="text-xl text-balance">策略选择</Modal.Heading>
                  <p className="text-sm text-muted-foreground">选择当前扫描配置，也可以新建、修改或删除配置</p>
                </div>
              </Modal.Header>

              <StrategyConfigPicker
                config={config}
                configs={configs}
                configsLoading={configsLoading}
                deletePendingId={deletePendingId}
                contentClassName="flex max-h-[min(72vh,720px)] flex-col gap-4 overflow-y-auto px-5 pb-5"
                onSelect={handleSelect}
                onCreate={handleCreate}
                onEdit={openEditor}
                onRequestDelete={onDelete ? handleRequestDelete : undefined}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <StrategyConfigEditorModal
        isOpen={editorOpen}
        config={editingConfig}
        savePending={savePending}
        onOpenChange={setEditorOpen}
        onSave={onSave}
        onSaved={() => setEditorOpen(false)}
      />
      <StrategyDeleteConfirmModal
        isOpen={deleteConfirmOpen}
        target={deleteTarget}
        deletePendingId={deletePendingId}
        onOpenChange={(nextOpen) => {
          setDeleteConfirmOpen(nextOpen);

          if (!nextOpen) {
            setDeleteTarget(null);
          }
        }}
        onDelete={onDelete}
      />
    </section>
  );
}

export function StrategyConfigPicker({
  config,
  configs = emptyStrategyConfigs,
  configsLoading = false,
  deletePendingId = null,
  className,
  contentClassName,
  onSelect,
  onCreate,
  onEdit,
  onRequestDelete,
}: StrategyConfigPickerProps) {
  const visibleConfigs = configs.length > 0 ? configs : [config];

  return (
    <div className={cn("min-h-0", className)}>
      <div className={cn("flex flex-col gap-4", contentClassName)}>
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
              const deleting = Boolean(item.id && deletePendingId === item.id);

              return (
                <div
                  key={item.id ?? `${item.name}:${index}`}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg border bg-background/45 p-2 transition-[background-color,border-color,box-shadow]",
                    active
                      ? "border-ring bg-secondary/70 shadow-[0_10px_34px_rgba(0,0,0,0.16)] ring-2 ring-ring/25"
                      : "hover:border-border hover:bg-default/60",
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-1 text-left"
                    aria-pressed={active}
                    onClick={() => onSelect?.(item)}
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

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      className="transition-transform active:scale-[0.96]"
                      aria-label={`修改${item.name}`}
                      onClick={() => onEdit(item)}
                    >
                      <Edit className="size-4" />
                    </Button>
                    {item.id && onRequestDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        className="text-destructive transition-transform hover:text-destructive active:scale-[0.96]"
                        aria-label={`删除${item.name}`}
                        isDisabled={deleting}
                        onClick={() => onRequestDelete(item)}
                      >
                        {deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <Button
          type="button"
          variant="outline"
          className="w-full bg-background/55 transition-transform active:scale-[0.96] sm:w-fit"
          onClick={onCreate}
        >
          <Plus data-icon="inline-start" />
          新建配置
        </Button>
      </div>
    </div>
  );
}

export function StrategyConfigEditorModal({
  isOpen,
  config,
  savePending = false,
  onOpenChange,
  onSave,
  onSaved,
}: StrategyConfigEditorModalProps) {
  const modalState = useOverlayState({ isOpen, onOpenChange });
  const isExistingConfig = Boolean(config.id);

  return (
    <Modal state={modalState}>
      <Modal.Trigger className="sr-only" tabIndex={-1} aria-label="打开策略配置表单" />
      <Modal.Backdrop variant="blur">
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header className="p-5 pr-12">
              <div className="flex flex-col gap-2">
                <Modal.Heading className="text-xl text-balance">
                  {isExistingConfig ? "修改策略配置" : "新建策略配置"}
                </Modal.Heading>
                <p className="text-sm text-muted-foreground">设置策略名称、计算参数和规则开关</p>
              </div>
            </Modal.Header>

            <StrategyConfigEditor
              config={config}
              savePending={savePending}
              contentClassName="flex max-h-[min(72vh,720px)] flex-col gap-5 overflow-y-auto px-5 pb-5"
              onSave={onSave}
              onSaved={(savedConfig) => {
                onSaved?.(savedConfig);
                modalState.close();
              }}
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
  );
}

export function StrategyDeleteConfirmModal({
  isOpen,
  target,
  deletePendingId = null,
  onOpenChange,
  onDelete,
  onDeleted,
}: StrategyDeleteConfirmModalProps) {
  const modalState = useOverlayState({ isOpen, onOpenChange });
  const targetId = target?.id;
  const deleting = Boolean(targetId && deletePendingId === targetId);

  async function confirmDelete() {
    if (!target || !target.id || !onDelete) {
      return;
    }

    await onDelete(target.id);
    onDeleted?.(target);
    modalState.close();
  }

  return (
    <Modal state={modalState}>
      <Modal.Trigger className="sr-only" tabIndex={-1} aria-label="打开删除策略确认" />
      <Modal.Backdrop variant="blur" isDismissable={!deleting}>
        <Modal.Container size="sm" scroll="inside">
          <Modal.Dialog className="max-h-[calc(100vh-2rem)] gap-0 overflow-hidden p-0">
            <Modal.Header className="p-5">
              <div className="flex flex-col gap-2">
                <Modal.Heading className="text-xl text-balance">删除策略配置？</Modal.Heading>
                <p className="text-sm leading-6 text-muted-foreground">
                  将删除「{target?.name ?? "当前配置"}」。删除后不可恢复，当前配置被删除后会按后端同步结果切换到可用配置。
                </p>
              </div>
            </Modal.Header>
            <Separator />
            <Modal.Footer className="mx-0 mb-0 rounded-none border-t-0 bg-transparent p-5 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="bg-background/55 transition-transform active:scale-[0.96]"
                isDisabled={deleting}
                slot="close"
              >
                取消
              </Button>
              <Button
                type="button"
                variant="danger"
                className="transition-transform active:scale-[0.96]"
                isDisabled={deleting || !targetId}
                onClick={() => void confirmDelete()}
              >
                {deleting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
                确认删除
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function StrategyConfigEditor({
  config,
  savePending = false,
  className,
  contentClassName,
  onSave,
  onSaved,
  renderFooter,
}: StrategyConfigEditorProps) {
  const [localSavePending, setLocalSavePending] = useState(false);
  const [draft, dispatchDraft] = useReducer(strategyDraftReducer, config);
  const normalizedDraft = normalizeStrategyConfig(draft);
  const isSaving = savePending || localSavePending;
  const actions: StrategyConfigEditorActions = {
    isSaving,
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveDraft();
  }

  return (
    <form className={cn("min-h-0", className)} onSubmit={handleSubmit}>
      <div className={cn("flex flex-col gap-5", contentClassName)}>
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
