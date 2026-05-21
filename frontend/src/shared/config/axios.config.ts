import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";

import { COOKIE_KEYS } from "@/shared/config/cookies.constant";
import { handleServiceError } from "@/shared/utils/service.util";

const API_BASE_URL = "/api/v1";
const REQUEST_TIMEOUT_MS = 30_000;

const CSRF_HEADER_NAME = "X-CSRF-Token";

const AUTH_BYPASS_PATHS: ReadonlyArray<string> = [
  "/auth/refresh",
  "/auth/me",
  "/auth/is-authenticated",
  "/auth/admin/login",
  "/auth/dev/login",
  "/auth/logout",
];

interface IRetryableConfig extends InternalAxiosRequestConfig {
  _authRetried?: boolean;
}

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window === "undefined") return config;

  const method = (config.method ?? "get").toLowerCase();
  if (method !== "get" && method !== "head" && method !== "options") {
    const csrf = readCookie(COOKIE_KEYS.CSRF);
    if (csrf) config.headers.set(CSRF_HEADER_NAME, csrf);
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as IRetryableConfig | undefined;
    const status = error.response?.status;

    const url = original?.url ?? "";
    const isAuthEndpoint = AUTH_BYPASS_PATHS.some((path) => url.startsWith(path));

    if (
      status === 401 &&
      original &&
      !original._authRetried &&
      !isAuthEndpoint &&
      typeof window !== "undefined"
    ) {
      original._authRetried = true;
      try {
        await axiosInstance.post("/auth/refresh");
        return axiosInstance.request(original as AxiosRequestConfig);
      } catch {

      }
    }

    return Promise.reject(handleServiceError(error));
  },
);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const parts = document.cookie.split(";");
  for (const raw of parts) {
    const trimmed = raw.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}
