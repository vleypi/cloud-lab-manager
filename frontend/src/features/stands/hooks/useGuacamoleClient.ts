"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { standsService } from "@/features/stands/services/stands.service";

type GuacTunnel = unknown;

interface GuacDisplay {
  getElement(): HTMLElement;
  getWidth(): number;
  getHeight(): number;
  getScale(): number;
  scale(value: number): void;
}

interface GuacClient {
  connect(query?: string): void;
  disconnect(): void;
  getDisplay(): GuacDisplay;
  sendMouseState(state: unknown): void;
  sendKeyEvent(pressed: number, keysym: number): void;
  sendSize(w: number, h: number): void;
  onstatechange?: (state: number) => void;
  onerror?: (error: { message?: string; code?: number }) => void;
}

interface GuacamoleNS {
  Client: new (tunnel: GuacTunnel) => GuacClient;
  WebSocketTunnel: new (url: string) => GuacTunnel;
  Mouse: new (el: HTMLElement) => {
    onmousedown?: (state: unknown) => void;
    onmouseup?: (state: unknown) => void;
    onmousemove?: (state: unknown) => void;
  };
  Keyboard: new (el: Document | HTMLElement) => {
    onkeydown?: (keysym: number) => boolean | void;
    onkeyup?: (keysym: number) => boolean | void;
  };
}

export type ConsoleState =
  | "idle"
  | "tokenizing"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface UseGuacamoleClientResult {
  state: ConsoleState;
  errorMessage: string | null;
  closeCode: number | null;
  containerRef: (el: HTMLDivElement | null) => void;
  reconnect: () => void;
  client: GuacClient | null;
}

const STATE_NAMES: Record<number, ConsoleState> = {
  0: "idle",
  1: "connecting",
  2: "connecting",
  3: "connected",
  4: "disconnected",
  5: "disconnected",
};

const ERROR_HINTS: Record<number, string> = {
  4401: "Не авторизован. Перезагрузите страницу.",
  4403: "Нет доступа к этому стенду.",
  4404: "Стенд не найден.",
  4409: "Стенд ещё не готов. Подождите 10-20 секунд.",
  4500: "Не удалось подключиться к стенду. Попробуйте переподключиться.",
};

let guacamoleModulePromise: Promise<GuacamoleNS> | null = null;

async function loadGuacamole(): Promise<GuacamoleNS> {
  if (!guacamoleModulePromise) {
    guacamoleModulePromise = import("guacamole-common-js").then((mod) => {
      const ns = (mod as unknown as { default?: GuacamoleNS }).default ?? (mod as unknown as GuacamoleNS);
      return ns;
    });
  }
  return guacamoleModulePromise;
}

export function useGuacamoleClient(standId: string, enabled: boolean): UseGuacamoleClientResult {
  const [state, setState] = useState<ConsoleState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [closeCode, setCloseCode] = useState<number | null>(null);
  const [generation, setGeneration] = useState(0);

  const containerElRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<GuacClient | null>(null);
  const displayElRef = useRef<HTMLElement | null>(null);
  const [client, setClient] = useState<GuacClient | null>(null);

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    containerElRef.current = el;
  }, []);

  useEffect(() => {
    if (!enabled || !standId) return;
    let cancelled = false;

    async function connect() {
      setErrorMessage(null);
      setCloseCode(null);
      setState("tokenizing");

      let Guacamole: GuacamoleNS;
      try {
        Guacamole = await loadGuacamole();
      } catch {
        if (cancelled) return;
        setErrorMessage("Не удалось загрузить guacamole-common-js");
        setState("error");
        return;
      }
      if (cancelled) return;

      let tokenResp;
      const maxWaitAttempts = 40;
      let attempt = 0;
      while (true) {
        try {
          tokenResp = await standsService.issueConsoleToken(standId);
          break;
        } catch (e) {
          if (cancelled) return;
          const err = e as {
            message?: string;
            statusCode?: number;
            code?: string;
            details?: Record<string, unknown>;
          };
          const isTransient =
            err.statusCode === 409 &&
            (err.message?.includes("no reachable") ||
              err.message?.includes("Credentials not available") ||
              err.message?.includes("not ready"));
          if (isTransient && attempt < maxWaitAttempts) {
            attempt += 1;
            setState("tokenizing");
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          setErrorMessage(err.message || "Не удалось получить токен консоли");
          setState("error");
          return;
        }
      }
      if (cancelled || !tokenResp) return;

      const wsBase = wsBaseFromLocation();
      const url = `${wsBase}${tokenResp.ws_url}`;
      const tunnel = new Guacamole.WebSocketTunnel(url);
      const cli = new Guacamole.Client(tunnel);
      clientRef.current = cli;
      setClient(cli);

      cli.onerror = (err) => {
        if (cancelled) return;
        setErrorMessage(err?.message || "Ошибка соединения");
        if (typeof err?.code === "number") setCloseCode(err.code);
        setState("error");
      };

      cli.onstatechange = (s) => {
        if (cancelled) return;
        const name = STATE_NAMES[s] ?? "connecting";
        setState(name);
      };

      const container = containerElRef.current;
      if (!container) {
        setErrorMessage("Контейнер консоли не смонтирован");
        setState("error");
        return;
      }

      const display = cli.getDisplay();
      const displayEl = display.getElement();
      displayElRef.current = displayEl;
      while (container.firstChild) container.removeChild(container.firstChild);
      container.appendChild(displayEl);

      const rect = container.getBoundingClientRect();
      const w = Math.max(640, Math.floor(rect.width || 1280));
      const h = Math.max(400, Math.floor(rect.height || 800));
      const params = new URLSearchParams({
        width: String(w),
        height: String(h),
        dpi: String(96),
      });
      cli.connect(params.toString());

      const mouse = new Guacamole.Mouse(displayEl);
      mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (s) => {
        cli.sendMouseState(s);
      };

      const keyboard = new Guacamole.Keyboard(document);
      keyboard.onkeydown = (keysym) => {
        cli.sendKeyEvent(1, keysym);
        return true;
      };
      keyboard.onkeyup = (keysym) => {
        cli.sendKeyEvent(0, keysym);
        return true;
      };
    }

    connect();

    return () => {
      cancelled = true;
      try {
        clientRef.current?.disconnect();
      } catch {}
      clientRef.current = null;
      setClient(null);
      const container = containerElRef.current;
      if (container && displayElRef.current && displayElRef.current.parentNode === container) {
        container.removeChild(displayElRef.current);
      }
      displayElRef.current = null;
    };
  }, [standId, enabled, generation]);

  const reconnect = useCallback(() => {
    setGeneration((g) => g + 1);
  }, []);

  const messageOverride =
    closeCode !== null && ERROR_HINTS[closeCode] ? ERROR_HINTS[closeCode] : errorMessage;

  return {
    state,
    errorMessage: messageOverride,
    closeCode,
    containerRef,
    reconnect,
    client,
  };
}

function wsBaseFromLocation(): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}
