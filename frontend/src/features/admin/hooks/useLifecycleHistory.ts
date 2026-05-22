"use client";

import { useQuery } from "@tanstack/react-query";

import { ADMIN_QK } from "@/shared/api/queryKeys";
import { adminService } from "@/features/admin/services/admin.service";

interface IUseLifecycleHistoryArgs {
  key?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export function useLifecycleHistory({
  key,
  limit = 50,
  offset = 0,
  enabled = true,
}: IUseLifecycleHistoryArgs = {}) {
  return useQuery({
    queryKey: ADMIN_QK.lifecycleHistory(key, limit, offset),
    queryFn: () => adminService.getLifecycleHistory({ key, limit, offset }),
    staleTime: 15_000,
    enabled,
  });
}
