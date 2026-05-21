

export const PROTECTED_ROUTES = ["/app"] as const;
export const ADMIN_PROTECTED_ROUTES = ["/admin"] as const;

export const PUBLIC_ONLY_ROUTES = ["/login"] as const;

export const DEFAULT_PROTECTED_ROUTE = "/app";
export const DEFAULT_ADMIN_ROUTE = "/admin";
export const LOGIN_ROUTE = "/login";

export const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL ?? "http://api:8000";

export const COOKIE_ACCESS_NAME = process.env.COOKIE_ACCESS_NAME ?? "ki_access";
export const COOKIE_REFRESH_NAME = process.env.COOKIE_REFRESH_NAME ?? "ki_refresh";

export const IS_AUTHENTICATED_TIMEOUT_MS = 5_000;

export const GRACE_PERIOD_ON_ERROR = false;
