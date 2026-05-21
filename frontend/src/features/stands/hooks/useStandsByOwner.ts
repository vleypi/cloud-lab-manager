"use client";

import { useQuery } from "@tanstack/react-query";

import { STANDS_QK } from "@/shared/api/queryKeys";
import { POLLING_INTERVAL_MS } from "@/shared/config/api.constant";
import { standsService } from "@/features/stands/services/stands.service";

export function useStandsByOwner(ownerExternalId: string | null | undefined) {
  return useQuery({
    queryKey: STANDS_QK.byOwner(ownerExternalId ?? ""),
    queryFn: () => standsService.listForOwner(ownerExternalId as string),
    enabled: Boolean(ownerExternalId),
    refetchInterval: POLLING_INTERVAL_MS.TERMINAL,
    staleTime: 0,
  });
}
