"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { POOL_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { poolService } from "@/features/pool/services/pool.service";
import {
  IPoolBulkAddPayload,
  IPoolBulkAddResult,
} from "@/features/pool/interfaces/pool.interfaces";

export function useBulkAddPoolProjects() {
  const queryClient = useQueryClient();
  return useMutation<IPoolBulkAddResult, ApiError, IPoolBulkAddPayload>({
    mutationFn: (payload) => poolService.bulkAddProjects(payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: POOL_QK.all });
      const addedCount = result.added.length;
      const skippedCount = result.skipped.length;
      if (addedCount === 0) {
        toast.info("Все выбранные проекты уже были в пуле");
      } else if (skippedCount > 0) {
        toast.success(
          `Добавлено ${addedCount}`,
          `Пропущено дубликатов: ${skippedCount}`,
        );
      } else {
        toast.success(`Добавлено в пул: ${addedCount}`);
      }
    },
    onError: (error) => {
      toast.error("Не удалось добавить проекты", error.message);
    },
  });
}
