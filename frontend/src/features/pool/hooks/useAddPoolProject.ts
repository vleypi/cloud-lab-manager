"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { POOL_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { poolService } from "@/features/pool/services/pool.service";
import { IPoolProjectCreatePayload } from "@/features/pool/interfaces/pool.interfaces";

export function useAddPoolProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IPoolProjectCreatePayload) => poolService.addProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POOL_QK.all });
      toast.success("Проект добавлен в пул");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось добавить проект", error.message);
    },
  });
}
