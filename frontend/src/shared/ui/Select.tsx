import { forwardRef, SelectHTMLAttributes } from "react";

import { cn } from "@/shared/utils/cn";

export interface ISelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ISelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  options: ReadonlyArray<ISelectOption>;
  placeholder?: string;
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, ISelectProps>(function Select(
  {
    label,
    hint,
    error,
    options,
    placeholder,
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
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "w-full h-10 rounded-xl border bg-white pl-3.5 pr-10 text-sm text-ki-dark appearance-none",
            "transition focus:outline-none focus:ring-2 focus:ring-ki-blue/30 focus:border-ki-blue",
            "disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed",
            error ? "border-red-300 focus:ring-red-100 focus:border-red-400" : "border-gray-200",
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
});
