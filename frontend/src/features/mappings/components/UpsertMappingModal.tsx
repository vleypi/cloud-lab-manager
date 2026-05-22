"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";

import { Button } from "@/shared/ui/Button";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Input } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";

import { describeFlavor, describeImage } from "@/features/cloud/utils/cloud.utils";
import { useCloudFlavors } from "@/features/cloud/hooks/useCloudFlavors";
import { useCloudImages } from "@/features/cloud/hooks/useCloudImages";
import { useInspectorTemplates } from "@/features/inspector/hooks/useInspectorTemplates";
import { ICourseMapping, ICourseMappingPayload } from "@/features/mappings/interfaces/mappings.interfaces";
import { useCourseMappings } from "@/features/mappings/hooks/useCourseMappings";
import { useUpsertMapping } from "@/features/mappings/hooks/useUpsertMapping";
import { usePoolProjects } from "@/features/pool/hooks/usePoolProjects";

interface ILockedLtiIds {
  lti_context_id: string;
  resource_link_id: string | null;
  context_title?: string | null;
  resource_link_title?: string | null;
}

interface IUpsertMappingModalProps {
  initialMapping?: ICourseMapping;
  lockedLtiIds?: ILockedLtiIds;
  onClose: () => void;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((v) => (v ?? "").trim())
        .filter((v) => v.length > 0),
    ),
  ).sort();
}

interface IFormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  last?: boolean;
}

