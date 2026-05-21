"use client";

import { cn } from "@/shared/utils/cn";

export interface ITabItem<TId extends string = string> {
  id: TId;
  label: string;
  badge?: string | number;
}

interface ITabsProps<TId extends string = string> {
  items: ReadonlyArray<ITabItem<TId>>;
  activeId: TId;
  onChange: (id: TId) => void;
  fullWidth?: boolean;
  className?: string;
}

export function Tabs<TId extends string = string>({
  items,
  activeId,
  onChange,
  fullWidth = false,
  className,
}: ITabsProps<TId>) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex border-b border-gray-100 gap-1",
        fullWidth && "w-full",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition",
              isActive ? "text-ki-blue" : "text-gray-500 hover:text-ki-dark",
              fullWidth && "flex-1",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              {item.badge !== undefined && (
                <span className="bg-gray-100 text-gray-600 text-[11px] px-1.5 py-0.5 rounded-md">
                  {item.badge}
                </span>
              )}
            </span>
            {isActive && (
              <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-ki-blue rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
