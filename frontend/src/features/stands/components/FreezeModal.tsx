"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/shared/ui/Button";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Textarea } from "@/shared/ui/Textarea";

import { useFreezeStand } from "@/features/stands/hooks/useFreezeStand";

interface IFreezeModalProps {
  standId: string;
  onClose: () => void;
  requestedBy?: string;
}

export function FreezeModal({ standId, onClose, requestedBy }: IFreezeModalProps) {
  const [reason, setReason] = useState("");
  const { mutate, isPending, error } = useFreezeStand();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutate(
      {
        standId,
        payload: {
          reason: reason.trim() || undefined,
          requested_by: requestedBy,
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        Auto-destroy для этого стенда отключится. По умолчанию стенд будет ожидать аудита 24 часа —
        интервал можно изменить в настройках лимитов.
      </p>

      <Textarea
        label="Причина (для аудит-лога)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Студент сообщил о проблеме с конфигурацией apache..."
        rows={3}
        hint="Опционально, но облегчает разбор инцидента"
      />

      {error && <ErrorBox error={error} />}

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <Button variant="ghost" type="button" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" isLoading={isPending}>
          Заморозить
        </Button>
      </div>
    </form>
  );
}
