"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { MAPPINGS_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { mappingsService } from "@/features/mappings/services/mappings.service";
import { ICourseMappingPayload } from "@/features/mappings/interfaces/mappings.interfaces";

export function useUpsertMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ICourseMappingPayload) => mappingsService.upsert(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MAPPINGS_QK.all });
      toast.success("Маппинг сохранён");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось сохранить маппинг", error.message);
    },
  });
}
