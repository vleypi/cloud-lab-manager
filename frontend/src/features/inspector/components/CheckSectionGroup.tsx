"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/shared/ui/Badge";
import { ChevronDownIcon, ChevronRightIcon } from "@/shared/icons/index-icons";
import { cn } from "@/shared/utils/cn";

import { CheckResultRow } from "@/features/inspector/components/CheckResultRow";
import {
  describeSection,
  SECTION_TONE,
} from "@/features/inspector/constants/inspector.constants";
import {
  ICheckResult,
  TCheckSection,
} from "@/features/inspector/interfaces/inspector.interfaces";

interface ICheckSectionGroupProps {
  section: TCheckSection;
  results: ICheckResult[];
}

export function CheckSectionGroup({ section, results }: ICheckSectionGroupProps) {
  const counts = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let errored = 0;
    for (const r of results) {
      if (r.status === "passed") passed += 1;
      else if (r.status === "failed") failed += 1;
      else if (r.status === "error") errored += 1;
    }
    return { passed, failed, errored, total: results.length };
  }, [results]);

  const hasProblems = counts.failed > 0 || counts.errored > 0;
  const [isOpen, setIsOpen] = useState(hasProblems);

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50",
        )}
      >
        {isOpen ? (
          <ChevronDownIcon size={16} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRightIcon size={16} className="text-gray-400 flex-shrink-0" />
        )}

        <Badge tone={SECTION_TONE[section] ?? "neutral"} size="md">
          {describeSection(section)}
        </Badge>

        <div className="flex items-center gap-2 ml-auto text-xs">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full font-medium tabular-nums",
              hasProblems ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700",
            )}
          >
            {counts.passed}/{counts.total} OK
          </span>
          {counts.failed > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium tabular-nums">
              {counts.failed} fail
            </span>
          )}
          {counts.errored > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium tabular-nums">
              {counts.errored} err
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 p-3 space-y-2 bg-white">
          {results.map((result) => (
            <CheckResultRow key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
