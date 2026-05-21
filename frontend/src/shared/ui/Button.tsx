import { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/utils/cn";
import { Spinner } from "@/shared/ui/Spinner";

export type TButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type TButtonSize = "sm" | "md" | "lg";

interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TButtonVariant;
  size?: TButtonSize;
  isLoading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<TButtonVariant, string> = {
  primary:
    "bg-ki-dark text-white hover:bg-ki-dark-soft disabled:bg-gray-300 disabled:text-gray-500",
  secondary:
    "bg-ki-blue-light text-ki-dark hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 disabled:text-gray-400",
  danger:
    "bg-red-50 text-red-600 hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400",
  outline:
    "bg-white border border-gray-200 text-ki-dark hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400",
};

const SIZE_CLASS: Record<TButtonSize, string> = {
  sm: "h-8 px-3 text-xs font-medium gap-1.5",
  md: "h-10 px-4 text-sm font-medium gap-2",
  lg: "h-12 px-5 text-base font-semibold gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled,
  children,
  className,
  type = "button",
  ...rest
}: IButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center rounded-xl transition select-none",
        "active:scale-[0.98] disabled:active:scale-100 disabled:cursor-not-allowed",
        "ki-focus-ring",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {isLoading ? <Spinner size="sm" /> : iconLeft}
      {children}
      {!isLoading && iconRight}
    </button>
  );
}
