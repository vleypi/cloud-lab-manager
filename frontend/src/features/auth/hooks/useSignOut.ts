"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { AUTH_QK } from "@/shared/api/queryKeys";
import { ROUTES } from "@/shared/config/routes.constant";
import { toast } from "@/shared/ui/toast";

import { authService } from "@/features/auth/services/auth.service";

export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      queryClient.setQueryData(AUTH_QK.me(), null);
      queryClient.invalidateQueries({ queryKey: AUTH_QK.me() });
      toast.info("Сессия завершена");
      router.push(ROUTES.LOGIN);
    },
  });
}
