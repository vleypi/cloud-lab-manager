import { TBadgeTone } from "@/shared/ui/Badge";
import { TPoolProjectStatus } from "@/features/pool/interfaces/pool.interfaces";

export const POOL_STATUS_LABELS: Record<TPoolProjectStatus, string> = {
  free: "Свободен",
  allocated: "Занят",
  cleaning: "Очистка",
  disabled: "Отключён",
};

export const POOL_STATUS_TONE: Record<TPoolProjectStatus, TBadgeTone> = {
  free: "success",
  allocated: "info",
  cleaning: "warn",
  disabled: "neutral",
};
