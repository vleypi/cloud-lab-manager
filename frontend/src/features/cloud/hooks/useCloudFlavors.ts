"use client";

import { useQuery } from "@tanstack/react-query";

import { CLOUD_QK } from "@/shared/api/queryKeys";
import { cloudService } from "@/features/cloud/services/cloud.service";

export function useCloudFlavors() {
  return useQuery({
    queryKey: CLOUD_QK.flavors(),
    queryFn: () => cloudService.listFlavors(),
    staleTime: 5 * 60_000,
  });
}
