import { COOKIE_MAX_AGE_DAYS } from "@/shared/config/cookies.constant";

function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {

    return true;
  }
}

export function getClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [key, value] = cookie.split("=");
    if (key === name) return decodeURIComponent(value ?? "");
  }
  return null;
}

export function setClientCookie(
  name: string,
  value: string,
  maxAgeDays: number = COOKIE_MAX_AGE_DAYS,
): void {
  if (typeof document === "undefined") return;
  const maxAgeSeconds = maxAgeDays * 24 * 60 * 60;

  const sameSite = isInIframe() ? "None; Secure" : "Lax";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=${sameSite}`;
}
