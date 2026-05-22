"use client";

import { Fragment } from "react";

import { cn } from "@/shared/utils/cn";
import { AlertTriangleIcon, CheckCircleIcon, SnowflakeIcon } from "@/shared/icons/index-icons";
import { Spinner } from "@/shared/ui/Spinner";

import {
  FSM_TIMELINE_STEPS,
  STATUS_DESCRIPTIONS,
  TFsmTimelineStatus,
} from "@/features/stands/constants/stands.constants";
import { TStandStatus } from "@/features/stands/interfaces/stands.interfaces";

interface IStandFsmTimelineProps {
  status: TStandStatus;
  statusReason?: string | null;
  // когда true и статус ready — рендерим компактный badge с раскрывашкой,
  // вместо полной шкалы. используется в student-вьюхе чтобы не шуметь
  compactWhenReady?: boolean;
}

type TStepState = "done" | "current" | "pending" | "failed";

export function StandFsmTimeline({ status, statusReason, compactWhenReady = false }: IStandFsmTimelineProps) {

  if (compactWhenReady && status === "ready") {
    return (
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer list-none py-2">
          <CheckCircleIcon size={18} className="text-emerald-500 flex-shrink-0" />
          <span className="text-sm font-medium text-ki-dark">Стенд готов, можно подключаться</span>
          <span className="ml-auto text-xs text-gray-400 group-open:hidden">показать этапы</span>
          <span className="ml-auto text-xs text-gray-400 hidden group-open:inline">скрыть</span>
        </summary>
        <div className="pt-3">
          <StandFsmTimeline status={status} statusReason={statusReason} />
        </div>
      </details>
    );
  }

  if (status === "destroyed") {
    return (
      <FinalState
        icon={<CheckCircleIcon className="w-6 h-6 text-emerald-500" />}
        title="Стенд удалён"
        description="Слот возвращён в пул, можно запустить новый"
      />
    );
  }
  if (status === "frozen") {
    return (
      <FinalState
        icon={<SnowflakeIcon className="w-6 h-6 text-cyan-500" />}
        title="Стенд заморожен"
        description="Auto-destroy отключён, ждём аудит преподавателя"
      />
    );
  }

  const stepsByStatus: Record<TFsmTimelineStatus, TStepState> = {
    allocating: "pending",
    deploying: "pending",
    ready: "pending",
  };

  if (status === "failed") {
    stepsByStatus.allocating = "done";
    stepsByStatus.deploying = "failed";
  } else if (status === "cleaning") {
    stepsByStatus.allocating = "done";
    stepsByStatus.deploying = "done";
    stepsByStatus.ready = "current";
  } else {
    for (const step of FSM_TIMELINE_STEPS) {
      if (step.status === status) {
        stepsByStatus[step.status] = "current";
        break;
      }
      stepsByStatus[step.status] = "done";
    }
    if (status === "ready") stepsByStatus.ready = "done";
  }

  return (
    <div className="space-y-3">

      <div className="flex items-center">
        {FSM_TIMELINE_STEPS.map((step, idx) => {
          const state = stepsByStatus[step.status];
          const isLast = idx === FSM_TIMELINE_STEPS.length - 1;
          const nextState = !isLast
            ? stepsByStatus[FSM_TIMELINE_STEPS[idx + 1].status]
            : "pending";
          return (
            <Fragment key={step.status}>
              <StepDot state={state} />
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 rounded-full transition-colors duration-300",
                    state === "done" && (nextState === "done" || nextState === "current")
                      ? "bg-ki-blue"
                      : state === "done"
                        ? "bg-ki-blue/40"
                        : state === "failed"
                          ? "bg-red-200"
                          : "bg-gray-200",
                  )}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      <div className="flex justify-between">
        {FSM_TIMELINE_STEPS.map((step) => {
          const state = stepsByStatus[step.status];
          return (
            <div key={step.status} className="w-9 flex justify-center">
              <span
                className={cn(
                  "text-xs font-medium leading-tight whitespace-nowrap",
                  state === "current" && "text-ki-blue",
                  state === "done" && "text-ki-dark",
                  state === "failed" && "text-red-600",
                  state === "pending" && "text-gray-400",
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-gray-500 text-center pt-1">
        {STATUS_DESCRIPTIONS[status]}
        {statusReason && <span className="block text-xs text-red-500 mt-1">{statusReason}</span>}
      </p>
    </div>
  );
}

function StepDot({ state }: { state: TStepState }) {
  if (state === "done") {
    return (
      <div className="w-9 h-9 rounded-full bg-ki-blue text-white flex items-center justify-center flex-shrink-0">
        <CheckCircleIcon size={18} />
      </div>
    );
  }
  if (state === "current") {
    return (
      <div className="w-9 h-9 rounded-full bg-ki-blue-light text-ki-blue flex items-center justify-center ring-4 ring-ki-blue/15 flex-shrink-0">
        <Spinner size="sm" tone="current" />
      </div>
    );
  }
  if (state === "failed") {
    return (
      <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
        <AlertTriangleIcon size={18} />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-gray-100 border-2 border-gray-200 flex-shrink-0" />
  );
}

function FinalState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-6">
      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-ki-dark">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  );
}
