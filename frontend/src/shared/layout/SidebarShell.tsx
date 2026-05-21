"use client";

import type { ReactNode } from "react";

import { useSidebar } from "@/shared/layout/SidebarProvider";

interface ISidebarShellProps {
  children: ReactNode;
}

export function SidebarShell({ children }: ISidebarShellProps) {
  const { isOpen, isMobile, isReady, closeMobile } = useSidebar();

  const sidebarClass = isMobile
    ? `sidebar-mobile ${isOpen ? "open" : ""} ${isReady ? "ready" : ""}`
    : `sidebar-desktop ${isOpen ? "" : "collapsed"} ${isReady ? "ready" : ""}`;

  return (
    <>
      {isMobile && isOpen && (
        <div className="sidebar-backdrop" onClick={closeMobile} />
      )}
      <aside className={sidebarClass} aria-label="Боковое меню">
        {isMobile && (
          <div className="sidebar-mobile-header">
            <button onClick={closeMobile} aria-label="Закрыть меню">
              <svg
                className="w-5 h-5 text-gray-600"
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
        <div className="h-full overflow-y-auto p-4 flex flex-col">{children}</div>
      </aside>
    </>
  );
}
