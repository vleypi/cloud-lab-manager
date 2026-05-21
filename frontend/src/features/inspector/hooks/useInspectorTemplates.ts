"use client";

import { useQuery } from "@tanstack/react-query";

import { INSPECTOR_QK } from "@/shared/api/queryKeys";
import { inspectorService } from "@/features/inspector/services/inspector.service";

export function useInspectorTemplates() {
  return useQuery({
    queryKey: [...INSPECTOR_QK.all, "templates"] as const,
    queryFn: () => inspectorService.listTemplates(),
    staleTime: 5 * 60 * 1000,
  });
}
