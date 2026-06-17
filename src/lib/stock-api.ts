import { apiBaseUrl } from "./api-base-url";
import { ApiError, getStoredAuthToken, isAuthFailureStatus, notifyAuthExpired } from "./auth-api";

export type StockInfo = {
  code: string;
  name: string;
};

export type StockFilterListType = "white" | "black";

export type StockFilter = {
  id: number;
  code: string;
  name: string;
  listType: StockFilterListType;
  groupId?: number;
};

export type StockFilterGroup = {
  groupId: number;
  listType: StockFilterListType;
  name: string;
};

export type AddStockFilterRequest = {
  code: string;
  name: string;
  listType: StockFilterListType;
  groupId?: number;
};

export type AddManualSelectionRequest = {
  batchId: number;
  code: string;
  name: string;
};

export type ImportStockFiltersRequest = {
  file: File;
  listType: StockFilterListType;
  groupId?: number;
};

export type ImportStockFiltersResponse = {
  errors: string[];
};

export type SetStockFilterGroupRequest = {
  listType: StockFilterListType;
  name: string;
  groupId?: number;
};

export type DailyKline = {
  amount?: number;
  close?: number;
  code?: string;
  date?: string;
  error?: string;
  high?: number;
  last?: number;
  limit_down?: number;
  limit_pct?: number;
  limit_up?: number;
  low?: number;
  name?: string;
  open?: number;
  status?: string;
  trade_date?: string;
  volume?: number;
};

export type StrategyScanRequest = {
  config_id: number;
};

export type StrategyScanResult = {
  code?: string;
  highlight?: boolean;
  klines?: DailyKline[];
  limit_up_price?: number;
  matched?: boolean;
  matched_rules?: number[];
  name?: string;
  rule1_limit_up?: boolean;
  rule2_surge_fall?: boolean;
  rule3_above_ma5_in_range?: boolean;
  x1_close?: number;
  x1_high?: number;
  x2_close?: number;
  x2_ma5?: number;
  x2_ma5_pct?: number;
  x_close?: number;
  x_date?: string;
  x_high?: number;
  x_low?: number;
};

export type StrategyConfigDto = {
  id?: number;
  name?: string;
  enabled?: boolean;
  rule2_enabled?: boolean;
  rule3_enabled?: boolean;
  x?: number;
  y?: number;
};

export type SelectionBatch = {
  id: number;
  name: string;
  created_at?: string;
  strategy_config_id?: number;
  total?: number;
};

export type SelectionRecord = StrategyScanResult & {
  id?: number;
  batch_id?: number;
  created_at?: string;
};

export type SelectionBatchListRequest = {
  start_time?: string;
  end_time?: string;
  page_num?: number;
  page_size?: number;
};

export type SelectionRecordListRequest = {
  batch_id: number;
  page_num?: number;
  page_size?: number;
};

export type PagedResponse<T> = {
  list: T[];
  page_num: number;
  page_size: number;
  total: number;
};

export type StockListRequest = {
  code?: string;
  name?: string;
  page_num?: number;
  page_size?: number;
};

export async function listStocks(request?: StockListRequest, signal?: AbortSignal): Promise<PagedResponse<StockInfo>> {
  const url = new URL(`${apiBaseUrl}/stock/list`, window.location.origin);

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        ...createAuthHeaders(token),
        "Content-Type": "application/json",
      },
      body: request ? JSON.stringify(request) : undefined,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error("无法连接股票列表接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "股票列表加载失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "股票列表加载失败。", response.status);
  }

  return getStockListPaged(payload);
}

export async function listStockFilters(
  type: StockFilterListType,
  signal?: AbortSignal,
  groupId?: number,
): Promise<StockFilter[]> {
  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/filter`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify(createStockFilterListRequestBody(type, groupId)),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error("无法连接名单接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "名单加载失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "名单加载失败。", response.status);
  }

  return getStockFilters(payload, type);
}

export async function listStockFilterGroups(
  type: StockFilterListType,
  signal?: AbortSignal,
): Promise<StockFilterGroup[]> {
  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/filter/group/list`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify(createStockFilterGroupListRequestBody(type)),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error("无法连接名单分组接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "名单分组加载失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "名单分组加载失败。", response.status);
  }

  return getStockFilterGroups(payload, type);
}

