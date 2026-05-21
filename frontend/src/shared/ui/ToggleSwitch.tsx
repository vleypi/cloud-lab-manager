"use client";

import { cn } from "@/shared/utils/cn";

interface IToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
  description,
  className,
}: IToggleSwitchProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full transition flex-shrink-0",
          checked ? "bg-ki-blue" : "bg-gray-200",
          "ki-focus-ring",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
      {(label || description) && (
        <div className="min-w-0">
          {label && <p className="text-sm text-ki-dark font-medium">{label}</p>}
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
      )}
    </label>
  );
}