function FormSection({ title, description, children, last = false }: IFormSectionProps) {
  return (
    <section
      className={
        last
          ? "grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-x-8 gap-y-3 py-5"
          : "grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-x-8 gap-y-3 py-5 border-b border-gray-100"
      }
    >
      <div className="lg:pt-1">
        <h3 className="text-sm font-semibold text-ki-dark">{title}</h3>
        {description && (
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="space-y-4 min-w-0">{children}</div>
    </section>
  );
}

export function UpsertMappingModal({ initialMapping, lockedLtiIds, onClose }: IUpsertMappingModalProps) {
  const { data: images } = useCloudImages();
  const { data: flavors } = useCloudFlavors();
  const { data: templates } = useInspectorTemplates();
  const { data: poolProjects } = usePoolProjects();
  const { data: existingMappings } = useCourseMappings();
  const { mutate, isPending, error } = useUpsertMapping();

  const [form, setForm] = useState<ICourseMappingPayload>({
    lti_context_id: lockedLtiIds?.lti_context_id ?? initialMapping?.lti_context_id ?? "",
    resource_link_id:
      lockedLtiIds?.resource_link_id ?? initialMapping?.resource_link_id ?? "",
    course_code: initialMapping?.course_code ?? "",
    ki_domain_name: initialMapping?.ki_domain_name ?? "",
    lab_code: initialMapping?.lab_code ?? "",
    image_id: initialMapping?.image_id ?? "",
    flavor_id: initialMapping?.flavor_id ?? "",
    inspector_template: initialMapping?.inspector_template ?? "",
    title: initialMapping?.title ?? lockedLtiIds?.resource_link_title ?? "",
    description: initialMapping?.description ?? "",
    default_ttl_seconds: initialMapping?.default_ttl_seconds ?? undefined,
  });

  const poolDomainStats = useMemo(() => {
    const map = new Map<string, { free: number; total: number }>();
    for (const p of poolProjects ?? []) {
      const slot = map.get(p.ki_domain_name) ?? { free: 0, total: 0 };
      slot.total += 1;
      if (p.status === "free") slot.free += 1;
      map.set(p.ki_domain_name, slot);
    }
    return map;
  }, [poolProjects]);

  const selectedDomainInPool = poolDomainStats.has(form.ki_domain_name);

  const domainOptions = useMemo(() => {
    const real = Array.from(poolDomainStats.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, counts]) => ({
        value: name,
        label: `${name} — ${counts.free} свободно из ${counts.total}`,
      }));

    if (form.ki_domain_name && !selectedDomainInPool) {
      return [
        { value: form.ki_domain_name, label: `${form.ki_domain_name} (нет в пуле)` },
        ...real,
      ];
    }
    return real;
  }, [poolDomainStats, form.ki_domain_name, selectedDomainInPool]);

  const ctxSuggestions = useMemo(
    () => uniqueStrings((existingMappings ?? []).map((m) => m.lti_context_id)),
    [existingMappings],
  );
  const linkSuggestions = useMemo(
    () => uniqueStrings((existingMappings ?? []).map((m) => m.resource_link_id)),
    [existingMappings],
  );
  const courseCodeSuggestions = useMemo(
    () => uniqueStrings((existingMappings ?? []).map((m) => m.course_code)),
    [existingMappings],
  );
  const labCodeSuggestions = useMemo(
    () => uniqueStrings((existingMappings ?? []).map((m) => m.lab_code)),
    [existingMappings],
  );

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

  const onDomainChange = (domain: string) => {
    setForm((prev) => ({
      ...prev,
      ki_domain_name: domain,
      course_code: prev.course_code.trim() ? prev.course_code : domain,
    }));
  };

  const onTemplateChange = (template: string) => {
    setForm((prev) => ({
      ...prev,
      inspector_template: template,
      lab_code: prev.lab_code.trim() ? prev.lab_code : template,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-2">
        <datalist id="mapping-ctx-list">
          {ctxSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <datalist id="mapping-link-list">
          {linkSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <datalist id="mapping-course-list">
          {courseCodeSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <datalist id="mapping-lab-list">
          {labCodeSuggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        {lockedLtiIds && (
          <div className="mb-5 rounded-xl border border-ki-blue/20 bg-ki-blue-light px-4 py-3">
            <div className="text-xs font-semibold text-ki-blue-strong uppercase tracking-wide">
              Привязка к активности из Moodle
            </div>
            <div className="mt-1 text-sm text-ki-dark">
              {lockedLtiIds.resource_link_title ?? lockedLtiIds.context_title ?? "Без названия"}
            </div>
            <div className="mt-1 text-[11px] text-gray-500 font-mono">
              context: {lockedLtiIds.lti_context_id}
              {lockedLtiIds.resource_link_id && (
                <> · link: {lockedLtiIds.resource_link_id}</>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-600">
              LTI-идентификаторы заполнены автоматически и заблокированы — менять их не нужно.
              Выберите домен КИ, образ, flavor и шаблон проверки.
            </p>
          </div>
        )}

        <FormSection
          title="Описание для студента"
          description="Видно в Moodle на странице запуска лабы"
        >
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
        </FormSection>

        <FormSection
          title="Привязка в Moodle"
          description="Идентификаторы курса и активности из LTI-запроса"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="LTI context_id (курс)"
              required
              value={form.lti_context_id}
              onChange={(event) => update("lti_context_id", event.target.value)}
              placeholder="42"
              hint={lockedLtiIds ? "Из LTI-запроса Moodle (заблокирован)" : "ID курса в Moodle"}
              list="mapping-ctx-list"
              autoComplete="off"
              readOnly={Boolean(lockedLtiIds)}
              className={lockedLtiIds ? "bg-gray-50 text-gray-500 cursor-not-allowed" : undefined}
            />
            <Input
              label="resource_link_id (опц.)"
              value={form.resource_link_id ?? ""}
              onChange={(event) => update("resource_link_id", event.target.value)}
              placeholder="act-7"
              hint={
                lockedLtiIds ? "Из LTI-запроса Moodle (заблокирован)" : "Override для конкретной активности"
              }
              list="mapping-link-list"
              autoComplete="off"
              readOnly={Boolean(lockedLtiIds)}
              className={lockedLtiIds ? "bg-gray-50 text-gray-500 cursor-not-allowed" : undefined}
            />
            <Input
              label="Код курса"
              required
              value={form.course_code}
              onChange={(event) => update("course_code", event.target.value)}
              placeholder="cs-101"
              list="mapping-course-list"
              autoComplete="off"
            />
            <Input
              label="Код лабораторной"
              required
              value={form.lab_code}
              onChange={(event) => update("lab_code", event.target.value)}
              placeholder="lab-04"
              list="mapping-lab-list"
              autoComplete="off"
              hint={
                form.inspector_template && form.lab_code !== form.inspector_template
                  ? `Имя шаблона: ${form.inspector_template} — авто-проверка может не найтись по lab_code`
                  : undefined
              }
            />
          </div>
        </FormSection>

        <FormSection
          title="Облачные ресурсы"
          description="Где и из чего будет разворачиваться стенд"
        >
          {domainOptions.length > 0 ? (
            <Select
              label="Имя домена КИ"
              placeholder="Выберите домен из пула..."
              required
              value={form.ki_domain_name}
              onChange={(event) => onDomainChange(event.target.value)}
              options={domainOptions}
              hint={
                form.ki_domain_name && !selectedDomainInPool
                  ? `Домена «${form.ki_domain_name}» нет в пуле — студенты получат pool_exhausted`
                  : "Список доменов с проектами в пуле"
              }
            />
          ) : (
            <Input
              label="Имя домена КИ"
              required
              value={form.ki_domain_name}
              onChange={(event) => update("ki_domain_name", event.target.value)}
              placeholder="course-cs101"
              hint="В пуле пока нет проектов — добавьте проекты, чтобы получить список"
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </FormSection>

        <FormSection
          title="Авто-проверка и лимиты"
          description="Шаблон SSH-проверки и время жизни стенда"
          last
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {templates && templates.length > 0 ? (
              <Select
                label="Inspector template (опц.)"
                placeholder="— не задан —"
                value={form.inspector_template ?? ""}
                onChange={(event) => onTemplateChange(event.target.value)}
                options={[
                  { value: "", label: "— не задан —" },
                  ...templates.map((t) => ({
                    value: t.name,
                    label: `${t.name} — ${t.display_name} (${t.checks_count} ш.)`,
                  })),
                ]}
                hint="YAML-шаблон из config/check_templates"
              />
            ) : (
              <Input
                label="Inspector template (опц.)"
                value={form.inspector_template ?? ""}
                onChange={(event) => update("inspector_template", event.target.value)}
                placeholder="lab-04"
                hint="Шаблоны не загружены — проверьте config/check_templates"
              />
            )}
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
              hint="Если пусто — берётся глобальный лимит из настроек жизненного цикла"
            />
          </div>
        </FormSection>

        {error && <ErrorBox error={error} className="my-4" />}
      </div>

      <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-white rounded-b-2xl">
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
