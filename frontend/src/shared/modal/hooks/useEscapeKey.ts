"use client";

import { useEffect } from "react";

export function useEscapeKey(handler: () => void, isActive: boolean): void {
  useEffect(() => {
    if (!isActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handler, isActive]);
}
