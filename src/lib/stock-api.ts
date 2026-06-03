import { ApiError, getStoredAuthToken, isAuthFailureStatus, notifyAuthExpired } from "./auth-api";

const apiBaseUrl = "http://192.168.2.16:1889/api/v1";

export type StockListRequest = {
  code?: string;
  name?: string;
};

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
};

export type AddStockFilterRequest = {
  code: string;
  name: string;
  listType: StockFilterListType;
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
  config_id?: number;
  x?: number;
  y?: number;
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
  x_close?: number;
  x_date?: string;
  x_high?: number;
  x_low?: number;
};

export async function listStocks(
  query: StockListRequest,
  signal?: AbortSignal,
): Promise<StockInfo[]> {
  const url = new URL(`${apiBaseUrl}/stock/list`);

  if (query.code?.trim()) {
    url.searchParams.set("code", query.code.trim());
  }

  if (query.name?.trim()) {
    url.searchParams.set("name", query.name.trim());
  }

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(url, {
      method: "POST",
      headers: createAuthHeaders(token),
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

  return getStockList(payload);
}

export async function listStockFilters(
  type: StockFilterListType,
  signal?: AbortSignal,
): Promise<StockFilter[]> {
  const url = new URL(`${apiBaseUrl}/strategy/filter`);

  url.searchParams.set("type", type);

  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(url, {
      method: "POST",
      headers: createAuthHeaders(token),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error("无法连接黑白名单接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "黑白名单加载失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "黑白名单加载失败。", response.status);
  }

  return getStockFilters(payload, type);
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
        name,
        list_type: request.listType,
      }),
    });
  } catch {
    throw new Error("无法连接添加黑白名单接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "添加黑白名单失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "添加黑白名单失败。", response.status);
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
    throw new Error("无法连接删除黑白名单接口，请确认后端服务或跨域配置。");
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const message = getErrorMessage(payload) ?? "删除黑白名单失败。";

    if (isAuthFailureStatus(response.status)) {
      notifyAuthExpired();
    }

    throw new ApiError(message, response.status);
  }

  const apiStatus = getApiStatus(payload);

  if (apiStatus !== null && apiStatus !== 0) {
    throw new ApiError(getErrorMessage(payload) ?? "删除黑白名单失败。", response.status);
  }
}

export async function scanStrategy(
  request: StrategyScanRequest,
  signal?: AbortSignal,
): Promise<StrategyScanResult[]> {
  let response: Response;
  const token = getStoredAuthToken()?.trim();

  try {
    response = await fetch(`${apiBaseUrl}/strategy/scan`, {
      method: "POST",
      headers: createJsonAuthHeaders(token),
      body: JSON.stringify(createStrategyScanRequestBody(request)),
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

function getStockList(payload: unknown) {
  const list = getDataList(payload);

  return list.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const code = typeof item.code === "string" ? item.code.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";

    return code ? [{ code, name: name || code }] : [];
  });
}

function getStockFilters(payload: unknown, requestedType: StockFilterListType) {
  const list = getDataList(payload);

  return list.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const code = typeof item.code === "string" ? item.code.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const id = typeof item.id === "number" ? item.id : 0;
    const listType = item.list_type === "black" || item.list_type === "white"
      ? item.list_type
      : requestedType;

    return code ? [{ id, code, name: name || code, listType }] : [];
  });
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

function getDataList(payload: unknown) {
  return Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data
      : [];
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

function createStrategyScanRequestBody(request: StrategyScanRequest) {
  const body: StrategyScanRequest = {};

  if (typeof request.config_id === "number" && Number.isFinite(request.config_id)) {
    body.config_id = request.config_id;
  }

  if (typeof request.x === "number" && Number.isFinite(request.x)) {
    body.x = request.x;
  }

  if (typeof request.y === "number" && Number.isFinite(request.y)) {
    body.y = request.y;
  }

  return body;
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
    | "x_close"
    | "x_high"
    | "x_low",
) {
  const value = source[key];

  if (typeof value === "number" && Number.isFinite(value)) {
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
