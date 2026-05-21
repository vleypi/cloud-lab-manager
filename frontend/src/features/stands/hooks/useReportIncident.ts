"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { STANDS_QK } from "@/shared/api/queryKeys";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { standsService } from "@/features/stands/services/stands.service";
import { IReportIncidentPayload } from "@/features/stands/interfaces/stands.interfaces";

interface IReportArgs {
  standId: string;
  payload: IReportIncidentPayload;
}

export function useReportIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ standId, payload }: IReportArgs) =>
      standsService.reportIncident(standId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(STANDS_QK.one(data.id), data);
      queryClient.invalidateQueries({ queryKey: STANDS_QK.all });
      toast.success(
        "Проблема зарегистрирована",
        "Стенд заморожен, преподаватель увидит инцидент в админ-панели",
      );
    },
    onError: (error: ApiError) => {
      toast.error("Не удалось отправить", error.message);
    },
  });
}
