"use client";

import { useQuery } from "@tanstack/react-query";

import { STANDS_QK } from "@/shared/api/queryKeys";
import { POLLING_INTERVAL_MS } from "@/shared/config/api.constant";
import { TStandStatus } from "@/features/stands/interfaces/stands.interfaces";
import { standsService } from "@/features/stands/services/stands.service";

interface IUseAllStandsOptions {
  status?: TStandStatus;
  limit?: number;
}

export function useAllStands(options: IUseAllStandsOptions = {}) {
  const { status, limit } = options;
  return useQuery({
    queryKey: [...STANDS_QK.all, "admin", status ?? "any", limit ?? 200] as const,
    queryFn: () => standsService.listAll({ status, limit }),
    refetchInterval: POLLING_INTERVAL_MS.TERMINAL,
    staleTime: 0,
  });
}
