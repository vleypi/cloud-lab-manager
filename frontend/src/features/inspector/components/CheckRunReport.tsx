"use client";

import { useMemo } from "react";

import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Badge } from "@/shared/ui/Badge";
import { FileIcon } from "@/shared/icons/index-icons";
import { Skeleton, SkeletonLine } from "@/shared/ui/Skeleton";
import { formatDateTime } from "@/shared/utils/format.util";

import { CheckRunBadge } from "@/features/inspector/components/CheckRunBadge";
import { CheckSectionGroup } from "@/features/inspector/components/CheckSectionGroup";
import { SECTION_ORDER } from "@/features/inspector/constants/inspector.constants";
import { useCheckRun } from "@/features/inspector/hooks/useCheckRun";
import {
  ICheckResult,
  TCheckSection,
} from "@/features/inspector/interfaces/inspector.interfaces";

interface ICheckRunReportProps {
  runId: string | null;
}

export function CheckRunReport({ runId }: ICheckRunReportProps) {
  const { data: run, isLoading, error } = useCheckRun(runId);

  const groupedResults = useMemo(() => {
    if (!run) return [] as { section: TCheckSection; results: ICheckResult[] }[];
    const buckets = new Map<TCheckSection, ICheckResult[]>();
    for (const r of run.results) {
      const key: TCheckSection = (r.section as TCheckSection) || "other";
      const arr = buckets.get(key) ?? [];
      arr.push(r);
      buckets.set(key, arr);
    }
    const ordered: { section: TCheckSection; results: ICheckResult[] }[] = [];
    for (const section of SECTION_ORDER) {
      const items = buckets.get(section);
      if (items && items.length > 0) {
        ordered.push({ section, results: items });
        buckets.delete(section);
      }
    }
    for (const [section, results] of buckets.entries()) {
      ordered.push({ section, results });
    }
    return ordered;
  }, [run]);

  if (!runId) {
    return (
      <div className="border border-gray-100 rounded-2xl bg-white flex flex-col items-center justify-center text-center min-h-[280px] py-12 px-6">
        <div className="w-12 h-12 bg-ki-blue-soft rounded-2xl flex items-center justify-center text-ki-blue mb-4">
          <FileIcon size={22} />
        </div>
        <h4 className="text-sm font-semibold text-ki-dark">Выберите запуск</h4>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
          Кликните на запуск из истории слева — здесь появится детальный отчёт с результатами проверок
        </p>
      </div>
    );
  }

  if (error) return <ErrorBox error={error} title="Не удалось получить отчёт" />;

  if (isLoading || !run) {
    return (
      <div className="border border-gray-100 rounded-2xl bg-white p-5 space-y-3">
        <SkeletonLine width="w-48" height="h-5" />
        <SkeletonLine width="w-1/2" height="h-3" />
        <div className="grid grid-cols-4 gap-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="border border-gray-100 rounded-2xl bg-white p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-mono text-base font-semibold text-ki-dark truncate">
            {run.template_name}
            {run.template_version && (
              <span className="text-gray-400 text-sm ml-2 font-normal">
                v{run.template_version}
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {run.started_at
              ? `Запущен ${formatDateTime(run.started_at)}${run.finished_at ? ` · Завершён ${formatDateTime(run.finished_at)}` : ""}`
              : "Ожидает исполнения..."}
          </p>
        </div>
        <CheckRunBadge status={run.status} />
      </div>

      <div className="grid grid-cols-4 gap-2 mb-5">
        <Pill label="Всего" value={run.total} tone="bg-gray-100 text-gray-700" />
        <Pill label="Пройдено" value={run.passed} tone="bg-emerald-50 text-emerald-700" />
        <Pill label="Не пройдено" value={run.failed} tone="bg-red-50 text-red-700" />
        <Pill label="Ошибки" value={run.errored} tone="bg-amber-50 text-amber-700" />
      </div>

      {run.summary && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm text-ki-dark flex items-start gap-2">
          <Badge tone="neutral">SUMMARY</Badge>
          <span className="min-w-0 flex-1">{run.summary}</span>
        </div>
      )}

      {run.results.length === 0 ? (
        <EmptyState
          icon={<FileIcon size={20} />}
          title="Результатов пока нет"
          description="Проверки ещё не выполнялись — статус: ожидание"
        />
      ) : (
        <div className="space-y-3">
          {groupedResults.map(({ section, results }) => (
            <CheckSectionGroup key={section} section={section} results={results} />
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`px-3 py-2 rounded-xl ${tone}`}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-[11px] uppercase tracking-wide mt-1 opacity-80">{label}</div>
    </div>
  );
}
