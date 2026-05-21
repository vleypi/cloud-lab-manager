import { forwardRef, TextareaHTMLAttributes } from "react";

import { cn } from "@/shared/utils/cn";

interface ITextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, ITextareaProps>(function Textarea(
  { label, hint, error, className, rows = 4, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-ki-dark mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={cn(
          "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ki-dark placeholder:text-gray-400",
          "transition focus:outline-none focus:ring-2 focus:ring-ki-blue/30 focus:border-ki-blue",
          "disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed resize-y",
          error ? "border-red-300 focus:ring-red-100 focus:border-red-400" : "border-gray-200",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
});
