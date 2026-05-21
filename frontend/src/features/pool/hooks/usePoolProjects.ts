"use client";

import { useQuery } from "@tanstack/react-query";

import { POOL_QK } from "@/shared/api/queryKeys";
import { poolService } from "@/features/pool/services/pool.service";

export function usePoolProjects() {
  return useQuery({
    queryKey: POOL_QK.projects(),
    queryFn: () => poolService.listProjects(),
    staleTime: 15_000,
  });
}
