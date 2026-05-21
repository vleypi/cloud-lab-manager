import { useMutation, useQueryClient } from "@tanstack/react-query";

import { mappingsService } from "@/features/mappings/services/mappings.service";
import { ILabLaunchPayload } from "@/features/mappings/interfaces/mappings.interfaces";
import { STANDS_QK } from "@/shared/api/queryKeys";

export function useLabLaunch(mappingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ILabLaunchPayload) =>
      mappingsService.launchFor(mappingId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STANDS_QK.all });
    },
  });
}
