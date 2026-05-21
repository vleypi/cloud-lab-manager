"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { POOL_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { poolService } from "@/features/pool/services/pool.service";

export function useDeletePoolProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => poolService.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POOL_QK.all });
      toast.success("Проект удалён из пула");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось удалить проект", error.message);
    },
  });
}
