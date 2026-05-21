"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { POOL_QK, STANDS_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { standsService } from "@/features/stands/services/stands.service";
import { IStandLaunchPayload } from "@/features/stands/interfaces/stands.interfaces";

export function useLaunchStand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IStandLaunchPayload) => standsService.launch(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: STANDS_QK.all });
      queryClient.invalidateQueries({ queryKey: POOL_QK.all });
      queryClient.setQueryData(STANDS_QK.one(data.stand.id), data.stand);
      toast.success("Стенд запущен", "Идёт развёртывание ВМ...");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось запустить стенд", error.message);
    },
  });
}
