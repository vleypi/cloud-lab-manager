"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

import { ROUTES } from "@/shared/config/routes.constant";
import { Spinner } from "@/shared/ui/Spinner";
import { canAccessAdminPanel } from "@/shared/identity/role.constant";
import { useMe } from "@/shared/identity/useMe";

interface IAuthGuardProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function AuthGuard({ children, requireAdmin = false }: IAuthGuardProps) {
  const router = useRouter();
  const { user, isReady } = useMe();

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace(`${ROUTES.LOGIN}?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (requireAdmin && !canAccessAdminPanel(user)) {

      router.replace(ROUTES.LOGIN);
    }
  }, [isReady, user, requireAdmin, router]);

  if (!isReady || !user || (requireAdmin && !canAccessAdminPanel(user))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
