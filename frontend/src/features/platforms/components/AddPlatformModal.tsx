"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/shared/ui/Button";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Input } from "@/shared/ui/Input";

import { useCreatePlatform } from "@/features/platforms/hooks/useCreatePlatform";
import { ILtiPlatformPayload } from "@/features/platforms/interfaces/platforms.interfaces";

interface IAddPlatformModalProps {
  onClose: () => void;
}

export function AddPlatformModal({ onClose }: IAddPlatformModalProps) {
  const [form, setForm] = useState({
    name: "",
    issuer: "",
    client_id: "",
    deployment_ids: "",
    auth_login_url: "",
    auth_token_url: "",
    jwks_url: "",
  });
  const { mutate, isPending, error } = useCreatePlatform();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const deploymentIds = form.deployment_ids
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const payload: ILtiPlatformPayload = {
      name: form.name.trim(),
      issuer: form.issuer.trim(),
      client_id: form.client_id.trim(),
      deployment_ids: deploymentIds,
      auth_login_url: form.auth_login_url.trim(),
      auth_token_url: form.auth_token_url.trim(),
      jwks_url: form.jwks_url.trim(),
      enabled: true,
    };
    mutate(payload, { onSuccess: onClose });
  };

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Название (для админки)"
        required
        value={form.name}
        onChange={(event) => update("name", event.target.value)}
        placeholder="Корпоративный Moodle"
      />
      <Input
        label="Issuer (iss)"
        required
        value={form.issuer}
        onChange={(event) => update("issuer", event.target.value)}
        placeholder="https://moodle.example.com"
        hint="URL вашего Moodle, точно как в id_token"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Client ID (выдаёт Moodle)"
          required
          value={form.client_id}
          onChange={(event) => update("client_id", event.target.value)}
          placeholder="cloud-lab-manager"
        />
        <Input
          label="Deployment IDs"
          required
          value={form.deployment_ids}
          onChange={(event) => update("deployment_ids", event.target.value)}
          placeholder="1,2,3"
          hint="Через запятую"
        />
      </div>
      <Input
        label="OIDC Login URL"
        required
        value={form.auth_login_url}
        onChange={(event) => update("auth_login_url", event.target.value)}
        placeholder="https://moodle.example.com/mod/lti/auth.php"
      />
      <Input
        label="Token URL"
        required
        value={form.auth_token_url}
        onChange={(event) => update("auth_token_url", event.target.value)}
        placeholder="https://moodle.example.com/mod/lti/token.php"
      />
      <Input
        label="JWKS URL"
        required
        value={form.jwks_url}
        onChange={(event) => update("jwks_url", event.target.value)}
        placeholder="https://moodle.example.com/mod/lti/certs.php"
        hint="Endpoint, откуда мы читаем публичный ключ для проверки id_token"
      />

      {error && <ErrorBox error={error} />}

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button variant="ghost" type="button" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" isLoading={isPending}>
          Зарегистрировать
        </Button>
      </div>
    </form>
  );
}
