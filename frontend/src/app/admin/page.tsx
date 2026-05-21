"use client";

import Link from "next/link";

import { Card, CardHeader } from "@/shared/ui/Card";
import { Donut } from "@/shared/ui/Donut";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Skeleton, SkeletonCircle, SkeletonLine, SkeletonStatCard } from "@/shared/ui/Skeleton";
import { StatCard } from "@/shared/ui/StatCard";
import { ROUTES } from "@/shared/config/routes.constant";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  LayersIcon,
  ServerIcon,
} from "@/shared/icons/index-icons";
import { formatPercent, formatRelative } from "@/shared/utils/format.util";

import { CapacityCard } from "@/features/capacity/components/CapacityCard";
import { useCapacity } from "@/features/capacity/hooks/useCapacity";
import { usePoolInventory } from "@/features/pool/hooks/usePoolInventory";
import { StandStatusBadge } from "@/features/stands/components/StandStatusBadge";
import { ACTIVE_STATUSES } from "@/features/stands/constants/stands.constants";
import { useAllStands } from "@/features/stands/hooks/useAllStands";

export default function AdminOverviewPage() {
  const { data: stands, isLoading: standsLoading } = useAllStands({ limit: 50 });
  const { data: inventory, isLoading: inventoryLoading } = usePoolInventory();
  const recent = (stands ?? []).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Обзор кластера"
        description="Состояние ресурсов КИ и пула проектов в реальном времени"
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 mb-4">
        <CapacityCard />
        <PoolBreakdownCard
          inventory={inventory}
          loading={inventoryLoading}
        />
      </div>

      <Card>
        <CardHeader
          title="Последние стенды"
          description="Свежие стенды по времени обновления"
          actions={
            recent.length > 0 ? (
              <Link
                href={ROUTES.ADMIN.STANDS}
                className="text-sm font-medium text-ki-blue hover:text-ki-blue-strong inline-flex items-center gap-1"
              >
                Все стенды
                <ChevronRightIcon size={14} />
              </Link>
            ) : null
          }
        />
        {standsLoading ? (
          <ul className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <SkeletonLine width="w-24" height="h-3.5" />
                    <SkeletonLine width="w-16" height="h-4" className="rounded-md" />
                  </div>
                  <SkeletonLine width="w-3/5" height="h-2.5" />
                </div>
                <SkeletonCircle size="w-4 h-4" />
              </li>
            ))}
          </ul>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<ServerIcon size={22} />}
            title="Стендов пока нет"
            description="Студенты ещё не запускали лабораторные работы. Активные стенды появятся здесь сразу после первого запуска."
          />
        ) : (
          <ul className="space-y-2">
            {recent.map((stand) => (
              <li key={stand.id}>
                <Link
                  href={ROUTES.ADMIN.STAND(stand.id)}
                  className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:border-ki-blue/40 hover:bg-ki-blue-soft transition group"
                >
                  <div className="w-9 h-9 rounded-xl bg-ki-blue-light text-ki-blue flex items-center justify-center flex-shrink-0">
                    <ServerIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ki-dark truncate">
                        {stand.lab_code ?? "Стенд"}
                      </span>
                      <StandStatusBadge status={stand.status} />
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {stand.owner_display_name ?? stand.owner_external_id} ·{" "}
                      {stand.pool_project.ki_project_name} · {formatRelative(stand.updated_at)}
                    </div>
                  </div>
                  <ChevronRightIcon
                    size={16}
                    className="text-gray-300 group-hover:text-ki-blue group-hover:translate-x-0.5 transition flex-shrink-0"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

interface IStatCardLinkableProps {
  href?: string;
  label: string;
  value: React.ReactNode;
  hint?: string;
  loading?: boolean;
  icon: React.ReactNode;
  color: "blue" | "green" | "violet" | "amber" | "cyan" | "red" | "gray";
}

function StatCardLinkable({
  href,
  label,
  value,
  hint,
  loading,
  icon,
  color,
}: IStatCardLinkableProps) {
  if (loading) {
    return <SkeletonStatCard />;
  }
  const card = (
    <StatCard
      label={label}
      value={value}
      icon={icon}
      color={color}
      hint={hint}
      className={href ? "hover:border-ki-blue/40 hover:shadow-sm transition cursor-pointer" : ""}
    />
  );
  if (!href) return card;
  return (
    <Link href={href} className="block group">
      {card}
    </Link>
  );
}

interface IPoolBreakdownCardProps {
  inventory:
    | {
        free: number;
        allocated: number;
        cleaning: number;
        disabled: number;
      }
    | undefined;
  loading: boolean;
}

function PoolBreakdownCard({ inventory, loading }: IPoolBreakdownCardProps) {
  return (
    <Card>
      <CardHeader
        title="Состояние пула"
        description="Распределение проектов по статусам"
      />
      {loading || !inventory ? (
        <div className="py-2 flex items-center gap-5">
          <SkeletonCircle size="w-[140px] h-[140px]" />
          <div className="flex-1 min-w-0 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton className="w-2.5 h-2.5 rounded-full" />
                <SkeletonLine width="w-24" height="h-3" />
                <SkeletonLine width="w-8" height="h-3" className="ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-2">
          <Donut
            size={140}
            segments={[
              { value: inventory.free, color: "#2d8a52", label: "Свободные" },
              { value: inventory.allocated, color: "#1b5e3f", label: "Занятые" },
              { value: inventory.cleaning, color: "#b8862a", label: "В очистке" },
              { value: inventory.disabled, color: "#9aa6a0", label: "Отключённые" },
            ]}
          />
        </div>
      )}
    </Card>
  );
}
