"use client";

import { Card } from "@/shared/ui/Card";
import { KeyValue } from "@/shared/ui/KeyValue";
import { ClockIcon, RefreshIcon } from "@/shared/icons/index-icons";
import { formatDateTime, formatRelative, formatTimeUntil } from "@/shared/utils/format.util";

import { IStand } from "@/features/stands/interfaces/stands.interfaces";

interface IStandStudentSummaryProps {
  stand: IStand;
}

// студенту нужно знать только сколько осталось до auto-destroy и когда обновлялось,
// плюс ID стенда «на всякий» для тикета в поддержку (под раскрывашкой)
export function StandStudentSummary({ stand }: IStandStudentSummaryProps) {
  return (
    <Card>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-ki-amber-soft text-amber-600 flex items-center justify-center flex-shrink-0">
            <ClockIcon size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-gray-500 uppercase tracking-wide">До авто-удаления</div>
            <div className="text-sm font-medium text-ki-dark">
              {stand.expires_at ? (
                <>
                  {formatTimeUntil(stand.expires_at)}
                  <span className="block text-xs text-gray-400 font-normal">
                    {formatDateTime(stand.expires_at)}
                  </span>
                </>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-ki-blue-light text-ki-blue flex items-center justify-center flex-shrink-0">
            <RefreshIcon size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Обновлён</div>
            <div className="text-sm font-medium text-ki-dark">{formatRelative(stand.updated_at)}</div>
          </div>
        </div>
      </div>

      {stand.frozen_reason && (
        <div className="mt-4 p-3 bg-ki-cyan-soft border border-ki-cyan/20 rounded-xl text-xs text-cyan-900">
          <strong>Стенд заморожен: </strong>
          {stand.frozen_reason}
        </div>
      )}

      <details className="mt-4 group">
        <summary className="cursor-pointer list-none text-xs text-gray-500 hover:text-ki-dark inline-flex items-center gap-1">
          <span className="group-open:hidden">Показать техническую информацию</span>
          <span className="hidden group-open:inline">Скрыть техническую информацию</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400">для тикета в поддержку</span>
        </summary>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-3 border-t border-gray-100">
          <KeyValue label="ID стенда" value={stand.id} mono copyable />
          <KeyValue
            label="ID сервера КИ"
            value={stand.ki_server_id ?? "—"}
            mono
            copyable={Boolean(stand.ki_server_id)}
          />
        </div>
      </details>
    </Card>
  );
}
