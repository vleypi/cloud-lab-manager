"use client";

import { ReactNode } from "react";

import { AppBar } from "@/shared/layout/AppBar";
import { SidebarNav } from "@/shared/layout/SidebarNav";
import { SidebarShell } from "@/shared/layout/SidebarShell";
import { INavItem } from "@/shared/layout/layout.interfaces";

interface IAppShellProps {
  navItems: ReadonlyArray<INavItem>;
  children: ReactNode;
  sidebarFooter?: ReactNode;
}

export function AppShell({ navItems, children, sidebarFooter }: IAppShellProps) {
  return (
    <div className="font-inter bg-white h-screen flex flex-col overflow-hidden">
      <AppBar />
      <div className="layout-container flex flex-1 overflow-hidden">
        <SidebarShell>
          <SidebarNav items={navItems} />
          {sidebarFooter && <div className="mt-auto pt-4">{sidebarFooter}</div>}
        </SidebarShell>
        <main className="flex-1 overflow-y-auto ki-scrollbar-thin">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
