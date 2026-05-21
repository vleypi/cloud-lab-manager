"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ROUTES } from "@/shared/config/routes.constant";
import { canAccessAdminPanel } from "@/shared/identity/role.constant";
import { useMe } from "@/shared/identity/useMe";

export default function RootRedirect() {
  const router = useRouter();
  const { user, isReady } = useMe();

  useEffect(() => {
    if (!isReady) return;
    if (canAccessAdminPanel(user)) {
      router.replace(ROUTES.ADMIN.OVERVIEW);
    } else {
      router.replace(ROUTES.LOGIN);
    }
  }, [isReady, user, router]);

  return null;
}
