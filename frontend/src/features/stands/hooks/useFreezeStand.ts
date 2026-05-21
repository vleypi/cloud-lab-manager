"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { STANDS_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { standsService } from "@/features/stands/services/stands.service";
import { IFreezePayload } from "@/features/stands/interfaces/stands.interfaces";

interface IFreezeArgs {
  standId: string;
  payload: IFreezePayload;
}

export function useFreezeStand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ standId, payload }: IFreezeArgs) => standsService.freeze(standId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(STANDS_QK.one(data.id), data);
      queryClient.invalidateQueries({ queryKey: STANDS_QK.all });
      toast.success("Стенд заморожен", "Auto-destroy отключён на freeze TTL");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось заморозить", error.message);
    },
  });
}
