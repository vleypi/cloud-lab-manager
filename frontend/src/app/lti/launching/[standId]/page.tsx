"use client";

import { useParams } from "next/navigation";

import { Card, CardHeader } from "@/shared/ui/Card";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { LogoBadge } from "@/shared/icons/LogoBadge";
import { Skeleton, SkeletonLine } from "@/shared/ui/Skeleton";

import { InspectorPanel } from "@/features/inspector/components/InspectorPanel";
import { StandConsole } from "@/features/stands/components/StandConsole";
import { StandActions } from "@/features/stands/components/StandActions";
import { StandFsmTimeline } from "@/features/stands/components/StandFsmTimeline";
import { StandStatusBadge } from "@/features/stands/components/StandStatusBadge";
import { StandStudentSummary } from "@/features/stands/components/StandStudentSummary";
import { useStand } from "@/features/stands/hooks/useStand";

export default function LtiEmbedPage() {
  const params = useParams<{ standId: string }>();
  const standId = params?.standId ?? null;

  const { data: stand, isLoading, error } = useStand(standId);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <Header />

        {isLoading || !stand ? (
          <div className="space-y-5">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <div className="space-y-2">
                <SkeletonLine width="w-24" height="h-5" />
                <SkeletonLine width="w-1/2" height="h-3" />
              </div>
              <div className="flex items-center pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center gap-2 w-24">
                      <Skeleton className="w-9 h-9 rounded-full" />
                      <SkeletonLine width="w-16" height="h-2.5" />
                    </div>
                    {i < 2 && <Skeleton className="flex-1 h-0.5 mx-1 rounded-full" />}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-3">
              <SkeletonLine width="w-32" height="h-4" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          </div>
        ) : error ? (
          <ErrorBox error={error} title="Не удалось получить стенд" />
        ) : (
          <div className="space-y-5">
            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-3 flex-wrap">
                    {stand.lab_code ?? "Лабораторная работа"}
                    <StandStatusBadge status={stand.status} />
                  </span>
                }
                description={
                  stand.course_code
                    ? `Курс ${stand.course_code} · сессия ${stand.id.slice(0, 8)}…`
                    : `Сессия ${stand.id.slice(0, 8)}…`
                }
              />
              <StandFsmTimeline
                status={stand.status}
                statusReason={stand.status_reason}
                compactWhenReady
              />
            </Card>

            {stand.status === "ready" && (
              <Card>
                <CardHeader
                  title="Рабочий стол стенда"
                  description="Подключение к ВМ открывается прямо в Moodle"
                />
                <StandConsole stand={stand} />
              </Card>
            )}

            <Card>
              <CardHeader title="Действия" />
              <StandActions stand={stand} mode="student" />
            </Card>

            <StandStudentSummary stand={stand} />

            <InspectorPanel
              standId={stand.id}
              isStandReady={stand.status === "ready"}
              lockedTemplate={stand.lab_code}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-3 mb-5">
      <LogoBadge height={32} />
    </div>
  );
}
