"use client";

import { Button } from "@/shared/ui/Button";

import { IStand } from "@/features/stands/interfaces/stands.interfaces";
import { CredentialsView } from "@/features/stands/components/CredentialsView";
import { useStandCredentials } from "@/features/stands/hooks/useStandCredentials";

interface ICredentialsModalProps {
  stand: IStand;
  onClose: () => void;
}

export function CredentialsModal({ stand, onClose }: ICredentialsModalProps) {

  const { error } = useStandCredentials(stand.id);

  return (
    <div className="space-y-4">
      <CredentialsView stand={stand} />

      <Button
        onClick={onClose}
        variant={error ? "ghost" : "primary"}
        fullWidth
      >
        {error ? "Закрыть" : "Готово"}
      </Button>
    </div>
  );
}
