"use client";

import { ReactNode, useState } from "react";

import { cn } from "@/shared/utils/cn";

export interface ITabbedModalTab<TTabId extends string = string> {
  id: TTabId;
  label: string;
  icon?: ReactNode;
  description?: string;
  danger?: boolean;
  content: ReactNode;
}

interface ITabbedSettingsModalProps<TTabId extends string = string> {
  sidebarHeader?: ReactNode;
  tabs: ITabbedModalTab<TTabId>[];
  defaultTab?: TTabId;
  onBack?: () => void;
  backLabel?: string;
}

export function TabbedSettingsModal<TTabId extends string = string>({
  sidebarHeader,
  tabs,
  defaultTab,
  onBack,
  backLabel = "Назад",
}: ITabbedSettingsModalProps<TTabId>) {
  const [activeTab, setActiveTab] = useState<TTabId>(defaultTab ?? tabs[0].id);

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="w-52 flex-shrink-0 bg-gray-50 border-r border-gray-100 rounded-bl-2xl py-4 flex flex-col overflow-y-auto">
        {sidebarHeader && <div className="px-4 mb-4">{sidebarHeader}</div>}

        {sidebarHeader && <div className="h-px bg-gray-100 mx-4 mb-3" />}

        <nav className="flex flex-col gap-0.5 px-2">
          {tabs.map(({ id, label, icon, danger }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={tabClasses(isActive, Boolean(danger))}
              >
                {icon && (
                  <span className="w-4 text-center text-xs opacity-80">{icon}</span>
                )}
                {label}
              </button>
            );
          })}
        </nav>

        {onBack && (
          <>
            <div className="h-px bg-gray-100 mx-4 my-3" />
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2.5 mx-2 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-200/50 rounded-lg transition text-left"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              {backLabel}
            </button>
          </>
        )}
      </aside>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <div className="flex-shrink-0 px-8 py-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-ki-dark">{active.label}</h3>
          {active.description && (
            <p className="text-xs text-gray-400 mt-0.5">{active.description}</p>
          )}
        </div>

        <div className="flex-1 px-8 py-6 overflow-y-auto ki-scrollbar-thin">
          {active.content}
        </div>
      </div>
    </div>
  );
}

function tabClasses(isActive: boolean, isDanger: boolean): string {
  const base =
    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left";
  if (isActive && isDanger) return cn(base, "bg-red-100/60 text-red-600 font-semibold");
  if (isActive) return cn(base, "bg-gray-200/70 text-ki-dark font-semibold");
  if (isDanger)
    return cn(base, "font-medium text-red-400 hover:bg-red-100/40 hover:text-red-500");
  return cn(base, "font-medium text-gray-500 hover:bg-gray-200/50 hover:text-gray-700");
}
