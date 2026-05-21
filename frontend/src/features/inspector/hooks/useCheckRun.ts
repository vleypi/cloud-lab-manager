"use client";

import { useQuery } from "@tanstack/react-query";

import { INSPECTOR_QK } from "@/shared/api/queryKeys";
import { POLLING_INTERVAL_MS } from "@/shared/config/api.constant";
import { inspectorService } from "@/features/inspector/services/inspector.service";
import { TERMINAL_RUN_STATUSES } from "@/features/inspector/constants/inspector.constants";

export function useCheckRun(runId: string | null | undefined) {
  return useQuery({
    queryKey: INSPECTOR_QK.run(runId ?? ""),
    queryFn: () => inspectorService.getRun(runId as string),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const run = query.state.data;
      if (!run) return POLLING_INTERVAL_MS.INSPECTOR_ACTIVE;
      return TERMINAL_RUN_STATUSES.has(run.status) ? false : POLLING_INTERVAL_MS.INSPECTOR_ACTIVE;
    },
    staleTime: 0,
  });
}
