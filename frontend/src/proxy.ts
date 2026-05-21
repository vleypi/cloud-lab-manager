import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_PROTECTED_ROUTES,
  COOKIE_ACCESS_NAME,
  COOKIE_REFRESH_NAME,
  DEFAULT_ADMIN_ROUTE,
  DEFAULT_PROTECTED_ROUTE,
  GRACE_PERIOD_ON_ERROR,
  LOGIN_ROUTE,
  PROTECTED_ROUTES,
  PUBLIC_ONLY_ROUTES,
} from "@/shared/config/proxy.constant";
import { checkIsAuthenticated } from "@/shared/services/proxy.service";
import { matchesAny } from "@/shared/utils/proxy.util";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  const isProtected = matchesAny(pathname, PROTECTED_ROUTES);
  const isAdminProtected = matchesAny(pathname, ADMIN_PROTECTED_ROUTES);
  const isPublicOnly = matchesAny(pathname, PUBLIC_ONLY_ROUTES);

  if (!isProtected && !isAdminProtected && !isPublicOnly) {
    return NextResponse.next();
  }

  const access = request.cookies.get(COOKIE_ACCESS_NAME)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH_NAME)?.value;
  const hasAnyAuthCookie = Boolean(access || refresh);

  if (!hasAnyAuthCookie) {
    if (isProtected || isAdminProtected) {
      return redirectToLogin(request, { next: `${pathname}${search}` });
    }
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const result = await checkIsAuthenticated(cookieHeader);

  if (!result.ok) {
    if (GRACE_PERIOD_ON_ERROR) return forwardCookies(NextResponse.next(), result.setCookies);
    if (isProtected || isAdminProtected) {
      const response = redirectToLogin(request, { error: "service_unavailable" });
      clearAuthCookies(response);
      return response;
    }
    const passthrough = forwardCookies(NextResponse.next(), result.setCookies);
    clearAuthCookies(passthrough);
    return passthrough;
  }

  if (result.authenticated) {
    if (isPublicOnly) {
      const target = result.isSuperAdmin ? DEFAULT_ADMIN_ROUTE : DEFAULT_PROTECTED_ROUTE;
      return forwardCookies(redirect(request, target), result.setCookies);
    }
    if (isAdminProtected && !result.isSuperAdmin) {
      return forwardCookies(redirect(request, DEFAULT_PROTECTED_ROUTE), result.setCookies);
    }
    return forwardCookies(NextResponse.next(), result.setCookies);
  }

  if (isProtected || isAdminProtected) {
    const response = redirectToLogin(request, { next: `${pathname}${search}` });
    response.cookies.delete(COOKIE_ACCESS_NAME);
    response.cookies.delete(COOKIE_REFRESH_NAME);
    return forwardCookies(response, result.setCookies);
  }
  return forwardCookies(NextResponse.next(), result.setCookies);
}

function redirect(request: NextRequest, path: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return NextResponse.redirect(url);
}

function redirectToLogin(
  request: NextRequest,
  params: { next?: string; error?: string },
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = LOGIN_ROUTE;
  url.search = "";
  if (params.next && params.next !== LOGIN_ROUTE) url.searchParams.set("next", params.next);
  if (params.error) url.searchParams.set("error", params.error);
  return NextResponse.redirect(url);
}

function forwardCookies(response: NextResponse, setCookies: ReadonlyArray<string>): NextResponse {
  for (const raw of setCookies) {
    response.headers.append("set-cookie", raw);
  }
  return response;
}

function clearAuthCookies(response: NextResponse): void {
  response.cookies.delete(COOKIE_ACCESS_NAME);
  response.cookies.delete(COOKIE_REFRESH_NAME);
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/login"],
};
