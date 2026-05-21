"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { STANDS_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { standsService } from "@/features/stands/services/stands.service";
import { IUnfreezePayload } from "@/features/stands/interfaces/stands.interfaces";

interface IUnfreezeArgs {
  standId: string;
  payload: IUnfreezePayload;
}

export function useUnfreezeStand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ standId, payload }: IUnfreezeArgs) =>
      standsService.unfreeze(standId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(STANDS_QK.one(data.id), data);
      queryClient.invalidateQueries({ queryKey: STANDS_QK.all });
      toast.success("Стенд разморожен");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось разморозить", error.message);
    },
  });
}
