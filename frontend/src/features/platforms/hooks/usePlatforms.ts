"use client";

import { useQuery } from "@tanstack/react-query";

import { PLATFORMS_QK } from "@/shared/api/queryKeys";
import { platformsService } from "@/features/platforms/services/platforms.service";

export function usePlatforms() {
  return useQuery({
    queryKey: PLATFORMS_QK.list(),
    queryFn: () => platformsService.list(),
    staleTime: 60_000,
  });
}
