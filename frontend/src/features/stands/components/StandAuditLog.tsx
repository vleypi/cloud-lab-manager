"use client";

import { Card, CardHeader } from "@/shared/ui/Card";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ActivityIcon } from "@/shared/icons/index-icons";

import { IStand } from "@/features/stands/interfaces/stands.interfaces";

interface IStandAuditLogProps {
  stand: IStand;
}

export function StandAuditLog({ stand }: IStandAuditLogProps) {
  const events = collectEvents(stand);

  return (
    <Card>
      <CardHeader
        title="История действий"
        description="Кто и когда менял состояние стенда"
      />
      {events.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon size={18} />}
          title="Событий ещё нет"
          description="Заморозка продление и удаление будут отмечены здесь"
        />
      ) : (
        <ul className="space-y-2">
          {events.map((event, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50"
            >
              <span className="w-2 h-2 rounded-full bg-ki-blue mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ki-dark">{event.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{event.actor}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

interface IAuditEvent {
  label: string;
  actor: string;
}

function collectEvents(stand: IStand): IAuditEvent[] {
  const extra = (stand as unknown as { extra?: Record<string, unknown> }).extra ?? {};
  const out: IAuditEvent[] = [];

  if (typeof extra.frozen_by === "string") {
    out.push({
      label: "Стенд заморожен",
      actor: `Инициатор: ${extra.frozen_by}${stand.frozen_reason ? ` · причина: ${stand.frozen_reason}` : ""}`,
    });
  }
  if (typeof extra.unfrozen_by === "string") {
    out.push({
      label: "Стенд разморожен",
      actor: `Инициатор: ${extra.unfrozen_by}`,
    });
  }
  if (typeof extra.extended_by === "string") {
    out.push({
      label: "TTL продлён",
      actor: `Инициатор: ${extra.extended_by}`,
    });
  }
  return out;
}
