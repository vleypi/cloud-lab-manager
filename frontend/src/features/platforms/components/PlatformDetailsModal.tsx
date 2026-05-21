"use client";

import { Badge } from "@/shared/ui/Badge";
import { KeyValue } from "@/shared/ui/KeyValue";

import { ILtiPlatform } from "@/features/platforms/interfaces/platforms.interfaces";

interface IPlatformDetailsModalProps {
  platform: ILtiPlatform;
}

export function PlatformDetailsModal({ platform }: IPlatformDetailsModalProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-100">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ki-dark truncate">{platform.name}</h3>
          <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">{platform.issuer}</p>
        </div>
        <Badge tone={platform.enabled ? "success" : "neutral"}>
          {platform.enabled ? "Активна" : "Отключена"}
        </Badge>
      </div>

      <section>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Идентификация
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <KeyValue label="Client ID" value={platform.client_id} mono copyable />
          <KeyValue
            label="Deployment IDs"
            value={
              platform.deployment_ids.length > 0
                ? platform.deployment_ids.join(", ")
                : "—"
            }
            mono
          />
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Endpoints
        </h4>
        <div className="grid grid-cols-1 gap-3">
          <KeyValue label="OIDC Login" value={platform.auth_login_url} mono copyable />
          <KeyValue label="Token URL" value={platform.auth_token_url} mono copyable />
          <KeyValue label="JWKS URL" value={platform.jwks_url} mono copyable />
        </div>
      </section>
    </div>
  );
}
