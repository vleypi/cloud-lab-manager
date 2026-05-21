"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Card, CardHeader } from "@/shared/ui/Card";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Skeleton } from "@/shared/ui/Skeleton";
import { AlertTriangleIcon, ChevronLeftIcon } from "@/shared/icons/index-icons";
import { ROUTES } from "@/shared/config/routes.constant";
import { formatRelative } from "@/shared/utils/format.util";

import { InspectorPanel } from "@/features/inspector/components/InspectorPanel";
import { StandActions } from "@/features/stands/components/StandActions";
import { StandAuditLog } from "@/features/stands/components/StandAuditLog";
import { StandDetails } from "@/features/stands/components/StandDetails";
import { StandFsmTimeline } from "@/features/stands/components/StandFsmTimeline";
import { StandStatusBadge } from "@/features/stands/components/StandStatusBadge";
import { useStand } from "@/features/stands/hooks/useStand";

interface IStandDetailScreenProps {

  mode: "admin";
}

export function StandDetailScreen({ mode }: IStandDetailScreenProps) {
  const params = useParams<{ standId: string }>();
  const standId = params?.standId ?? null;
  const { data: stand, isLoading, error } = useStand(standId);

  const backHref = ROUTES.ADMIN.STANDS;
  const backLabel = "К списку всех стендов";

  if (isLoading || !stand) {
    return (
      <>
        <PageHeader title="Загрузка стенда..." />
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Стенд недоступен" />
        <ErrorBox error={error} title="Не удалось получить стенд" />
      </>
    );
  }

  const titleDescription = buildDescription(stand, mode);

  return (
    <>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ki-dark mb-3"
      >
        <ChevronLeftIcon size={14} /> {backLabel}
      </Link>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-3 flex-wrap">
            {stand.lab_code ?? "Стенд"}
            <StandStatusBadge status={stand.status} size="md" />
          </span>
        }
        description={titleDescription}
      />

      {stand.incident_reported && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangleIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-amber-900">
                  Студент сообщил о проблеме
                </h3>
                {stand.incident_reported_at && (
                  <span className="text-xs text-amber-700/80">
                    {formatRelative(stand.incident_reported_at)}
                  </span>
                )}
              </div>
              {stand.incident_description && (
                <p className="mt-2 text-sm text-amber-900/90 leading-relaxed whitespace-pre-wrap">
                  {stand.incident_description}
                </p>
              )}
              <p className="mt-2 text-xs text-amber-700/80">
                Стенд заморожен для аудита. Разморозьте, чтобы продолжить лабораторную, или
                удалите по результатам разбора. Пометка инцидента снимется автоматически при
                разморозке.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 mb-6">
        <Card>
          <CardHeader
            title="Жизненный цикл"
            description="Backend асинхронно выполняет шаги через очередь задач"
          />
          <StandFsmTimeline status={stand.status} statusReason={stand.status_reason} />
        </Card>

        <Card>
          <CardHeader
            title="Действия"
            description={mode === "admin" ? "Управление стендом студента" : undefined}
          />
          <StandActions stand={stand} mode={mode} />
        </Card>
      </div>

      <div className="grid gap-6 mb-6">
        <StandDetails stand={stand} />
      </div>

      <div className="grid gap-6 mb-6">
        <StandAuditLog stand={stand} />
      </div>

      <InspectorPanel
        standId={stand.id}
        isStandReady={stand.status === "ready"}
        readOnly={mode === "admin"}
      />
    </>
  );
}

function buildDescription(
  stand: { id: string; course_code: string | null; owner_display_name: string | null; owner_external_id: string },
  mode: "student" | "admin",
): string {
  const sessionPart = `сессия ${stand.id.slice(0, 8)}…`;
  if (mode === "admin") {
    const owner = stand.owner_display_name ?? stand.owner_external_id;
    return `Студент ${owner} · ${sessionPart}`;
  }
  return stand.course_code ? `Курс ${stand.course_code} · ${sessionPart}` : sessionPart;
}
