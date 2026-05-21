"use client";

import { useQuery } from "@tanstack/react-query";

import { CLOUD_QK } from "@/shared/api/queryKeys";
import { cloudService } from "@/features/cloud/services/cloud.service";

export function useCloudNetworks() {
  return useQuery({
    queryKey: CLOUD_QK.networks(),
    queryFn: () => cloudService.listNetworks(),
    staleTime: 5 * 60_000,
  });
}
