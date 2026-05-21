"use client";

import { useQuery } from "@tanstack/react-query";

import { STANDS_QK } from "@/shared/api/queryKeys";
import { POLLING_INTERVAL_MS } from "@/shared/config/api.constant";
import { standsService } from "@/features/stands/services/stands.service";
import { TRANSITION_STATUSES } from "@/features/stands/constants/stands.constants";

export function useStand(standId: string | null | undefined) {
  return useQuery({
    queryKey: STANDS_QK.one(standId ?? ""),
    queryFn: () => standsService.get(standId as string),
    enabled: Boolean(standId),
    refetchInterval: (query) => {
      const stand = query.state.data;
      if (!stand) return POLLING_INTERVAL_MS.TRANSITION;
      return TRANSITION_STATUSES.has(stand.status)
        ? POLLING_INTERVAL_MS.TRANSITION
        : POLLING_INTERVAL_MS.TERMINAL;
    },
    staleTime: 0,
  });
}
