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

function getDataList(payload: unknown) {
  return Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data
      : [];
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
