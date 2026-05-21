"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/shared/ui/Button";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Textarea } from "@/shared/ui/Textarea";
import { AlertTriangleIcon } from "@/shared/icons/index-icons";

import { useReportIncident } from "@/features/stands/hooks/useReportIncident";

interface IReportIncidentModalProps {
  standId: string;
  onClose: () => void;
  reportedBy?: string;
}

const MIN_LEN = 10;

export function ReportIncidentModal({ standId, onClose, reportedBy }: IReportIncidentModalProps) {
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const { mutate, isPending, error } = useReportIncident();

  const trimmed = description.trim();
  const tooShort = trimmed.length < MIN_LEN;
  const showError = touched && tooShort;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (tooShort) return;
    mutate(
      { standId, payload: { description: trimmed, reported_by: reportedBy } },
      { onSuccess: onClose },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
        <AlertTriangleIcon size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
        <div className="leading-relaxed">
          Стенд будет автоматически <strong>заморожен</strong> на 24 часа для разбора
          преподавателем. Дальнейшее удаление по таймеру приостановится — данные останутся
          для аудита.
        </div>
      </div>

      <Textarea
        label="Опишите проблему"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="Что не работает? На каком шаге? Какие сообщения об ошибках видны?"
        rows={5}
        hint={
          showError
            ? undefined
            : `Минимум ${MIN_LEN} символов. Сейчас: ${trimmed.length}`
        }
        error={showError ? `Опишите проблему подробнее (минимум ${MIN_LEN} символов)` : undefined}
      />

      {error && <ErrorBox error={error} />}

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <Button variant="ghost" type="button" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" isLoading={isPending} disabled={tooShort}>
          Отправить
        </Button>
      </div>
    </form>
  );
}
