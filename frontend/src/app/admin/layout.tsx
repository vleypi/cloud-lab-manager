import { ReactNode } from "react";
import { cookies } from "next/headers";

import { COOKIE_KEYS } from "@/shared/config/cookies.constant";
import { AuthGuard } from "@/shared/layout/AuthGuard";
import { SidebarProvider } from "@/shared/layout/SidebarProvider";

import { AdminShell } from "@/app/admin/_components/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(COOKIE_KEYS.SIDEBAR_OPEN)?.value;
  const defaultOpen = sidebarCookie !== "false";

  return (
    <AuthGuard requireAdmin>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AdminShell>{children}</AdminShell>
      </SidebarProvider>
    </AuthGuard>
  );
}
