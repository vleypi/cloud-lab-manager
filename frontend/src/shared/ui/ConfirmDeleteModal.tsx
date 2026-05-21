"use client";

import { ReactNode } from "react";

import { Button } from "@/shared/ui/Button";
import { AlertTriangleIcon, TrashIcon } from "@/shared/icons/index-icons";

export type TConfirmTone = "danger" | "info" | "warn";

interface IConfirmDeleteModalProps {
  description: ReactNode;
  itemLabel?: ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
  tone?: TConfirmTone;
  icon?: ReactNode;
  triggerIcon?: ReactNode;
  hideWarning?: boolean;
}

const TONE_CLASSES: Record<
  TConfirmTone,
  { iconBg: string; iconText: string; button: "danger" | "primary" | "secondary" }
> = {
  danger: { iconBg: "bg-red-50", iconText: "text-red-500", button: "danger" },
  info: { iconBg: "bg-ki-blue-light", iconText: "text-ki-blue", button: "primary" },
  warn: { iconBg: "bg-ki-amber-soft", iconText: "text-amber-600", button: "primary" },
};

export function ConfirmDeleteModal({
  description,
  itemLabel,
  confirmLabel = "Удалить",
  pendingLabel = "Удаление...",
  isPending,
  onConfirm,
  onClose,
  tone = "danger",
  icon,
  triggerIcon,
  hideWarning = false,
}: IConfirmDeleteModalProps) {
  const toneClasses = TONE_CLASSES[tone];
  const resolvedIcon = icon ?? <AlertTriangleIcon size={20} />;
  const resolvedTrigger =
    triggerIcon ?? (tone === "danger" ? <TrashIcon size={14} /> : undefined);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${toneClasses.iconBg} ${toneClasses.iconText}`}
        >
          {resolvedIcon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ki-dark">{description}</p>
          {itemLabel && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-sm font-mono text-ki-dark break-all">
              {itemLabel}
            </div>
          )}
          {!hideWarning && tone === "danger" && (
            <p className="text-xs text-gray-500 mt-3">
              Действие необратимо. Объект будет удалён из системы навсегда.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button variant="ghost" type="button" onClick={onClose} disabled={isPending}>
          Отмена
        </Button>
        <Button
          variant={toneClasses.button}
          type="button"
          onClick={onConfirm}
          isLoading={isPending}
          iconLeft={resolvedTrigger}
        >
          {isPending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </div>
  );
}
