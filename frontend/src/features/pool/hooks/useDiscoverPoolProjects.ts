"use client";

import { useQuery } from "@tanstack/react-query";

import { POOL_QK } from "@/shared/api/queryKeys";
import { poolService } from "@/features/pool/services/pool.service";

export function useDiscoverPoolProjects(domainId?: string, enabled = true) {
  return useQuery({
    queryKey: POOL_QK.discover(domainId),
    queryFn: () => poolService.discoverProjects(domainId),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
