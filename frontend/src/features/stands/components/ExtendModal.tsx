"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/shared/ui/Button";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Input } from "@/shared/ui/Input";

import { useExtendStand } from "@/features/stands/hooks/useExtendStand";

interface IExtendModalProps {
  standId: string;
  onClose: () => void;
  requestedBy?: string;
}

const MIN_HOURS = 0.5;
const MAX_HOURS = 24 * 7;

export function ExtendModal({ standId, onClose, requestedBy }: IExtendModalProps) {
  const [hours, setHours] = useState<string>("2");
  const { mutate, isPending, error } = useExtendStand();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(hours.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < MIN_HOURS || parsed > MAX_HOURS) return;
    const seconds = Math.round(parsed * 3600);
    mutate(
      { standId, payload: { new_ttl_seconds: seconds, requested_by: requestedBy } },
      { onSuccess: onClose },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        Установите новое время автоудаления относительно текущего момента. Допустимый диапазон —
        от {MIN_HOURS} до {MAX_HOURS} часов.
      </p>

      <Input
        label="Новый TTL, часы"
        type="number"
        step={0.5}
        min={MIN_HOURS}
        max={MAX_HOURS}
        value={hours}
        onChange={(event) => setHours(event.target.value)}
        required
      />

      {error && <ErrorBox error={error} />}

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <Button variant="ghost" type="button" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" isLoading={isPending}>
          Продлить
        </Button>
      </div>
    </form>
  );
}
