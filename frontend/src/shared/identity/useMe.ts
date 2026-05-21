"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AUTH_QK } from "@/shared/api/queryKeys";
import { IUser } from "@/shared/identity/user.types";
import { ApiError } from "@/shared/utils/service.util";
import { authService } from "@/features/auth/services/auth.service";

interface IUseMeReturn {
  user: IUser | null;

  isReady: boolean;

  isLoading: boolean;

  error: ApiError | null;

  reset: () => void;
}

const STALE_TIME_MS = 5 * 60 * 1_000;

export function useMe(): IUseMeReturn {
  const queryClient = useQueryClient();

  const query = useQuery<IUser | null, ApiError>({
    queryKey: AUTH_QK.me(),
    queryFn: async () => {
      try {
        const { user } = await authService.me();
        return user;
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) return null;
        throw error;
      }
    },
    staleTime: STALE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    user: query.data ?? null,
    isReady: !query.isLoading,
    isLoading: query.isLoading,
    error: query.error ?? null,
    reset: () => {
      queryClient.setQueryData(AUTH_QK.me(), null);
      queryClient.invalidateQueries({ queryKey: AUTH_QK.me() });
    },
  };
}
