"use client";

import { useCallback, useEffect, useState } from "react";

import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  RefreshIcon,
} from "@/shared/icons/index-icons";
import { Button } from "@/shared/ui/Button";
import { Spinner } from "@/shared/ui/Spinner";

import { standsService } from "@/features/stands/services/stands.service";
import { IStand } from "@/features/stands/interfaces/stands.interfaces";

interface IStandConsoleProps {
  stand: IStand;
  enabled?: boolean;
  showFullscreenLink?: boolean;
  variant?: "embedded" | "fullscreen";
}

type LoadState = "idle" | "loading" | "ready" | "error";

const TRANSIENT_DETAILS = new Set([
  "stand_status_allocating",
  "stand_status_deploying",
  "stand_has_no_server_id",
  "console_url_unavailable",
]);

export function StandConsole({
  stand,
  enabled = true,
  showFullscreenLink = true,
  variant = "embedded",
}: IStandConsoleProps) {
  const isReady = stand.status === "ready";
  const active = enabled && isReady;

  const [state, setState] = useState<LoadState>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  const reconnect = useCallback(() => setGeneration((g) => g + 1), []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchUrl() {
      setState("loading");
      setError(null);

      const maxAttempts = 40;
      let attempt = 0;

      while (!cancelled) {
        try {
          const res = await standsService.getConsoleUrl(stand.id);
          if (cancelled) return;
          setUrl(res.url);
          setState("ready");
          return;
        } catch (e) {
          if (cancelled) return;
          const err = e as { message?: string; statusCode?: number };
          const detail = String(err.message || "");
          const isTransient =
            (err.statusCode === 409 || err.statusCode === 502) &&
            (TRANSIENT_DETAILS.has(detail) || detail.includes("unavailable") || detail.includes("status"));
          if (isTransient && attempt < maxAttempts) {
            attempt += 1;
            await new Promise<void>((r) => {
              timer = setTimeout(() => r(), 3000);
            });
            continue;
          }
          setError(detail || "Не удалось получить ссылку на консоль");
          setState("error");
          return;
        }
      }
    }

    fetchUrl();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [stand.id, active, generation]);

  const heightClass =
    variant === "fullscreen"
      ? "h-[100dvh]"
      : "min-h-[480px] h-[60vh] max-h-[720px]";

  if (!isReady) {
    return (
      <div
        className={`rounded-2xl border border-amber-200/60 bg-ki-amber-soft p-6 ${heightClass} flex items-center justify-center`}
      >
        <div className="flex items-start gap-3 max-w-md">
          <div className="w-9 h-9 rounded-xl bg-white/70 text-amber-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangleIcon size={18} />
          </div>
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Консоль пока недоступна</p>
            <p className="mt-1 text-amber-800/90">
              Стенд в статусе <span className="font-mono">{stand.status}</span>. Подключение
              откроется, когда стенд перейдёт в <span className="font-mono">ready</span>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl border border-ki-blue/10 bg-black overflow-hidden ${heightClass}`}
    >
      {state === "ready" && url && (
        <iframe
          src={url}
          title="Stand console"
          className="absolute inset-0 w-full h-full border-0"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      )}

      {(state === "idle" || state === "loading") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-white">
          <Spinner size="lg" />
          <p className="text-sm opacity-80">Получаем консоль стенда...</p>
        </div>
      )}

      {state === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangleIcon size={18} />
              </div>
              <div className="text-sm min-w-0">
                <p className="font-semibold text-ki-dark">Ошибка консоли</p>
                <p className="mt-1 text-gray-600 break-words">
                  {error || "Не удалось получить ссылку на консоль."}
                </p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    iconLeft={<RefreshIcon size={14} />}
                    onClick={reconnect}
                  >
                    Переподключиться
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {variant === "embedded" && showFullscreenLink && state === "ready" && url && (
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-white/90 hover:bg-white text-ki-dark px-2.5 py-1 text-xs font-medium shadow-sm"
          >
            <ExternalLinkIcon size={12} />
            Открыть в новой вкладке
          </a>
        </div>
      )}
    </div>
  );
}
