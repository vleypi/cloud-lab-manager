import { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

export type TStatCardColor = "blue" | "green" | "red" | "amber" | "violet" | "cyan" | "gray";

interface IStatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  color?: TStatCardColor;
  className?: string;
}

const COLOR_MAP: Record<
  TStatCardColor,
  { bg: string; icon: string; text: string }
> = {
  blue: { bg: "bg-ki-blue-light", icon: "text-ki-blue", text: "text-ki-dark" },
  green: { bg: "bg-ki-green-soft", icon: "text-emerald-600", text: "text-ki-dark" },
  red: { bg: "bg-ki-red-soft", icon: "text-red-500", text: "text-ki-dark" },
  amber: { bg: "bg-ki-amber-soft", icon: "text-amber-600", text: "text-ki-dark" },
  violet: { bg: "bg-ki-violet-soft", icon: "text-violet-600", text: "text-ki-dark" },
  cyan: { bg: "bg-ki-cyan-soft", icon: "text-cyan-600", text: "text-ki-dark" },
  gray: { bg: "bg-gray-100", icon: "text-gray-600", text: "text-ki-dark" },
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  color = "blue",
  className,
}: IStatCardProps) {
  const styles = COLOR_MAP[color];

  return (
    <div
      className={cn(
        "bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4",
        className,
      )}
    >
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", styles.bg)}>
        <span className={cn("w-5 h-5 flex items-center justify-center", styles.icon)}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className={cn("text-2xl font-bold leading-tight", styles.text)}>{value}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{label}</p>
        {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
      </div>
    </div>
  );
}
