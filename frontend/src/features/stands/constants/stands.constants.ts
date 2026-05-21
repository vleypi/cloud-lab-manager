import { TBadgeTone } from "@/shared/ui/Badge";
import { TStandStatus } from "@/features/stands/interfaces/stands.interfaces";

export const STATUS_LABELS: Record<TStandStatus, string> = {
  allocating: "Выделение",
  deploying: "Развертывание",
  ready: "Готов",
  failed: "Сбой",
  frozen: "Заморожен",
  cleaning: "Очистка",
  destroyed: "Удалён",
};

export const STATUS_DESCRIPTIONS: Record<TStandStatus, string> = {
  allocating: "Подбираем свободный проект в КИ",
  deploying: "Создаём виртуальную машину",
  ready: "Стенд готов, можно подключаться",
  failed: "Не удалось развернуть, см. причину ошибки",
  frozen: "Стенд заморожен для разбора инцидента",
  cleaning: "Удаляем ресурсы и возвращаем проект в пул",
  destroyed: "Сессия завершена",
};

export const STATUS_TONE: Record<TStandStatus, TBadgeTone> = {
  allocating: "info",
  deploying: "info",
  ready: "success",
  failed: "danger",
  frozen: "cyan",
  cleaning: "warn",
  destroyed: "neutral",
};

export const STATUS_PULSE: Record<TStandStatus, boolean> = {
  allocating: true,
  deploying: true,
  ready: false,
  failed: false,
  frozen: false,
  cleaning: true,
  destroyed: false,
};

export const TRANSITION_STATUSES: ReadonlySet<TStandStatus> = new Set([
  "allocating",
  "deploying",
  "cleaning",
]);

export const ACTIVE_STATUSES: ReadonlySet<TStandStatus> = new Set([
  "allocating",
  "deploying",
  "ready",
  "frozen",
  "cleaning",
]);

export const FSM_TIMELINE_STEPS = [
  { status: "allocating", label: "Выделение" },
  { status: "deploying", label: "Развертывание" },
  { status: "ready", label: "Готов" },
] as const;

export type TFsmTimelineStatus = (typeof FSM_TIMELINE_STEPS)[number]["status"];

export function canExtend(status: TStandStatus): boolean {
  return status === "ready" || status === "frozen";
}

export function canFreeze(status: TStandStatus): boolean {
  return status === "ready";
}

export function canUnfreeze(status: TStandStatus): boolean {
  return status === "frozen";
}

export function canDestroy(status: TStandStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}
