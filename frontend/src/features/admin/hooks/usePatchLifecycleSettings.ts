"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ADMIN_QK, CAPACITY_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { adminService } from "@/features/admin/services/admin.service";
import { ILifecycleSettingsPatch } from "@/features/admin/interfaces/admin.interfaces";

export function usePatchLifecycleSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ILifecycleSettingsPatch) => adminService.patchLifecycleSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(ADMIN_QK.lifecycleSettings(), data);
      queryClient.invalidateQueries({ queryKey: CAPACITY_QK.all });
      toast.success("Настройки обновлены", "Применятся к следующим запускам");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось сохранить настройки", error.message);
    },
  });
}
