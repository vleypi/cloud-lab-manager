"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/shared/ui/Button";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Input } from "@/shared/ui/Input";

import { useAddPoolProject } from "@/features/pool/hooks/useAddPoolProject";
import { IPoolProjectCreatePayload } from "@/features/pool/interfaces/pool.interfaces";

interface IAddPoolProjectModalProps {
  onClose: () => void;
}

export function AddPoolProjectModal({ onClose }: IAddPoolProjectModalProps) {
  const [form, setForm] = useState<IPoolProjectCreatePayload>({
    ki_project_id: "",
    ki_project_name: "",
    ki_domain_id: "",
    ki_domain_name: "",
    ki_network_id: "",
    ki_router_id: "",
  });

  const { mutate, isPending, error } = useAddPoolProject();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: IPoolProjectCreatePayload = {
      ki_project_id: form.ki_project_id.trim(),
      ki_project_name: form.ki_project_name.trim(),
      ki_domain_id: form.ki_domain_id.trim(),
      ki_domain_name: form.ki_domain_name.trim(),
      ki_network_id: form.ki_network_id?.trim() || undefined,
      ki_router_id: form.ki_router_id?.trim() || undefined,
    };
    mutate(payload, { onSuccess: onClose });
  };

  const update = (key: keyof IPoolProjectCreatePayload, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="ID проекта в КИ"
          required
          value={form.ki_project_id}
          onChange={(event) => update("ki_project_id", event.target.value)}
          placeholder="abc123..."
          hint="UUID проекта в Keystone"
        />
        <Input
          label="Имя проекта"
          required
          value={form.ki_project_name}
          onChange={(event) => update("ki_project_name", event.target.value)}
          placeholder="cs-101-student-15"
        />
        <Input
          label="ID домена"
          required
          value={form.ki_domain_id}
          onChange={(event) => update("ki_domain_id", event.target.value)}
          placeholder="domain UUID"
        />
        <Input
          label="Имя домена"
          required
          value={form.ki_domain_name}
          onChange={(event) => update("ki_domain_name", event.target.value)}
          placeholder="course-cs101"
          hint="Соответствует курсу в LMS"
        />
        <Input
          label="ID сети (опц.)"
          value={form.ki_network_id ?? ""}
          onChange={(event) => update("ki_network_id", event.target.value)}
          placeholder="neutron network id"
        />
        <Input
          label="ID роутера (опц.)"
          value={form.ki_router_id ?? ""}
          onChange={(event) => update("ki_router_id", event.target.value)}
          placeholder="neutron router id"
        />
      </div>

      {error && <ErrorBox error={error} />}

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <Button variant="ghost" type="button" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" isLoading={isPending}>
          Добавить
        </Button>
      </div>
    </form>
  );
}
