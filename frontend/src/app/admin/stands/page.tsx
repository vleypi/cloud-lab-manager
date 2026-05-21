"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/shared/ui/Badge";
import { cn } from "@/shared/utils/cn";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { AlertTriangleIcon, InfoIcon, SearchIcon, ServerIcon } from "@/shared/icons/index-icons";
import { Input } from "@/shared/ui/Input";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Select } from "@/shared/ui/Select";
import { SkeletonTable } from "@/shared/ui/Skeleton";
import { ROUTES } from "@/shared/config/routes.constant";
import { formatRelative } from "@/shared/utils/format.util";

import { AdminStandRowActions } from "@/features/stands/components/AdminStandRowActions";
import {
  ACTIVE_STATUSES,
  STATUS_LABELS,
  STATUS_PULSE,
  STATUS_TONE,
} from "@/features/stands/constants/stands.constants";
import { useAllStands } from "@/features/stands/hooks/useAllStands";
import { IStand, TStandStatus } from "@/features/stands/interfaces/stands.interfaces";

type TFilter = "active" | "incidents" | "all";
type TStatusFilter = TStandStatus | "any";

const STATUS_FILTER_OPTIONS = [
  { value: "any", label: "Любой статус" },
  ...(Object.entries(STATUS_LABELS) as [TStandStatus, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

export default function AdminAllStandsPage() {
  const [filter, setFilter] = useState<TFilter>("active");
  const [statusFilter, setStatusFilter] = useState<TStatusFilter>("any");
  const [search, setSearch] = useState("");
  const { data: stands, isLoading, error } = useAllStands({ limit: 200 });

  const incidentCount = useMemo(
    () => (stands ?? []).filter((s) => s.incident_reported).length,
    [stands],
  );

  const filtered = useMemo(() => {
    const base = (stands ?? []).filter((stand) => {
      if (filter === "active") return ACTIVE_STATUSES.has(stand.status);
      if (filter === "incidents") return stand.incident_reported;
      return true;
    });
    const byStatus =
      statusFilter === "any" ? base : base.filter((stand) => stand.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((stand) =>
      [
        stand.owner_external_id,
        stand.owner_display_name,
        stand.lab_code,
        stand.course_code,
        stand.pool_project.ki_project_name,
        stand.pool_project.ki_domain_name,
      ]
        .filter(Boolean)
        .some((field) => (field as string).toLowerCase().includes(q)),
    );
  }, [stands, filter, statusFilter, search]);

  return (
    <>
      <PageHeader
        title="Стенды"
        description="Все стенды студентов с фильтрацией по статусу"
      />

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="inline-flex items-center bg-gray-100 rounded-xl p-1">
          <SegmentButton active={filter === "active"} onClick={() => setFilter("active")}>
            Только активные
          </SegmentButton>
          <SegmentButton
            active={filter === "incidents"}
            onClick={() => setFilter("incidents")}
          >
            <span className="inline-flex items-center gap-1.5">
              Инциденты
              {incidentCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                  {incidentCount}
                </span>
              )}
            </span>
          </SegmentButton>
          <SegmentButton active={filter === "all"} onClick={() => setFilter("all")}>
            Все
          </SegmentButton>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <InfoIcon size={12} className="text-gray-400" />
          Найдено <strong className="text-ki-dark">{filtered.length}</strong>
        </span>
      </div>

      <div className="grid sm:grid-cols-[1fr_240px] gap-3 mb-4">
        <Input
          placeholder="Поиск по студенту, лабе или проекту"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          iconLeft={<SearchIcon size={14} />}
        />
        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as TStatusFilter)}
          options={STATUS_FILTER_OPTIONS}
        />
      </div>

      {error && <ErrorBox error={error} title="Не удалось загрузить список стендов" />}

      {!error && isLoading && (
        <SkeletonTable
          rows={5}
          columns={[
            { span: 3, lines: 2 },
            { span: 2, lines: 2 },
            { span: 2, lines: 2 },
            { span: 2, badge: true },
            { span: 1, lines: 1 },
            { span: 2, lines: 1, align: "right" },
          ]}
        />
      )}

      {!error && !isLoading && filtered.length === 0 && (
        <EmptyState
          icon={<ServerIcon size={20} />}
          title={filter === "active" ? "Нет активных стендов" : "Стендов пока нет"}
          description={
            filter === "active"
              ? "Студенты сейчас не работают, проекты пула свободны"
              : "Никто ещё не запускал стенды через шлюз"
          }
        />
      )}

      {!error && !isLoading && filtered.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">

          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-3 truncate">Студент</div>
            <div className="col-span-2 truncate">Лаба</div>
            <div className="col-span-2 truncate">Проект КИ</div>
            <div className="col-span-2 truncate">Статус</div>
            <div className="col-span-1 truncate">Обновлён</div>
            <div className="col-span-2 text-right truncate">Действия</div>
          </div>

          {filtered.map((stand, idx) => (
            <StandRow
              key={stand.id}
              stand={stand}
              isLast={idx === filtered.length - 1}
            />
          ))}
        </div>
      )}
    </>
  );
}

function StandRow({ stand, isLast }: { stand: IStand; isLast: boolean }) {
  const router = useRouter();
  const ownerLabel = stand.owner_display_name ?? stand.owner_external_id;
  const lab = stand.lab_code ?? "—";

  const goToDetail = () => router.push(ROUTES.ADMIN.STAND(stand.id));

  return (
    <div
      onClick={goToDetail}
      className={`grid grid-cols-12 gap-4 px-4 py-3.5 items-center hover:bg-gray-50 transition cursor-pointer group ${
        isLast ? "" : "border-b border-gray-100"
      }`}
    >
      <div className="col-span-3 min-w-0">
        <div className="font-medium text-ki-dark truncate">{ownerLabel}</div>
        {stand.owner_display_name && (
          <div className="text-xs text-gray-400 truncate font-mono">
            {stand.owner_external_id}
          </div>
        )}
      </div>

      <div className="col-span-2 min-w-0">
        <div className="text-ki-dark truncate">{lab}</div>
        {stand.course_code && (
          <div className="text-xs text-gray-400 truncate">{stand.course_code}</div>
        )}
      </div>

      <div className="col-span-2 min-w-0">
        <div className="text-ki-dark truncate">{stand.pool_project.ki_project_name}</div>
        <div className="text-xs text-gray-400 truncate">
          {stand.pool_project.ki_domain_name}
        </div>
      </div>

      <div className="col-span-2 min-w-0 flex items-center gap-1.5 flex-wrap">
        <Badge tone={STATUS_TONE[stand.status]} pulse={STATUS_PULSE[stand.status]}>
          {STATUS_LABELS[stand.status]}
        </Badge>
        {stand.incident_reported && (
          <span
            title="Студент сообщил о проблеме"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold uppercase tracking-wider"
          >
            <AlertTriangleIcon size={10} />
            инцидент
          </span>
        )}
      </div>

      <div className="col-span-1 text-xs text-gray-500 truncate">
        {formatRelative(stand.updated_at)}
      </div>

      <div className="col-span-2 flex items-center justify-end">
        <AdminStandRowActions stand={stand} />
      </div>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-3 rounded-lg text-xs font-medium transition",
        active
          ? "bg-white text-ki-dark shadow-sm"
          : "text-gray-500 hover:text-ki-dark",
      )}
    >
      {children}
    </button>
  );
}
