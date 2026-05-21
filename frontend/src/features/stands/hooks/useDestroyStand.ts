"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { POOL_QK, STANDS_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { standsService } from "@/features/stands/services/stands.service";

export function useDestroyStand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (standId: string) => standsService.destroy(standId),
    onSuccess: (data) => {
      queryClient.setQueryData(STANDS_QK.one(data.stand.id), data.stand);
      queryClient.invalidateQueries({ queryKey: STANDS_QK.all });
      queryClient.invalidateQueries({ queryKey: POOL_QK.all });

      queryClient.removeQueries({ queryKey: ["stands", data.stand.id, "credentials"] });
      toast.success("Стенд очищается", "Скоро вернёмся в состояние свободного проекта");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось удалить стенд", error.message);
    },
  });
}
