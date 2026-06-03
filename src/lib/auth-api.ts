const apiBaseUrl = "http://192.168.2.16:1889/api/v1";
const authTokenStorageKey = "stockpick-auth-token";

export type LoginCredentials = {
  username: string;
  password: string;
};

type LoginResponse = {
  token: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });
  } catch {
    throw new ApiError("无法连接登录接口，请确认后端服务或跨域配置。", 0);
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(payload) ?? "登录失败，请检查账号或密码。", response.status);
  }

  const token = getLoginToken(payload);

  if (!token) {
    throw new ApiError(getErrorMessage(payload) ?? "登录响应缺少 JWT token。", response.status);
  }

  return { token };
}

export function getStoredAuthToken() {
  try {
    return window.localStorage.getItem(authTokenStorageKey);
  } catch {
    return null;
  }
}

export function storeAuthToken(token: string) {
  try {
    window.localStorage.setItem(authTokenStorageKey, token);
  } catch {
    // Keep the current login flow usable even if browser storage is unavailable.
  }
}

export function clearStoredAuthToken() {
  try {
    window.localStorage.removeItem(authTokenStorageKey);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
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

function getErrorMessage(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  return typeof payload.msg === "string" && payload.msg.trim() ? payload.msg : null;
}

function getLoginToken(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.token === "string" && payload.token.length > 0) {
    return payload.token;
  }

  const data = payload.data;

  if (isRecord(data) && typeof data.token === "string" && data.token.length > 0) {
    return data.token;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
