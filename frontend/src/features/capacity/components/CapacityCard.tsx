"use client";

import { Badge } from "@/shared/ui/Badge";
import { Card, CardHeader } from "@/shared/ui/Card";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { ProgressBar } from "@/shared/ui/ProgressBar";
import { Skeleton, SkeletonLine } from "@/shared/ui/Skeleton";
import { ActivityIcon, AlertTriangleIcon, CheckCircleIcon } from "@/shared/icons/index-icons";
import {
  formatGigabytes,
  formatMegabytes,
  formatNumber,
  formatPercent,
} from "@/shared/utils/format.util";

import { useCapacity } from "@/features/capacity/hooks/useCapacity";
import { IResourceUsage } from "@/features/capacity/interfaces/capacity.interfaces";

interface ICapacityCardProps {
  className?: string;
}

export function CapacityCard({ className }: ICapacityCardProps) {
  const { data, isLoading, error } = useCapacity();

  if (error) return <ErrorBox error={error} title="Не удалось получить состояние кластера" />;

  return (
    <Card className={className}>
      <CardHeader
        title="Загрузка кластера КИ"
        description="Контроль ёмкости перед запуском стендов"
        actions={data ? <CapacityVerdict allowed={data.allowed} reason={data.reason} /> : null}
      />

      {isLoading || !data ? (
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <SkeletonLine width="w-20" height="h-3.5" />
                <SkeletonLine width="w-32" height="h-3" />
              </div>
              <Skeleton className="h-2 rounded-full" />
            </div>
          ))}
          <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded" />
            <SkeletonLine width="w-40" height="h-3" />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <UsageRow
            label="vCPU"
            usage={data.utilization.vcpus}
            threshold={data.threshold_percent}
            formatValue={(v) => `${formatNumber(Math.round(v))} ядер`}
          />
          <UsageRow
            label="Память"
            usage={data.utilization.memory_mb}
            threshold={data.threshold_percent}
            formatValue={(v) => formatMegabytes(v)}
          />
          <UsageRow
            label="Локальный диск"
            usage={data.utilization.local_gb}
            threshold={data.threshold_percent}
            formatValue={(v) => formatGigabytes(v)}
          />

          <div className="flex items-center gap-2 pt-3 border-t border-gray-100 text-sm text-gray-600">
            <ActivityIcon size={16} className="text-gray-400" />
            <span>Запущенных ВМ: <strong className="text-ki-dark">{data.utilization.running_vms}</strong></span>
            <span className="text-gray-300">·</span>
            <span>
              Порог отказа: <strong className="text-ki-dark">{formatPercent(data.threshold_percent)}</strong>
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

interface IUsageRowProps {
  label: string;
  usage: IResourceUsage;
  threshold: number;
  formatValue: (value: number) => string;
}

function UsageRow({ label, usage, threshold, formatValue }: IUsageRowProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium text-ki-dark">{label}</span>
        <div className="text-sm text-gray-500">
          <span className="text-ki-dark font-semibold">{formatValue(usage.used)}</span>
          <span className="text-gray-400"> / {formatValue(usage.total)}</span>
          <span className="text-gray-400 ml-2">({formatPercent(usage.percent)})</span>
        </div>
      </div>
      <ProgressBar value={usage.percent} threshold={threshold} warnAt={threshold - 20} />
    </div>
  );
}

function CapacityVerdict({ allowed, reason }: { allowed: boolean; reason: string | null }) {
  if (allowed) {
    return (
      <Badge tone="success" size="md">
        Запуск разрешён
      </Badge>
    );
  }
  return (
    <Badge tone="danger" size="md" pulse>
      <AlertTriangleIcon size={12} />
      {reason ?? "Запуск заблокирован"}
    </Badge>
  );
}
