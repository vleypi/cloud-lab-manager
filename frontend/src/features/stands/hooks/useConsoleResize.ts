"use client";

import { useEffect } from "react";

interface ResizableClient {
  sendSize(width: number, height: number): void;
}

export function useConsoleResize(
  container: HTMLElement | null,
  client: ResizableClient | null,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled || !container || !client) return;

    let lastW = 0;
    let lastH = 0;

    const send = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(640, Math.floor(rect.width));
      const h = Math.max(400, Math.floor(rect.height));
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      try {
        client.sendSize(w, h);
      } catch {}
    };

    send();

    const observer = new ResizeObserver(() => send());
    observer.observe(container);

    return () => observer.disconnect();
  }, [container, client, enabled]);
}