export async function setStockFilterGroup(request: SetStockFilterGroupRequest): Promise<void> {
  const name = request.name.trim();

  if (!name) {
    throw new Error("分组名称不能为空。");
  }

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/filter/group/set`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify({
        ...(typeof request.groupId === "number" && Number.isFinite(request.groupId) && request.groupId > 0
          ? { group_id: request.groupId }
          : {}),
        list_type: request.listType,
        name,
      }),
    });
  } catch {
    throw new Error("无法连接保存名单分组接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "保存名单分组失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "保存名单分组失败。", response.status);
  }
}

export async function deleteStockFilterGroup(groupId: number): Promise<void> {
  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error("分组ID无效。");
  }

  const url = new URL(`${apiBaseUrl}/strategy/filter/group/delete`, window.location.origin);

  url.searchParams.set("group_id", String(groupId));

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(url, {
      method: "POST",
      headers: createAuthHeaders(token),
    });
  } catch {
    throw new Error("无法连接删除名单分组接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "删除名单分组失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "删除名单分组失败。", response.status);
  }
}

export async function addStockFilter(request: AddStockFilterRequest): Promise<void> {
  const code = request.code.trim();
  const name = request.name.trim();

  if (!code) {
    throw new Error("股票代码不能为空。");
  }

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/filter/add`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify({
        code,
        ...(typeof request.groupId === "number" && Number.isFinite(request.groupId) && request.groupId > 0
          ? { group_id: request.groupId }
          : {}),
        name,
        list_type: request.listType,
      }),
    });
  } catch {
    throw new Error("无法连接添加名单接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "添加名单失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "添加名单失败。", response.status);
  }
}

export async function deleteStockFilter(id: number): Promise<void> {
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("记录ID无效。");
  }

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/filter/${id}/delete`, {
      method: "POST",
      headers: createAuthHeaders(token),
    });
  } catch {
    throw new Error("无法连接删除名单接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "删除名单失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "删除名单失败。", response.status);
  }
}

export async function importStockFilters(
  request: ImportStockFiltersRequest,
): Promise<ImportStockFiltersResponse> {
  if (request.file.size <= 0) {
    throw new Error("Excel文件不能为空。");
  }

  const formData = new FormData();

  formData.append("file", request.file);
  formData.append("list_type", request.listType);
  formData.append("mode", "incremental");
  if (typeof request.groupId === "number" && Number.isFinite(request.groupId) && request.groupId > 0) {
    formData.append("group_id", String(request.groupId));
  }

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/filter/import`, {
      method: "POST",
      headers: createAuthHeaders(token),
      body: formData,
    });
  } catch {
    throw new Error("无法连接导入名单接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "Excel导入失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "Excel导入失败。", response.status);
  }

  return getImportStockFiltersResponse(payload);
}

export async function scanStrategy(
  request: StrategyScanRequest,
  signal?: AbortSignal,
): Promise<StrategyScanResult[]> {
  if (!Number.isFinite(request.config_id) || request.config_id <= 0) {
    throw new Error("策略配置ID无效。");
  }

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/scan`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify({ config_id: request.config_id }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error("无法连接策略扫描接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "策略扫描失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "策略扫描失败。", response.status);
  }

  return getStrategyScanResults(payload);
}

export async function listStrategyConfigs(signal?: AbortSignal): Promise<StrategyConfigDto[]> {
  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/config`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify({ page_num: 1, page_size: 200 }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error("无法连接策略配置接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "策略配置加载失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "策略配置加载失败。", response.status);
  }

  return getStrategyConfigs(payload);
}

export async function createStrategyConfig(config: StrategyConfigDto): Promise<StrategyConfigDto> {
  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/config/create`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify(createStrategyConfigRequestBody(config)),
    });
  } catch {
    throw new Error("无法连接创建策略配置接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "创建策略配置失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "创建策略配置失败。", response.status);
  }

  return getStrategyConfig(payload) ?? config;
}

export async function updateStrategyConfig(id: number, config: StrategyConfigDto): Promise<void> {
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("策略配置ID无效。");
  }

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/config/${id}/update`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify(createStrategyConfigRequestBody(config)),
    });
  } catch {
    throw new Error("无法连接更新策略配置接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "更新策略配置失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "更新策略配置失败。", response.status);
  }
}

