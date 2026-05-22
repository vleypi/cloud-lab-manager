"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MAPPINGS_QK } from "@/shared/api/queryKeys";
import { mappingsService } from "@/features/mappings/services/mappings.service";

export function usePendingLtiBindings() {
  return useQuery({
    queryKey: MAPPINGS_QK.pendingBindings(),
    queryFn: () => mappingsService.listPendingBindings(),
    staleTime: 5_000,
    refetchInterval: 15_000,
  });
}

export function useDismissPendingBinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bindingId: string) => mappingsService.dismissPendingBinding(bindingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MAPPINGS_QK.pendingBindings() });
    },
  });
}
