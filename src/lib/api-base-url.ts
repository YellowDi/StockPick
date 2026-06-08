const devApiBaseUrl = import.meta.env.DEV ? import.meta.env.VITE_DEV_API_BASE_URL?.trim() : "";

export const apiBaseUrl = devApiBaseUrl || "/api/v1";
