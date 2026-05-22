"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/shared/ui/Button";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Input } from "@/shared/ui/Input";
import { SkeletonLine } from "@/shared/ui/Skeleton";
import { useMe } from "@/shared/identity/useMe";
import { secondsToHours } from "@/shared/utils/format.util";

import { useLifecycleSettings } from "@/features/admin/hooks/useLifecycleSettings";
import { usePatchLifecycleSettings } from "@/features/admin/hooks/usePatchLifecycleSettings";

interface IFormState {
  defaultTtlHours: string;
  freezeTtlHours: string;
  capacityThreshold: string;
}

interface IFormErrors {
  defaultTtlHours?: string;
  freezeTtlHours?: string;
  capacityThreshold?: string;
}

const HOUR = 3600;
const MAX_TTL_HOURS = (30 * 24 * 3600) / HOUR;
const MIN_TTL_HOURS_FRAC = 1 / 60;

function parseNumber(raw: string): number | null {
  const normalized = raw.replace(",", ".").trim();
  if (normalized === "") return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}

function validateTtlHours(raw: string, label: string): string | undefined {
  const value = parseNumber(raw);
  if (value === null) return `${label}: введите число`;
  if (value <= 0) return `${label}: значение должно быть больше нуля`;
  if (value < MIN_TTL_HOURS_FRAC) return `${label}: минимум 1 минута`;
  if (value > MAX_TTL_HOURS) return `${label}: не больше ${MAX_TTL_HOURS} часов (30 дней)`;
  return undefined;
}

function validateThreshold(raw: string): string | undefined {
  const value = parseNumber(raw);
  if (value === null) return "Порог: введите число";
  if (value <= 0) return "Порог: значение должно быть больше нуля";
  if (value > 100) return "Порог: не больше 100%";
  return undefined;
}

export function LifecycleSettingsForm() {
  const { data, isLoading, error } = useLifecycleSettings();
  const { mutate, isPending, error: patchError } = usePatchLifecycleSettings();
  const { user } = useMe();

  const [form, setForm] = useState<IFormState>({
    defaultTtlHours: "",
    freezeTtlHours: "",
    capacityThreshold: "",
  });

  useEffect(() => {
    if (data) {
      setForm({
        defaultTtlHours: String(secondsToHours(data.stand_default_ttl_seconds)),
        freezeTtlHours: String(secondsToHours(data.stand_freeze_ttl_seconds)),
        capacityThreshold: String(data.capacity_threshold_percent),
      });
    }
  }, [data]);

  const errors: IFormErrors = useMemo(
    () => ({
      defaultTtlHours: validateTtlHours(form.defaultTtlHours, "TTL стенда"),
      freezeTtlHours: validateTtlHours(form.freezeTtlHours, "TTL заморозки"),
      capacityThreshold: validateThreshold(form.capacityThreshold),
    }),
    [form],
  );

  const hasErrors = Boolean(
    errors.defaultTtlHours || errors.freezeTtlHours || errors.capacityThreshold,
  );

  const isDirty = useMemo(() => {
    if (!data) return false;
    return (
      Number(form.defaultTtlHours.replace(",", ".")) !==
        secondsToHours(data.stand_default_ttl_seconds) ||
      Number(form.freezeTtlHours.replace(",", ".")) !==
        secondsToHours(data.stand_freeze_ttl_seconds) ||
      Number(form.capacityThreshold.replace(",", ".")) !== data.capacity_threshold_percent
    );
  }, [data, form]);

  if (error) return <ErrorBox error={error} title="Не удалось загрузить настройки" />;

  if (isLoading || !data) {
    return (
      <div className="max-w-3xl rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="px-5 py-4 grid grid-cols-[1fr_136px] gap-x-3 items-center"
          >
            <div className="space-y-2 min-w-0">
              <SkeletonLine width="w-32" height="h-3.5" />
              <SkeletonLine width="w-3/4" height="h-3" />
            </div>
            <SkeletonLine width="w-24" height="h-10" className="rounded-xl ml-auto mr-5" />
          </div>
        ))}
      </div>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasErrors) return;

    const defaultTtlSeconds = Math.round(
      Number(form.defaultTtlHours.replace(",", ".")) * HOUR,
    );
    const freezeTtlSeconds = Math.round(
      Number(form.freezeTtlHours.replace(",", ".")) * HOUR,
    );
    const threshold = Number(form.capacityThreshold.replace(",", "."));

    mutate({
      stand_default_ttl_seconds: defaultTtlSeconds,
      stand_freeze_ttl_seconds: freezeTtlSeconds,
      capacity_threshold_percent: threshold,
      updated_by: user?.externalId,
    });
  };

  const handleReset = () => {
    if (!data) return;
    setForm({
      defaultTtlHours: String(secondsToHours(data.stand_default_ttl_seconds)),
      freezeTtlHours: String(secondsToHours(data.stand_freeze_ttl_seconds)),
      capacityThreshold: String(data.capacity_threshold_percent),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl">
      <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100">
        <SettingRow
          title="TTL стенда"
          description="Через сколько часов после старта стенд автоматически удаляется"
          unit="ч"
          value={form.defaultTtlHours}
          error={errors.defaultTtlHours}
          onChange={(value) => setForm((prev) => ({ ...prev, defaultTtlHours: value }))}
        />

        <SettingRow
          title="TTL заморозки"
          description="Сколько часов хранить замороженный стенд для разбора преподавателем"
          unit="ч"
          value={form.freezeTtlHours}
          error={errors.freezeTtlHours}
          onChange={(value) => setForm((prev) => ({ ...prev, freezeTtlHours: value }))}
        />

        <SettingRow
          title="Capacity guard"
          description="Порог утилизации кластера КИ, выше которого запуск новых стендов блокируется"
          unit="%"
          value={form.capacityThreshold}
          error={errors.capacityThreshold}
          onChange={(value) => setForm((prev) => ({ ...prev, capacityThreshold: value }))}
        />
      </div>

      {patchError && (
        <div className="mt-4">
          <ErrorBox error={patchError} />
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={handleReset}
          disabled={!isDirty || isPending}
        >
          Сбросить
        </Button>
        <Button type="submit" isLoading={isPending} disabled={!isDirty || hasErrors}>
          Сохранить изменения
        </Button>
      </div>
    </form>
  );
}

interface ISettingRowProps {
  title: string;
  description: string;
  unit: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function SettingRow({
  title,
  description,
  unit,
  value,
  error,
  onChange,
}: ISettingRowProps) {
  return (
    <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3 sm:gap-x-3 items-start">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ki-dark leading-tight">{title}</h3>
        <p className="mt-1 text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 justify-end">
          <Input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            error={error}
            fullWidth={false}
            style={{ width: "120px" }}
            className="text-sm font-semibold text-center tabular-nums"
          />
          <span className="text-xs text-gray-500 w-3 text-left">{unit}</span>
        </div>
      </div>
    </div>
  );
}
