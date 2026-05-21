import {
  BACKEND_INTERNAL_URL,
  IS_AUTHENTICATED_TIMEOUT_MS,
} from "@/shared/config/proxy.constant";

export interface IIsAuthenticatedResult {
  authenticated: boolean;
  isSuperAdmin: boolean;

  setCookies: ReadonlyArray<string>;
  ok: boolean;
}

interface IIsAuthenticatedRaw {
  authenticated: boolean;
  is_super_admin?: boolean;
}

export async function checkIsAuthenticated(cookieHeader: string): Promise<IIsAuthenticatedResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IS_AUTHENTICATED_TIMEOUT_MS);

  try {
    const response = await fetch(`${BACKEND_INTERNAL_URL}/api/v1/auth/is-authenticated`, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: cookieHeader,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const setCookies = readSetCookies(response.headers);

    if (!response.ok) {
      return { authenticated: false, isSuperAdmin: false, setCookies, ok: false };
    }

    const data = (await response.json()) as IIsAuthenticatedRaw;
    return {
      authenticated: Boolean(data.authenticated),
      isSuperAdmin: Boolean(data.is_super_admin),
      setCookies,
      ok: true,
    };
  } catch {
    return { authenticated: false, isSuperAdmin: false, setCookies: [], ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

function readSetCookies(headers: Headers): string[] {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}
