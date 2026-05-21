import { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

export type TBadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warn"
  | "danger"
  | "violet"
  | "cyan";

interface IBadgeProps {
  children: ReactNode;
  tone?: TBadgeTone;
  pulse?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const TONE_CLASS: Record<TBadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-600",
  info: "bg-ki-blue-light text-ki-blue-strong",
  success: "bg-ki-green-soft text-emerald-700",
  warn: "bg-ki-amber-soft text-amber-700",
  danger: "bg-ki-red-soft text-red-600",
  violet: "bg-ki-violet-soft text-violet-700",
  cyan: "bg-ki-cyan-soft text-cyan-700",
};

const SIZE_CLASS: Record<NonNullable<IBadgeProps["size"]>, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

export function Badge({
  children,
  tone = "neutral",
  pulse = false,
  size = "sm",
  className,
}: IBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium",
        TONE_CLASS[tone],
        SIZE_CLASS[size],
        className,
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
