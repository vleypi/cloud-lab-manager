"use client";

import { useQuery } from "@tanstack/react-query";

import { CAPACITY_QK } from "@/shared/api/queryKeys";
import { POLLING_INTERVAL_MS } from "@/shared/config/api.constant";
import { capacityService } from "@/features/capacity/services/capacity.service";

interface IUseCapacityOptions {
  refetchInterval?: number;
  enabled?: boolean;
}

export function useCapacity(options: IUseCapacityOptions = {}) {
  const { refetchInterval = POLLING_INTERVAL_MS.CAPACITY, enabled = true } = options;
  return useQuery({
    queryKey: CAPACITY_QK.current(),
    queryFn: () => capacityService.getCurrent(),
    refetchInterval,
    enabled,
    staleTime: 0,
  });
}
