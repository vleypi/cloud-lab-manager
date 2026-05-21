"use client";

import { MouseEvent } from "react";

import { cn } from "@/shared/utils/cn";
import { IModalProps, TModalSize } from "@/shared/modal/modal.types";

const SIZE_CLASS: Record<TModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-6xl",
};

export function Modal({
  title,
  visible,
  onClose,
  children,
  size = "md",
  noPadding = false,
  scrollInner = false,
  hideHeader = false,
}: IModalProps) {
  const stopPropagation = (event: MouseEvent<HTMLDivElement>) => event.stopPropagation();

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] bg-black/40 transition-opacity duration-200",
        scrollInner ? "flex items-center justify-center p-4" : "overflow-y-auto",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={
          scrollInner
            ? "w-full flex items-center justify-center"
            : "flex min-h-full items-center justify-center p-4"
        }
      >
        <div
          className={cn(
            "relative bg-white rounded-2xl shadow-2xl w-full",
            SIZE_CLASS[size],
            "transition-all duration-200",
            scrollInner && "flex flex-col max-h-[85vh]",
            visible
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-2",
          )}
          onClick={stopPropagation}
        >
          {!hideHeader && (
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-ki-dark">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-ki-dark hover:bg-gray-100 transition-colors"
                aria-label="Закрыть"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          <div
            className={cn(
              scrollInner && "flex-1 min-h-0 flex flex-col",
              !noPadding && "p-6",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
