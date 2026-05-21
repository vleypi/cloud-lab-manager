"use client";

import { Badge } from "@/shared/ui/Badge";
import { Card, CardHeader } from "@/shared/ui/Card";
import { KeyValue } from "@/shared/ui/KeyValue";
import { formatDateTime, formatRelative, formatTimeUntil } from "@/shared/utils/format.util";

import { IStand } from "@/features/stands/interfaces/stands.interfaces";

interface IStandDetailsProps {
  stand: IStand;
}

export function StandDetails({ stand }: IStandDetailsProps) {
  return (
    <Card>
      <CardHeader title="Параметры стенда" description="Идентификаторы ресурсов и временные метки" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <KeyValue
          label="Курс / Лабораторная"
          value={
            stand.course_code || stand.lab_code ? (
              <span className="inline-flex gap-2">
                {stand.course_code && <Badge tone="info">{stand.course_code}</Badge>}
                {stand.lab_code && <Badge tone="violet">{stand.lab_code}</Badge>}
              </span>
            ) : (
              "—"
            )
          }
        />
        <KeyValue
          label="Владелец"
          value={stand.owner_display_name ?? stand.owner_external_id}
          mono={!stand.owner_display_name}
        />
        <KeyValue
          label="ID стенда"
          value={stand.id}
          mono
          copyable
        />
        <KeyValue
          label="ID сервера КИ"
          value={stand.ki_server_id ?? "—"}
          mono
          copyable={Boolean(stand.ki_server_id)}
        />
        <KeyValue
          label="Floating IP"
          value={
            stand.ki_floating_ip
              ? stand.ki_floating_ip
              : stand.status === "ready"
                ? "выделяется..."
                : "—"
          }
          mono={Boolean(stand.ki_floating_ip)}
          copyable={Boolean(stand.ki_floating_ip)}
        />
        <KeyValue
          label="Fingerprint ключа"
          value={stand.ssh_public_key_fingerprint ?? "—"}
          mono
        />
        <KeyValue
          label="Проект в пуле"
          value={stand.pool_project.ki_project_name}
        />
        <KeyValue
          label="Домен КИ"
          value={stand.pool_project.ki_domain_name}
        />
        <KeyValue
          label="Создан"
          value={formatDateTime(stand.created_at)}
        />
        <KeyValue
          label="Развёрнут"
          value={stand.deployed_at ? formatDateTime(stand.deployed_at) : "—"}
        />
        <KeyValue
          label="Auto-destroy"
          value={
            stand.expires_at ? (
              <span>
                {formatDateTime(stand.expires_at)}
                <span className="text-gray-400 ml-2">({formatTimeUntil(stand.expires_at)})</span>
              </span>
            ) : (
              "—"
            )
          }
        />
        <KeyValue
          label="Обновлён"
          value={formatRelative(stand.updated_at)}
        />
      </div>

      {stand.attempt > 1 && (
        <div className="mt-4 p-3 bg-ki-amber-soft border border-amber-200/60 rounded-xl text-xs text-amber-800">
          Попытка развертывания: <strong>{stand.attempt}</strong>. Backend автоматически повторяет
          операцию до 3 раз при сбоях.
        </div>
      )}

      {stand.frozen_reason && (
        <div className="mt-4 p-3 bg-ki-cyan-soft border border-ki-cyan/20 rounded-xl text-xs text-cyan-900">
          <strong>Причина заморозки: </strong>
          {stand.frozen_reason}
        </div>
      )}
    </Card>
  );
}
