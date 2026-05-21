import { Badge } from "@/shared/ui/Badge";

import {
  RUN_STATUS_LABELS,
  RUN_STATUS_PULSE,
  RUN_STATUS_TONE,
} from "@/features/inspector/constants/inspector.constants";
import { TCheckRunStatus } from "@/features/inspector/interfaces/inspector.interfaces";

export function CheckRunBadge({ status }: { status: TCheckRunStatus }) {
  return (
    <Badge tone={RUN_STATUS_TONE[status]} pulse={RUN_STATUS_PULSE[status]}>
      {RUN_STATUS_LABELS[status]}
    </Badge>
  );
}
