import { Badge } from "@/shared/ui/Badge";
import { STATUS_LABELS, STATUS_PULSE, STATUS_TONE } from "@/features/stands/constants/stands.constants";
import { TStandStatus } from "@/features/stands/interfaces/stands.interfaces";

interface IStandStatusBadgeProps {
  status: TStandStatus;
  size?: "sm" | "md";
}

export function StandStatusBadge({ status, size = "sm" }: IStandStatusBadgeProps) {
  return (
    <Badge tone={STATUS_TONE[status]} pulse={STATUS_PULSE[status]} size={size}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
