import { cn } from "@/shared/utils/cn";

interface IProgressBarProps {
  value: number;
  threshold?: number;
  warnAt?: number;
  className?: string;
}

export function ProgressBar({
  value,
  threshold = 90,
  warnAt = 70,
  className,
}: IProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  const toneClass =
    clamped >= threshold
      ? "bg-red-500"
      : clamped >= warnAt
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div className={cn("relative w-full h-2 bg-gray-100 rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", toneClass)}
        style={{ width: `${clamped}%` }}
      />
      {threshold < 100 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-red-300/80"
          style={{ left: `${threshold}%` }}
          aria-hidden
        />
      )}
    </div>
  );
}
