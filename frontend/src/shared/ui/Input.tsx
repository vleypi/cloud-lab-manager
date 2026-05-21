import { forwardRef, InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

interface IInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, IInputProps>(function Input(
  {
    label,
    hint,
    error,
    iconLeft,
    iconRight,
    fullWidth = true,
    className,
    id,
    ...rest
  },
  ref,
) {
  const inputId = id ?? rest.name;

  return (
    <div className={cn(fullWidth ? "w-full" : "w-auto")}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-ki-dark mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        {iconLeft && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full h-10 rounded-xl border bg-white text-sm text-ki-dark placeholder:text-gray-400",
            "transition focus:outline-none focus:ring-2 focus:ring-ki-blue/30 focus:border-ki-blue",
            "disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed",
            iconLeft ? "pl-10" : "pl-3.5",
            iconRight ? "pr-10" : "pr-3.5",
            error ? "border-red-300 focus:ring-red-100 focus:border-red-400" : "border-gray-200",
            className,
          )}
          {...rest}
        />
        {iconRight && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {iconRight}
          </span>
        )}
      </div>

      {error ? (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
});
