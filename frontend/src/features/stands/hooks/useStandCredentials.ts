"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";
import { standsService } from "@/features/stands/services/stands.service";
import { IStandCredentials } from "@/features/stands/interfaces/stands.interfaces";

const credentialsKey = (standId: string) => ["stands", standId, "credentials"] as const;

export function useStandCredentials(standId: string, enabled = true) {
  return useQuery<IStandCredentials, ApiError>({
    queryKey: credentialsKey(standId),
    queryFn: () => standsService.getCredentials(standId),
    enabled: enabled && Boolean(standId),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useNotifyCredentialsError() {
  return (error: ApiError) => {
    const isGone = error.statusCode === 404;
    toast.error(
      isGone ? "Ключ пока недоступен" : "Не удалось получить ключ",
      isGone
        ? "Стенд ещё готовится или уже удалён. Подождите или запустите заново."
        : error.message,
    );
  };
}

export function useClearCredentialsCache() {
  const queryClient = useQueryClient();
  return (standId: string) => {
    queryClient.removeQueries({ queryKey: credentialsKey(standId) });
  };
}
