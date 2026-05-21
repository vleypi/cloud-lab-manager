"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { COOKIE_KEYS } from "@/shared/config/cookies.constant";
import { setClientCookie } from "@/shared/utils/cookie.util";

interface ISidebarContextValue {
  isOpen: boolean;
  isMobile: boolean;
  isReady: boolean;
  toggle: () => void;
  closeMobile: () => void;
}

const MOBILE_BREAKPOINT_PX = 768;
const SidebarContext = createContext<ISidebarContextValue | null>(null);

interface ISidebarProviderProps {
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SidebarProvider({ defaultOpen = true, children }: ISidebarProviderProps) {
  const [desktopOpen, setDesktopOpen] = useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const matchMobile = () => window.innerWidth < MOBILE_BREAKPOINT_PX;
    setIsMobile(matchMobile());

    const raf = requestAnimationFrame(() => setIsReady(true));
    const onResize = () => {
      const next = matchMobile();
      setIsMobile((prev) => {
        if (prev !== next && !next) setMobileOpen(false);
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
    } else {
      setDesktopOpen((prev) => {
        const next = !prev;
        setClientCookie(COOKIE_KEYS.SIDEBAR_OPEN, String(next));
        return next;
      });
    }
  }, [isMobile]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const value = useMemo<ISidebarContextValue>(
    () => ({
      isOpen: isMobile ? mobileOpen : desktopOpen,
      isMobile,
      isReady,
      toggle,
      closeMobile,
    }),
    [isMobile, mobileOpen, desktopOpen, isReady, toggle, closeMobile],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): ISidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
