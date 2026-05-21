import { cn } from "@/shared/utils/cn";

interface ISpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  tone?: "current" | "light";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<ISpinnerProps["size"]>, string> = {
  xs: "w-3 h-3 border-2",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-10 h-10 border-[3px]",
};

const TONE_CLASS: Record<NonNullable<ISpinnerProps["tone"]>, string> = {
  current: "border-current/30 border-t-current",
  light: "border-white/30 border-t-white",
};

export function Spinner({ size = "sm", tone = "current", className }: ISpinnerProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full animate-spin",
        SIZE_CLASS[size],
        TONE_CLASS[tone],
        className,
      )}
      role="status"
      aria-label="Загрузка"
    />
  );
}
