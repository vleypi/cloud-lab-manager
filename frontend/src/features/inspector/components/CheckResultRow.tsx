"use client";

import { useState } from "react";

import { Badge } from "@/shared/ui/Badge";
import { ChevronDownIcon, ChevronRightIcon } from "@/shared/icons/index-icons";
import { cn } from "@/shared/utils/cn";
import { CodeBlock } from "@/shared/ui/CodeBlock";

import {
  describeKind,
  describeSeverity,
  RESULT_STATUS_LABELS,
  RESULT_STATUS_TONE,
  SEVERITY_TONE,
} from "@/features/inspector/constants/inspector.constants";
import { ICheckResult } from "@/features/inspector/interfaces/inspector.interfaces";

interface ICheckResultRowProps {
  result: ICheckResult;
}

export function CheckResultRow({ result }: ICheckResultRowProps) {
  const [isOpen, setIsOpen] = useState(result.status === "failed" || result.status === "error");
  const hasDetails = Boolean(result.stdout || result.stderr || Object.keys(result.spec).length > 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => hasDetails && setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition",
          hasDetails ? "hover:bg-gray-50 cursor-pointer" : "cursor-default",
        )}
      >
        {hasDetails ? (
          isOpen ? (
            <ChevronDownIcon size={16} className="text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRightIcon size={16} className="text-gray-400 flex-shrink-0" />
          )
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0">
          {String(result.position).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ki-dark truncate">{result.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {describeKind(result.kind)}
            {result.duration_ms !== null && (
              <span className="ml-2">· {result.duration_ms} ms</span>
            )}
            {result.exit_code !== null && (
              <span className="ml-2">· exit {result.exit_code}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {result.severity && result.severity !== "critical" && (
            <Badge tone={SEVERITY_TONE[result.severity] ?? "neutral"} size="sm">
              {describeSeverity(result.severity)}
            </Badge>
          )}
          <Badge tone={RESULT_STATUS_TONE[result.status]}>{RESULT_STATUS_LABELS[result.status]}</Badge>
        </div>
      </button>

      {hasDetails && isOpen && (
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/40">
          {result.message && (
            <div className="text-sm text-ki-dark">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Сообщение</span>
              <p className="mt-1">{result.message}</p>
            </div>
          )}

          {result.stdout && (
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">stdout</span>
              <CodeBlock code={result.stdout} maxHeight="10rem" copyable={false} />
            </div>
          )}

          {result.stderr && (
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">stderr</span>
              <CodeBlock code={result.stderr} maxHeight="10rem" copyable={false} />
            </div>
          )}

          {Object.keys(result.spec).length > 0 && (
            <details className="text-xs">
              <summary className="text-gray-500 cursor-pointer hover:text-ki-dark">
                Параметры проверки
              </summary>
              <pre className="mt-2 p-2 bg-white rounded-lg border border-gray-100 font-mono text-[11px] overflow-auto">
                {JSON.stringify(result.spec, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
