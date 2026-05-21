import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/shared/utils/service.util";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {

          if (error instanceof ApiError) {
            if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 408) {
              return false;
            }
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
