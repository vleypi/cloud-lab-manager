"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/shared/ui/Button";
import { Card, CardHeader } from "@/shared/ui/Card";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Select } from "@/shared/ui/Select";
import { Skeleton } from "@/shared/ui/Skeleton";
import { ActivityIcon, PlayIcon } from "@/shared/icons/index-icons";
import { cn } from "@/shared/utils/cn";
import { formatRelative } from "@/shared/utils/format.util";

import { CheckRunBadge } from "@/features/inspector/components/CheckRunBadge";
import { CheckRunReport } from "@/features/inspector/components/CheckRunReport";
import { useInspectorTemplates } from "@/features/inspector/hooks/useInspectorTemplates";
import { useScheduleCheck } from "@/features/inspector/hooks/useScheduleCheck";
import { useStandRuns } from "@/features/inspector/hooks/useStandRuns";

interface IInspectorPanelProps {
  standId: string;
  isStandReady: boolean;

  readOnly?: boolean;
}

export function InspectorPanel({ standId, isStandReady, readOnly = false }: IInspectorPanelProps) {
  const [templateName, setTemplateName] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: runs, isLoading, error } = useStandRuns(standId);
  const { data: templates } = useInspectorTemplates();
  const { mutate, isPending, error: scheduleError } = useScheduleCheck();

  useEffect(() => {
    if (!selectedRunId && runs && runs.length > 0) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  useEffect(() => {
    if (!templateName && templates && templates.length > 0) {
      setTemplateName(templates[0].name);
    }
  }, [templates, templateName]);

  const handleSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!templateName.trim()) return;
    mutate(
      { standId, payload: { template_name: templateName.trim() } },
      { onSuccess: (data) => setSelectedRunId(data.run.id) },
    );
  };

  return (
    <Card>
      <CardHeader
        title={readOnly ? "История SSH-проверок" : "Автоматическая проверка"}
        description={
          readOnly
            ? "Просмотр результатов проверок выполненных по запросу студента"
            : "SSH-инспектор подключается к ВМ и валидирует конфигурацию по YAML-шаблону"
        }
      />

      {!readOnly && (
        <form
          onSubmit={handleSchedule}
          className="flex flex-col sm:flex-row gap-3 mb-5 sm:items-end"
        >
          <div className="flex-1">
            <Select
              label="Шаблон проверки"
              placeholder="Выберите шаблон..."
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              options={(templates ?? []).map((template) => ({
                value: template.name,
                label: `${template.name} — ${template.display_name} (${template.checks_count} ш.)`,
              }))}
              hint={isStandReady ? undefined : "Доступно только когда стенд в статусе READY"}
            />
          </div>
          <Button
            type="submit"
            iconLeft={<PlayIcon size={14} />}
            isLoading={isPending}
            disabled={!isStandReady || !templateName}
          >
            Запустить проверку
          </Button>
        </form>
      )}

      {!readOnly && scheduleError && <ErrorBox error={scheduleError} className="mb-4" />}
      {error && <ErrorBox error={error} title="Не удалось получить историю" className="mb-4" />}

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <aside className="border border-gray-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
            История запусков
          </div>
          {isLoading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          ) : !runs || runs.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <div className="w-10 h-10 mx-auto rounded-xl bg-gray-50 border border-gray-100 text-gray-400 flex items-center justify-center">
                <ActivityIcon size={18} />
              </div>
              <p className="mt-3 text-sm font-semibold text-ki-dark">Пока нет запусков</p>
              <p className="text-xs text-gray-500 mt-1">
                Запустите проверку — история появится здесь
              </p>
            </div>
          ) : (
            <ul className="ki-scrollbar-thin overflow-y-auto max-h-96 divide-y divide-gray-100">
              {runs.map((run) => {
                const isActive = selectedRunId === run.id;
                return (
                  <li key={run.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 transition flex items-start justify-between gap-3",
                        isActive ? "bg-ki-blue-light" : "hover:bg-gray-50",
                      )}
                    >
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "text-sm font-medium truncate",
                            isActive ? "text-ki-blue-strong" : "text-ki-dark",
                          )}
                        >
                          {run.template_name}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {formatRelative(run.created_at)} · {run.passed}/{run.total} OK
                        </div>
                      </div>
                      <CheckRunBadge status={run.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <CheckRunReport runId={selectedRunId} />
      </div>
    </Card>
  );
}
