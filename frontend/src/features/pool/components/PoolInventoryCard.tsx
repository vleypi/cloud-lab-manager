"use client";

import { StatCard, TStatCardColor } from "@/shared/ui/StatCard";
import { SkeletonStatCard } from "@/shared/ui/Skeleton";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { LayersIcon, RocketIcon, RefreshIcon, MinusIcon } from "@/shared/icons/index-icons";
import { formatNumber } from "@/shared/utils/format.util";

import { usePoolInventory } from "@/features/pool/hooks/usePoolInventory";
import { TPoolProjectStatus } from "@/features/pool/interfaces/pool.interfaces";

interface IInventoryItem {
  status: TPoolProjectStatus;
  label: string;
  icon: React.ReactNode;
  color: TStatCardColor;
}

const ITEMS: ReadonlyArray<IInventoryItem> = [
  { status: "free", label: "Свободные проекты", icon: <LayersIcon size={20} />, color: "green" },
  { status: "allocated", label: "Занятые проекты", icon: <RocketIcon size={20} />, color: "blue" },
  { status: "cleaning", label: "В очистке", icon: <RefreshIcon size={20} />, color: "amber" },
  { status: "disabled", label: "Отключённые", icon: <MinusIcon size={20} />, color: "gray" },
];

export function PoolInventoryCard() {
  const { data, isLoading, error } = usePoolInventory();

  if (error) return <ErrorBox error={error} title="Не удалось получить состояние пула" />;

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ITEMS.map((item) => (
          <SkeletonStatCard key={item.status} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {ITEMS.map((item) => (
        <StatCard
          key={item.status}
          label={item.label}
          value={formatNumber(data[item.status])}
          icon={item.icon}
          color={item.color}
        />
      ))}
    </div>
  );
}
