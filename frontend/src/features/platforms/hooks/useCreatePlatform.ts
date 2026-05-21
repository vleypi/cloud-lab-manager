"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PLATFORMS_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { platformsService } from "@/features/platforms/services/platforms.service";
import { ILtiPlatformPayload } from "@/features/platforms/interfaces/platforms.interfaces";

export function useCreatePlatform() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ILtiPlatformPayload) => platformsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORMS_QK.all });
      toast.success("LTI платформа зарегистрирована");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось зарегистрировать платформу", error.message);
    },
  });
}
