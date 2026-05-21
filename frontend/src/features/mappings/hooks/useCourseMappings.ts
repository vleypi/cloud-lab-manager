"use client";

import { useQuery } from "@tanstack/react-query";

import { MAPPINGS_QK } from "@/shared/api/queryKeys";
import { mappingsService } from "@/features/mappings/services/mappings.service";

export function useCourseMappings(ltiContextId?: string) {
  return useQuery({
    queryKey: MAPPINGS_QK.list(ltiContextId),
    queryFn: () => mappingsService.list(ltiContextId),
    staleTime: 30_000,
  });
}
