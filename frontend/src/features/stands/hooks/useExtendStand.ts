"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { STANDS_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { standsService } from "@/features/stands/services/stands.service";
import { IExtendPayload } from "@/features/stands/interfaces/stands.interfaces";

interface IExtendArgs {
  standId: string;
  payload: IExtendPayload;
}

export function useExtendStand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ standId, payload }: IExtendArgs) => standsService.extend(standId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(STANDS_QK.one(data.id), data);
      queryClient.invalidateQueries({ queryKey: STANDS_QK.all });
      toast.success("TTL обновлён");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось продлить", error.message);
    },
  });
}
