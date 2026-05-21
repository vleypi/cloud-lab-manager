"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { INSPECTOR_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { inspectorService } from "@/features/inspector/services/inspector.service";
import { ICheckSchedulePayload } from "@/features/inspector/interfaces/inspector.interfaces";

interface IScheduleArgs {
  standId: string;
  payload: ICheckSchedulePayload;
}

export function useScheduleCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ standId, payload }: IScheduleArgs) =>
      inspectorService.schedule(standId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: INSPECTOR_QK.runsForStand(data.run.stand_id) });
      queryClient.setQueryData(INSPECTOR_QK.run(data.run.id), data.run);
      toast.success("Проверка запущена");
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось запустить проверку", error.message);
    },
  });
}