export async function deleteStrategyConfig(id: number): Promise<void> {
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("策略配置ID无效。");
  }

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/config/${id}/delete`, {
      method: "POST",
      headers: createAuthHeaders(token),
    });
  } catch {
    throw new Error("无法连接删除策略配置接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "删除策略配置失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "删除策略配置失败。", response.status);
  }
}

export async function addSelection(results: StrategyScanResult[]): Promise<void> {
  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/selection/add`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify({ results }),
    });
  } catch {
    throw new Error("无法连接添加选股批次接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "添加选股批次失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "添加选股批次失败。", response.status);
  }
}

export async function addManualSelection(request: AddManualSelectionRequest): Promise<void> {
  const batchId = request.batchId;
  const code = request.code.trim();
  const name = request.name.trim();

  if (!Number.isFinite(batchId) || batchId <= 0) {
    throw new Error("选股批次ID无效。");
  }

  if (!code) {
    throw new Error("股票代码不能为空。");
  }

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/selection/add/manual`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify({
        results: [
          {
            batch_id: batchId,
            code,
            name,
          },
        ],
      }),
    });
  } catch {
    throw new Error("无法连接手动添加选股接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "手动添加选股失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "手动添加选股失败。", response.status);
  }
}

export async function deleteSelectionBatch(id: number): Promise<void> {
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("选股批次ID无效。");
  }

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/selection/batch/delete`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify({ id }),
    });
  } catch {
    throw new Error("无法连接删除选股批次接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "删除选股批次失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "删除选股批次失败。", response.status);
  }
}

export async function listSelectionBatches(
  request: SelectionBatchListRequest = {},
  signal?: AbortSignal,
): Promise<PagedResponse<SelectionBatch>> {
  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/selection/batch/list`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify(createSelectionBatchListRequestBody(request)),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error("无法连接选股批次列表接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "选股批次列表加载失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "选股批次列表加载失败。", response.status);
  }

  return getSelectionBatchPage(payload);
}

export async function listSelectionRecords(
  request: SelectionRecordListRequest,
  signal?: AbortSignal,
): Promise<PagedResponse<SelectionRecord>> {
  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/selection/record/list`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify(createSelectionRecordListRequestBody(request)),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error("无法连接选股记录列表接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "选股记录列表加载失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "选股记录列表加载失败。", response.status);
  }

  return getSelectionRecordPage(payload);
}

