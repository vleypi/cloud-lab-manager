"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import { AUTH_QK } from "@/shared/api/queryKeys";
import { ROUTES } from "@/shared/config/routes.constant";
import { toast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/utils/service.util";

import {
  IAdminLoginPayload,
  IMeResponse,
} from "@/features/auth/interfaces/auth.interfaces";
import { authService } from "@/features/auth/services/auth.service";

export function useAdminSignIn() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  return useMutation<IMeResponse, ApiError, IAdminLoginPayload>({
    mutationFn: (payload) => authService.adminLogin(payload),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(AUTH_QK.me(), user);
      toast.success("Вход выполнен", `Здравствуйте, ${user.displayName}`);
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/") ? next : ROUTES.ADMIN.OVERVIEW);
    },
    onError: (error) => {
      toast.error("Не удалось войти", error.message);
    },
  });
}
