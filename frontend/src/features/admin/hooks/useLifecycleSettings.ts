"use client";

import { useQuery } from "@tanstack/react-query";

import { ADMIN_QK } from "@/shared/api/queryKeys";
import { adminService } from "@/features/admin/services/admin.service";

export function useLifecycleSettings() {
  return useQuery({
    queryKey: ADMIN_QK.lifecycleSettings(),
    queryFn: () => adminService.getLifecycleSettings(),
    staleTime: 30_000,
  });
}
