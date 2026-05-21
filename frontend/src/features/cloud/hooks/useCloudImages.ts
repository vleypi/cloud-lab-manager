"use client";

import { useQuery } from "@tanstack/react-query";

import { CLOUD_QK } from "@/shared/api/queryKeys";
import { cloudService } from "@/features/cloud/services/cloud.service";

export function useCloudImages() {
  return useQuery({
    queryKey: CLOUD_QK.images(),
    queryFn: () => cloudService.listImages(),
    staleTime: 5 * 60_000,
  });
}
