"use client";

import { useQuery } from "@tanstack/react-query";

import { INSPECTOR_QK } from "@/shared/api/queryKeys";
import { inspectorService } from "@/features/inspector/services/inspector.service";

export function useStandRuns(standId: string | null | undefined) {
  return useQuery({
    queryKey: INSPECTOR_QK.runsForStand(standId ?? ""),
    queryFn: () => inspectorService.listForStand(standId as string),
    enabled: Boolean(standId),
    refetchInterval: 5_000,
    staleTime: 0,
  });
}
