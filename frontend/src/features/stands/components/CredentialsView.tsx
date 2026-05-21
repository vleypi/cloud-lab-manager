"use client";

import { useEffect, useState } from "react";

import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DownloadIcon,
  KeyIcon,
} from "@/shared/icons/index-icons";
import { Button } from "@/shared/ui/Button";
import { CodeBlock } from "@/shared/ui/CodeBlock";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Spinner } from "@/shared/ui/Spinner";

import { IStand } from "@/features/stands/interfaces/stands.interfaces";
import {
  useNotifyCredentialsError,
  useStandCredentials,
} from "@/features/stands/hooks/useStandCredentials";

interface ICredentialsViewProps {
  stand: IStand;

  enabled?: boolean;
}

export function CredentialsView({ stand, enabled = true }: ICredentialsViewProps) {
  const { data, isLoading, error } = useStandCredentials(stand.id, enabled);
  const notifyError = useNotifyCredentialsError();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (error) notifyError(error);
  }, [error, notifyError]);

  const handleDownload = () => {
    if (!data) return;
    const blob = new Blob([data.ssh_private_key], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.keypair_name}.pem`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.ssh_private_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {

    }
  };

  if (!enabled) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    const isGone = error.statusCode === 404;
    return (
      <ErrorBox
        error={
          isGone
            ? "Ключ ещё не выдан стенд готовится. Подождите 10-20 секунд и обновите страницу."
            : error
        }
        title={isGone ? "Ключ пока недоступен" : "Не удалось получить ключ"}
      />
    );
  }

  if (!data) return null;

  const host = pickHost(stand);
  const keyFile = `${data.keypair_name}.pem`;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-ki-amber-soft border border-amber-200/60 rounded-2xl">
        <div className="w-9 h-9 rounded-xl bg-white/70 text-amber-600 flex items-center justify-center flex-shrink-0">
          <AlertTriangleIcon size={18} />
        </div>
        <div className="text-sm text-amber-900 min-w-0">
          <p className="font-semibold">Сохраните ключ</p>
          <p className="mt-1 text-amber-800/90">
            Скачайте файл или скопируйте содержимое. Ключ доступен пока стенд активен, после
            удаления стенда он будет уничтожен.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="p-4 bg-ki-blue-soft border border-ki-blue/10 rounded-xl">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
            Keypair
          </div>
          <div className="font-mono text-[13px] text-ki-dark mt-1.5 truncate">
            {data.keypair_name}
          </div>
        </div>
        <div className="p-4 bg-ki-blue-soft border border-ki-blue/10 rounded-xl">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
            Адрес стенда
          </div>
          <div className="font-mono text-[13px] text-ki-dark mt-1.5 truncate">
            {host ?? "—"}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <span className="text-xs font-medium text-ki-dark uppercase tracking-wide flex items-center gap-2">
            <KeyIcon size={14} />
            Приватный ключ
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              iconLeft={
                copied ? <CheckCircleIcon size={14} /> : <KeyIcon size={14} />
              }
              onClick={handleCopy}
            >
              {copied ? "Скопировано" : "Копировать"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              iconLeft={<DownloadIcon size={14} />}
              onClick={handleDownload}
            >
              {keyFile}
            </Button>
          </div>
        </div>
        <CodeBlock code={data.ssh_private_key} language="PEM" maxHeight="14rem" />
      </div>

      <div>
        <div className="text-xs font-medium text-ki-dark uppercase tracking-wide mb-2">
          Как подключиться
        </div>
        <ol className="text-sm text-ki-dark space-y-2 list-decimal pl-5">
          <li>
            Скачайте файл <span className="font-mono">{keyFile}</span> кнопкой выше или сохраните
            содержимое в файл с тем же именем.
          </li>
          <li>
            Дайте ключу права <span className="font-mono">600</span>:
            <div className="mt-1">
              <CodeBlock code={`chmod 600 ${keyFile}`} maxHeight="3rem" />
            </div>
          </li>
          <li>
            Подключитесь по SSH. Замените <span className="font-mono">USER</span> на имя пользователя
            образа ОС (обычно <span className="font-mono">ubuntu</span>,{" "}
            <span className="font-mono">altlinux</span>, <span className="font-mono">centos</span> или{" "}
            <span className="font-mono">cloud-user</span>):
            <div className="mt-1">
              <CodeBlock
                code={`ssh -i ${keyFile} USER@${host ?? "<IP_стенда>"}`}
                maxHeight="3rem"
              />
            </div>
          </li>
        </ol>
        {!host && (
          <p className="text-xs text-amber-600 mt-2">
            IP-адрес ещё не привязан к стенду. Подождите 10-20 секунд и обновите страницу.
          </p>
        )}
      </div>

      <details className="border border-gray-100 rounded-xl">
        <summary className="px-4 py-2 text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-50 rounded-xl">
          Дополнительно — публичный ключ и fingerprint
        </summary>
        <div className="p-3 space-y-3">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fingerprint</div>
            <div className="font-mono text-[13px] text-ki-dark">{data.fingerprint}</div>
          </div>
          <CodeBlock code={data.ssh_public_key} maxHeight="6rem" />
        </div>
      </details>
    </div>
  );
}

function pickHost(stand: IStand): string | null {
  if (stand.ki_floating_ip) return stand.ki_floating_ip;
  const extra = (stand as unknown as { extra?: Record<string, unknown> }).extra ?? {};
  const fixed = (extra.fixed_ips as string[] | undefined) ?? [];
  return fixed[0] ?? null;
}
