"use client";

import { useQuery } from "@tanstack/react-query";

import { POOL_QK } from "@/shared/api/queryKeys";
import { POLLING_INTERVAL_MS } from "@/shared/config/api.constant";
import { poolService } from "@/features/pool/services/pool.service";

export function usePoolInventory() {
  return useQuery({
    queryKey: POOL_QK.inventory(),
    queryFn: () => poolService.getInventory(),
    refetchInterval: POLLING_INTERVAL_MS.CAPACITY,
    staleTime: 0,
  });
}
