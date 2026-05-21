import { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

interface IKeyValueProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
  copyable?: boolean;
  className?: string;
}

export function KeyValue({ label, value, mono = false, copyable = false, className }: IKeyValueProps) {
  return (
    <div className={cn("flex flex-col gap-1 min-w-0", className)}>
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "text-sm text-ki-dark min-w-0 truncate",
            mono && "font-mono text-[13px]",
          )}
          title={typeof value === "string" ? value : undefined}
        >
          {value ?? <span className="text-gray-400">—</span>}
        </span>
        {copyable && typeof value === "string" && <CopyButton text={value} />}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {

        }
      }}
      className="text-gray-400 hover:text-ki-blue transition flex-shrink-0"
      aria-label="Скопировать"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
        />
      </svg>
    </button>
  );
}
