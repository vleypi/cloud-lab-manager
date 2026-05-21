"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { MAPPINGS_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { mappingsService } from "@/features/mappings/services/mappings.service";

export function useDeleteMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mappingId: string) => mappingsService.delete(mappingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MAPPINGS_QK.all });
      toast.success("Маппинг удалён");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось удалить маппинг", error.message);
    },
  });
}