export async function deleteSelectionRecords(ids: number[]): Promise<void> {
  const recordIds = ids.filter((id) => Number.isFinite(id) && id > 0);

  if (recordIds.length === 0) {
    throw new Error("选股记录ID无效。");
  }

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/selection/record/delete`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify({ ids: recordIds }),
    });
  } catch {
    throw new Error("无法连接删除选股记录接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "删除选股记录失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "删除选股记录失败。", response.status);
  }
}

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function getStockListPaged(payload: unknown): PagedResponse<StockInfo> {
  if (!isRecord(payload)) {
    return { list: [], page_num: 1, page_size: 0, total: 0 };
  }

  // 后端返回格式: { code, msg, data: { list: [...], page_num, page_size, total } }
  // 也可能直接是: { list: [...], page_num, page_size, total }
  let rawData: unknown[] = [];
  let pageInfo: Record<string, unknown> = payload;

  if (isRecord(payload.data)) {
    // 嵌套格式: payload.data.list
    pageInfo = payload.data;
    if (Array.isArray(payload.data.list)) {
      rawData = payload.data.list;
    }
  } else if (Array.isArray(payload.data)) {
    // 直接格式: payload.data 是数组
    rawData = payload.data;
  } else if (Array.isArray(payload.list)) {
    // 直接格式: payload.list
    rawData = payload.list;
  }

  const list = rawData.flatMap((item: unknown) => {
    if (!isRecord(item)) {
      return [];
    }

    const code = typeof item.code === "string" ? item.code.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";

    return code ? [{ code, name: name || code }] : [];
  });

  const page_num = typeof pageInfo.page_num === "number" ? pageInfo.page_num : 1;
  const page_size = typeof pageInfo.page_size === "number" ? pageInfo.page_size : list.length;
  const total = typeof pageInfo.total === "number" ? pageInfo.total : list.length;

  return { list, page_num, page_size, total };
}

function getStockFilters(payload: unknown, requestedType: StockFilterListType) {
  const list = getPayloadCollection(payload);

  return list.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const code = typeof item.code === "string" ? item.code.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const id = typeof item.id === "number" ? item.id : 0;
    const groupId = typeof item.group_id === "number" && Number.isFinite(item.group_id) && item.group_id > 0
      ? item.group_id
      : undefined;
    const listType = item.list_type === "black" || item.list_type === "white"
      ? item.list_type
      : requestedType;

    return code ? [{ id, code, name: name || code, listType, groupId }] : [];
  });
}

function getStockFilterGroups(payload: unknown, requestedType: StockFilterListType) {
  const seenGroupIds = new Set<number>();

  return getPayloadCollection(payload).flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const groupId = typeof item.group_id === "number" && Number.isFinite(item.group_id) && item.group_id > 0
      ? item.group_id
      : 0;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const listType = item.list_type === "black" || item.list_type === "white"
      ? item.list_type
      : requestedType;

    if (!groupId || !name || seenGroupIds.has(groupId)) {
      return [];
    }

    seenGroupIds.add(groupId);
    return [{ groupId, name, listType }];
  });
}

function getImportStockFiltersResponse(payload: unknown): ImportStockFiltersResponse {
  const source = unwrapDataRecord(payload) ?? (isRecord(payload) ? payload : null);
  const errors = source && Array.isArray(source.errors)
    ? source.errors.flatMap((error) => {
      if (typeof error !== "string") {
        return [];
      }

      const trimmedError = error.trim();

      return trimmedError ? [trimmedError] : [];
    })
    : [];

  return { errors };
}

function getDailyKlines(payload: unknown) {
  const list = getPayloadList(payload);

  return list.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const dailyKline: DailyKline = {};

    assignStringField(dailyKline, item, "code");
    assignStringField(dailyKline, item, "date");
    assignStringField(dailyKline, item, "error");
    assignStringField(dailyKline, item, "name");
    assignStringField(dailyKline, item, "status");
    assignStringField(dailyKline, item, "trade_date");
    assignNumberField(dailyKline, item, "amount");
    assignNumberField(dailyKline, item, "close");
    assignNumberField(dailyKline, item, "high");
    assignNumberField(dailyKline, item, "last");
    assignNumberField(dailyKline, item, "limit_down");
    assignNumberField(dailyKline, item, "limit_pct");
    assignNumberField(dailyKline, item, "limit_up");
    assignNumberField(dailyKline, item, "low");
    assignNumberField(dailyKline, item, "open");
    assignNumberField(dailyKline, item, "volume");

    return Object.keys(dailyKline).length > 0 ? [dailyKline] : [];
  });
}

function getStrategyScanResults(payload: unknown) {
  const list = getPayloadList(payload);

  return list.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const result: StrategyScanResult = {};

    assignScanStringField(result, item, "code");
    assignScanStringField(result, item, "name");
    assignScanStringField(result, item, "x_date");
    assignScanNumberField(result, item, "limit_up_price");
    assignScanNumberField(result, item, "x1_close");
    assignScanNumberField(result, item, "x1_high");
    assignScanNumberField(result, item, "x2_close");
    assignScanNumberField(result, item, "x2_ma5");
    assignScanNumberField(result, item, "x2_ma5_pct");
    assignScanNumberField(result, item, "x_close");
    assignScanNumberField(result, item, "x_high");
    assignScanNumberField(result, item, "x_low");

    if (typeof item.highlight === "boolean") {
      result.highlight = item.highlight;
    }

    if (typeof item.matched === "boolean") {
      result.matched = item.matched;
    }

    if (typeof item.rule1_limit_up === "boolean") {
      result.rule1_limit_up = item.rule1_limit_up;
    }

    if (typeof item.rule2_surge_fall === "boolean") {
      result.rule2_surge_fall = item.rule2_surge_fall;
    }

    if (typeof item.rule3_above_ma5_in_range === "boolean") {
      result.rule3_above_ma5_in_range = item.rule3_above_ma5_in_range;
    }

    if (Array.isArray(item.matched_rules)) {
      result.matched_rules = item.matched_rules.filter((rule): rule is number => (
        typeof rule === "number" && Number.isFinite(rule)
      ));
    }

    if (Array.isArray(item.klines)) {
      result.klines = getDailyKlines(item.klines);
    }

    return result.code || result.name || result.klines?.length ? [result] : [];
  });
}

function getStrategyConfigs(payload: unknown) {
  return getPayloadCollection(payload).flatMap((item) => {
    const config = getStrategyConfig(item);

    return config ? [config] : [];
  });
}

function getStrategyConfig(payload: unknown): StrategyConfigDto | null {
  const item = unwrapDataRecord(payload);

  if (!item) {
    return null;
  }

  const config: StrategyConfigDto = {};

  assignConfigNumberField(config, item, "id");
  assignConfigNumberField(config, item, "x");
  assignConfigNumberField(config, item, "y");
  assignConfigStringField(config, item, "name");
  assignConfigBooleanField(config, item, "enabled");
  assignConfigBooleanField(config, item, "rule2_enabled");
  assignConfigBooleanField(config, item, "rule3_enabled");

  return Object.keys(config).length > 0 ? config : null;
}

function getSelectionBatchPage(payload: unknown): PagedResponse<SelectionBatch> {
  const pageSource = getPageSource(payload);
  const rawList = Array.isArray(pageSource.list) ? pageSource.list : [];

  return {
    list: rawList.flatMap((item) => {
      const batch = getSelectionBatch(item);

      return batch ? [batch] : [];
    }),
    page_num: getNumber(pageSource, "page_num") ?? 1,
    page_size: getNumber(pageSource, "page_size") ?? rawList.length,
    total: getNumber(pageSource, "total") ?? rawList.length,
  };
}

function getSelectionRecordPage(payload: unknown): PagedResponse<SelectionRecord> {
  const pageSource = getPageSource(payload);
  const rawList = Array.isArray(pageSource.list) ? pageSource.list : [];

  return {
    list: rawList.flatMap((item) => {
      const record = getSelectionRecord(item);

      return record ? [record] : [];
    }),
    page_num: getNumber(pageSource, "page_num") ?? 1,
    page_size: getNumber(pageSource, "page_size") ?? rawList.length,
    total: getNumber(pageSource, "total") ?? rawList.length,
  };
}

function getSelectionBatch(payload: unknown): SelectionBatch | null {
  if (!isRecord(payload)) {
    return null;
  }

  const id = getNumber(payload, "id") ?? getNumber(payload, "batch_id");

  if (!id || id <= 0) {
    return null;
  }

  const name = getString(payload, "name")
    ?? getString(payload, "batch_name")
    ?? getString(payload, "title")
    ?? getString(payload, "strategy_name")
    ?? `已选列表 #${id}`;
  const batch: SelectionBatch = {
    id,
    name,
  };
  const createdAt = getString(payload, "created_at") ?? getString(payload, "create_time");
  const strategyConfigId = getNumber(payload, "strategy_config_id") ?? getNumber(payload, "config_id");
  const total = getNumber(payload, "total") ?? getNumber(payload, "record_count") ?? getNumber(payload, "count");

  if (createdAt) {
    batch.created_at = createdAt;
  }

  if (strategyConfigId) {
    batch.strategy_config_id = strategyConfigId;
  }

  if (typeof total === "number") {
    batch.total = total;
  }

  return batch;
}

