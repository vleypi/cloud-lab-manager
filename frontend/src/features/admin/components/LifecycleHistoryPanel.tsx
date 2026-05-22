"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/shared/ui/Badge";
import { Card, CardHeader } from "@/shared/ui/Card";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Select } from "@/shared/ui/Select";
import { Skeleton, SkeletonLine } from "@/shared/ui/Skeleton";

import { useLifecycleHistory } from "@/features/admin/hooks/useLifecycleHistory";
import { ILifecycleSettingChange } from "@/features/admin/interfaces/admin.interfaces";

const KEY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Все настройки" },
  { value: "stand_default_ttl_seconds", label: "TTL стенда" },
  { value: "stand_freeze_ttl_seconds", label: "TTL заморозки" },
  { value: "capacity_threshold_percent", label: "Capacity guard" },
];

const KEY_LABEL: Record<string, string> = {
  stand_default_ttl_seconds: "TTL стенда",
  stand_freeze_ttl_seconds: "TTL заморозки",
  capacity_threshold_percent: "Capacity guard",
};

const KEY_UNIT: Record<string, string> = {
  stand_default_ttl_seconds: "с",
  stand_freeze_ttl_seconds: "с",
  capacity_threshold_percent: "%",
};

function formatValue(key: string, value: string | null): string {
  if (value === null || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (key === "stand_default_ttl_seconds" || key === "stand_freeze_ttl_seconds") {
    const hours = numeric / 3600;
    const rounded = Math.round(hours * 100) / 100;
    return `${rounded} ч (${numeric} с)`;
  }
  if (key === "capacity_threshold_percent") {
    return `${numeric}%`;
  }
  return `${numeric} ${KEY_UNIT[key] ?? ""}`.trim();
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function LifecycleHistoryPanel({ className }: { className?: string }) {
  const [filterKey, setFilterKey] = useState<string>("");
  const { data, isLoading, error } = useLifecycleHistory({
    key: filterKey || undefined,
    limit: 50,
    offset: 0,
  });

  const rows = useMemo(() => data?.items ?? [], [data]);

  return (
    <Card className={className}>
      <CardHeader
        title="История изменений настроек"
        description="Кто и когда менял лимиты жизненного цикла"
        actions={
          <Select
            value={filterKey}
            onChange={(event) => setFilterKey(event.target.value)}
            options={KEY_OPTIONS}
            fullWidth={false}
            className="text-sm"
          />
        }
      />

      {error ? (
        <ErrorBox error={error} title="Не удалось загрузить историю" />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-24 h-4 rounded" />
              <SkeletonLine width="w-40" height="h-3" />
              <SkeletonLine width="w-32" height="h-3" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="История пуста"
          description="Изменения настроек жизненного цикла появятся здесь после первого PATCH"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4 font-medium">Дата</th>
                <th className="py-2 pr-4 font-medium">Настройка</th>
                <th className="py-2 pr-4 font-medium">Было</th>
                <th className="py-2 pr-4 font-medium">Стало</th>
                <th className="py-2 pr-4 font-medium">Автор</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: ILifecycleSettingChange) => (
                <tr key={row.id} className="border-b border-gray-50 last:border-b-0">
                  <td className="py-2 pr-4 text-xs text-gray-500 whitespace-nowrap tabular-nums">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge tone="info" size="sm">
                      {KEY_LABEL[row.key] ?? row.key}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 text-gray-500 tabular-nums">
                    {formatValue(row.key, row.old_value)}
                  </td>
                  <td className="py-2 pr-4 font-semibold text-ki-dark tabular-nums">
                    {formatValue(row.key, row.new_value)}
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-600">
                    {row.updated_by ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
