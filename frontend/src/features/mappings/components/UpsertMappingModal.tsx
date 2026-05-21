"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/shared/ui/Button";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Input } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";

import { describeFlavor, describeImage } from "@/features/cloud/utils/cloud.utils";
import { useCloudFlavors } from "@/features/cloud/hooks/useCloudFlavors";
import { useCloudImages } from "@/features/cloud/hooks/useCloudImages";
import { ICourseMapping, ICourseMappingPayload } from "@/features/mappings/interfaces/mappings.interfaces";
import { useUpsertMapping } from "@/features/mappings/hooks/useUpsertMapping";

interface IUpsertMappingModalProps {
  initialMapping?: ICourseMapping;
  onClose: () => void;
}

export function UpsertMappingModal({ initialMapping, onClose }: IUpsertMappingModalProps) {
  const { data: images } = useCloudImages();
  const { data: flavors } = useCloudFlavors();
  const { mutate, isPending, error } = useUpsertMapping();

  const [form, setForm] = useState<ICourseMappingPayload>({
    lti_context_id: initialMapping?.lti_context_id ?? "",
    resource_link_id: initialMapping?.resource_link_id ?? "",
    course_code: initialMapping?.course_code ?? "",
    ki_domain_name: initialMapping?.ki_domain_name ?? "",
    lab_code: initialMapping?.lab_code ?? "",
    image_id: initialMapping?.image_id ?? "",
    flavor_id: initialMapping?.flavor_id ?? "",
    inspector_template: initialMapping?.inspector_template ?? "",
    title: initialMapping?.title ?? "",
    description: initialMapping?.description ?? "",
    default_ttl_seconds: initialMapping?.default_ttl_seconds ?? undefined,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: ICourseMappingPayload = {
      lti_context_id: form.lti_context_id.trim(),
      resource_link_id: form.resource_link_id?.trim() || undefined,
      course_code: form.course_code.trim(),
      ki_domain_name: form.ki_domain_name.trim(),
      lab_code: form.lab_code.trim(),
      image_id: form.image_id,
      flavor_id: form.flavor_id,
      inspector_template: form.inspector_template?.trim() || undefined,
      title: form.title?.trim() || undefined,
      description: form.description?.trim() || undefined,
      default_ttl_seconds: form.default_ttl_seconds ?? undefined,
    };
    mutate(payload, { onSuccess: onClose });
  };

  const update = <K extends keyof ICourseMappingPayload>(key: K, value: ICourseMappingPayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
        <div className="text-xs font-semibold text-ki-dark uppercase tracking-wide">
          Описание лабы (то, что видит студент в Moodle)
        </div>
        <Input
          label="Название"
          value={form.title ?? ""}
          onChange={(event) => update("title", event.target.value)}
          placeholder="Лаба №4. Развёртывание nginx + SSL"
        />
        <Input
          label="Краткое описание"
          value={form.description ?? ""}
          onChange={(event) => update("description", event.target.value)}
          placeholder="Установить nginx, выдать self-signed cert, открыть 443 порт"
        />
        <Input
          label="TTL по умолчанию (секунды, опц.)"
          type="number"
          value={form.default_ttl_seconds?.toString() ?? ""}
          onChange={(event) =>
            update(
              "default_ttl_seconds",
              event.target.value ? Number(event.target.value) : undefined,
            )
          }
          placeholder="7200"
          hint="Если пусто — используется глобальный лимит из настроек жизненного цикла"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="LTI context_id (курс)"
          required
          value={form.lti_context_id}
          onChange={(event) => update("lti_context_id", event.target.value)}
          placeholder="42"
          hint="ID курса в Moodle"
        />
        <Input
          label="resource_link_id (опц.)"
          value={form.resource_link_id ?? ""}
          onChange={(event) => update("resource_link_id", event.target.value)}
          placeholder="act-7"
          hint="Override для конкретной активности"
        />
        <Input
          label="Код курса"
          required
          value={form.course_code}
          onChange={(event) => update("course_code", event.target.value)}
          placeholder="cs-101"
        />
        <Input
          label="Имя домена КИ"
          required
          value={form.ki_domain_name}
          onChange={(event) => update("ki_domain_name", event.target.value)}
          placeholder="course-cs101"
          hint="Совпадает с доменом проектов в пуле"
        />
        <Input
          label="Код лабораторной"
          required
          value={form.lab_code}
          onChange={(event) => update("lab_code", event.target.value)}
          placeholder="lab-04"
        />
        <Input
          label="Inspector template (опц.)"
          value={form.inspector_template ?? ""}
          onChange={(event) => update("inspector_template", event.target.value)}
          placeholder="lab-04"
          hint="Имя YAML-шаблона для авто-проверок"
        />
        <Select
          label="Образ ОС"
          placeholder="Выберите образ..."
          required
          value={form.image_id}
          onChange={(event) => update("image_id", event.target.value)}
          options={(images ?? []).map((img) => ({
            value: img.id,
            label: `${img.name} — ${describeImage(img)}`,
          }))}
        />
        <Select
          label="Flavor"
          placeholder="Выберите flavor..."
          required
          value={form.flavor_id}
          onChange={(event) => update("flavor_id", event.target.value)}
          options={(flavors ?? []).map((flavor) => ({
            value: flavor.id,
            label: `${flavor.name} — ${describeFlavor(flavor)}`,
          }))}
        />
      </div>

      {error && <ErrorBox error={error} />}

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button variant="ghost" type="button" onClick={onClose}>
          Отмена
        </Button>
        <Button type="submit" isLoading={isPending}>
          {initialMapping ? "Обновить" : "Создать"}
        </Button>
      </div>
    </form>
  );
}