function getSelectionRecord(payload: unknown): SelectionRecord | null {
  if (!isRecord(payload)) {
    return null;
  }

  const result = getStrategyScanResults(payload)[0] as SelectionRecord | undefined;

  if (!result) {
    return null;
  }

  const id = getNumber(payload, "id");
  const batchId = getNumber(payload, "batch_id");
  const createdAt = getString(payload, "created_at") ?? getString(payload, "create_time");

  if (id) {
    result.id = id;
  }

  if (batchId) {
    result.batch_id = batchId;
  }

  if (createdAt) {
    result.created_at = createdAt;
  }

  return result;
}

function getPayloadList(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data;
  }

  if (isRecord(payload) && isRecord(payload.data)) {
    return [payload.data];
  }

  return isRecord(payload) ? [payload] : [];
}

function getPayloadCollection(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data;
  }

  if (isRecord(payload) && isRecord(payload.data) && Array.isArray(payload.data.list)) {
    return payload.data.list;
  }

  if (isRecord(payload) && Array.isArray(payload.list)) {
    return payload.list;
  }

  if (isRecord(payload) && isRecord(payload.data)) {
    return [payload.data];
  }

  return isRecord(payload) ? [payload] : [];
}

function getPageSource(payload: unknown): Record<string, unknown> {
  if (isRecord(payload) && isRecord(payload.data)) {
    return payload.data;
  }

  return isRecord(payload) ? payload : {};
}

function unwrapDataRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data) && !Array.isArray(payload.data.list)) {
    return payload.data;
  }

  return isRecord(payload) ? payload : null;
}

function createStrategyConfigRequestBody(config: StrategyConfigDto) {
  const body: StrategyConfigDto = {};

  if (typeof config.id === "number" && Number.isFinite(config.id)) {
    body.id = config.id;
  }

  if (typeof config.name === "string") {
    body.name = config.name.trim();
  }

  if (typeof config.enabled === "boolean") {
    body.enabled = config.enabled;
  }

  if (typeof config.rule2_enabled === "boolean") {
    body.rule2_enabled = config.rule2_enabled;
  }

  if (typeof config.rule3_enabled === "boolean") {
    body.rule3_enabled = config.rule3_enabled;
  }

  if (typeof config.x === "number" && Number.isFinite(config.x)) {
    body.x = config.x;
  }

  if (typeof config.y === "number" && Number.isFinite(config.y)) {
    body.y = config.y;
  }

  return body;
}

function createStockFilterListRequestBody(type: StockFilterListType, groupId?: number) {
  return {
    type,
    ...(typeof groupId === "number" && Number.isFinite(groupId) && groupId > 0 ? { group_id: groupId } : {}),
    page_num: 1,
    page_size: 200,
  };
}

function createStockFilterGroupListRequestBody(type: StockFilterListType) {
  return {
    type,
    page_num: 1,
    page_size: 200,
  };
}

function createSelectionBatchListRequestBody(request: SelectionBatchListRequest) {
  const body = {
    page_num: request.page_num ?? 1,
    page_size: request.page_size ?? 20,
    start_time: request.start_time ?? "",
    end_time: request.end_time ?? "",
  };

  return body;
}

function createSelectionRecordListRequestBody(request: SelectionRecordListRequest) {
  return {
    batch_id: request.batch_id,
    page_num: request.page_num ?? 1,
    page_size: request.page_size ?? 200,
  };
}

function assignStringField(
  target: DailyKline,
  source: Record<string, unknown>,
  key: "code" | "date" | "error" | "name" | "status" | "trade_date",
) {
  const value = source[key];

  if (typeof value === "string" && value.trim()) {
    target[key] = value.trim();
  }
}

function assignScanStringField(
  target: StrategyScanResult,
  source: Record<string, unknown>,
  key: "code" | "name" | "x_date",
) {
  const value = source[key];

  if (typeof value === "string" && value.trim()) {
    target[key] = value.trim();
  }
}

function assignScanNumberField(
  target: StrategyScanResult,
  source: Record<string, unknown>,
  key:
    | "limit_up_price"
    | "x1_close"
    | "x1_high"
    | "x2_close"
    | "x2_ma5"
    | "x2_ma5_pct"
    | "x_close"
    | "x_high"
    | "x_low",
) {
  const value = source[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    target[key] = value;
  }
}

function assignConfigStringField(
  target: StrategyConfigDto,
  source: Record<string, unknown>,
  key: "name",
) {
  const value = source[key];

  if (typeof value === "string" && value.trim()) {
    target[key] = value.trim();
  }
}

function assignConfigNumberField(
  target: StrategyConfigDto,
  source: Record<string, unknown>,
  key: "id" | "x" | "y",
) {
  const value = source[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    target[key] = value;
  }
}

function assignConfigBooleanField(
  target: StrategyConfigDto,
  source: Record<string, unknown>,
  key: "enabled" | "rule2_enabled" | "rule3_enabled",
) {
  const value = source[key];

  if (typeof value === "boolean") {
    target[key] = value;
  }
}

function assignNumberField(
  target: DailyKline,
  source: Record<string, unknown>,
  key:
    | "amount"
    | "close"
    | "high"
    | "last"
    | "limit_down"
    | "limit_pct"
    | "limit_up"
    | "low"
    | "open"
    | "volume",
) {
  const value = source[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    target[key] = value;
  }
}

function getString(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function createAuthHeaders(token: string | null | undefined) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function createJsonAuthHeaders(token: string | null | undefined) {
  return {
    ...createAuthHeaders(token),
    "Content-Type": "application/json",
  };
}

function getErrorMessage(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  return typeof payload.msg === "string" && payload.msg.trim() ? payload.msg : null;
}

function getApiStatus(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  return typeof payload.code === "number" ? payload.code : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
