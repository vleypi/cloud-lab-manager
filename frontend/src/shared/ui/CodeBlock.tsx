"use client";

import { useState } from "react";

import { cn } from "@/shared/utils/cn";

interface ICodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  maxHeight?: string;
  copyable?: boolean;
}

export function CodeBlock({
  code,
  language,
  className,
  maxHeight = "16rem",
  copyable = true,
}: ICodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {

    }
  };

  return (
    <div className={cn("relative group", className)}>
      <pre
        className="overflow-auto ki-scrollbar-thin bg-ki-dark text-white text-[13px] leading-relaxed p-4 rounded-xl font-mono"
        style={{ maxHeight }}
      >
        <code>{code}</code>
      </pre>
      {language && (
        <span className="absolute top-2 left-3 text-[10px] uppercase tracking-wide text-white/40 font-medium">
          {language}
        </span>
      )}
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "absolute top-2 right-2 px-2.5 py-1 text-xs rounded-md transition",
            "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
          )}
          aria-label="Скопировать"
        >
          {copied ? "Скопировано ✓" : "Копировать"}
        </button>
      )}
    </div>
  );
}
