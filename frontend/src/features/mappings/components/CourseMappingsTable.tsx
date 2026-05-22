"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { ConfirmDeleteModal } from "@/shared/ui/ConfirmDeleteModal";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import {
  AlertTriangleIcon,
  LinkIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
} from "@/shared/icons/index-icons";
import { SearchBox } from "@/shared/ui/SearchBox";
import { SkeletonTable } from "@/shared/ui/Skeleton";
import { cn } from "@/shared/utils/cn";
import { useModal } from "@/shared/modal/hooks/useModal";

import { useCourseMappings } from "@/features/mappings/hooks/useCourseMappings";
import { useDeleteMapping } from "@/features/mappings/hooks/useDeleteMapping";
import { ICourseMapping } from "@/features/mappings/interfaces/mappings.interfaces";
import { UpsertMappingModal } from "@/features/mappings/components/UpsertMappingModal";
import { usePoolProjects } from "@/features/pool/hooks/usePoolProjects";

export function CourseMappingsTable() {
  const { data, isLoading, error } = useCourseMappings();
  const { data: poolProjects } = usePoolProjects();
  const { mutate: deleteMapping, isPending: isDeleting, variables: deletingId } = useDeleteMapping();
  const { openModal, closeModal } = useModal();
  const [searchQuery, setSearchQuery] = useState("");

  // домены, в которых есть хоть один проект пула — остальные ki_domain_name в маппингах «висят в воздухе»
  const domainsWithProjects = useMemo(
    () => new Set((poolProjects ?? []).map((p) => p.ki_domain_name)),
    [poolProjects],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!searchQuery.trim()) return data;
    const query = searchQuery.trim().toLowerCase();
    return data.filter((mapping) => {
      const fields = [
        mapping.course_code,
        mapping.lab_code,
        mapping.lti_context_id,
        mapping.resource_link_id,
        mapping.ki_domain_name,
        mapping.inspector_template,
        mapping.title,
      ];
      return fields.some((value) => value?.toLowerCase().includes(query));
    });
  }, [data, searchQuery]);

  const openCreate = () =>
    openModal("Новый маппинг курса", <UpsertMappingModal onClose={closeModal} />, {
      size: "xl",
      scrollInner: true,
      noPadding: true,
    });

  const openEdit = (mapping: ICourseMapping) =>
    openModal(
      "Редактировать маппинг",
      <UpsertMappingModal initialMapping={mapping} onClose={closeModal} />,
      { size: "xl", scrollInner: true, noPadding: true },
    );

  const openDelete = (mapping: ICourseMapping) =>
    openModal(
      "Удалить маппинг курса?",
      <ConfirmDeleteModal
        description={
          <>
            Будет удалено сопоставление курса <strong>{mapping.course_code}</strong> с лабой{" "}
            <strong>{mapping.lab_code}</strong>. Студенты этого курса перестанут получать стенды
            автоматически.
          </>
        }
        itemLabel={mapping.lti_context_id}
        confirmLabel="Да, удалить"
        isPending={isDeleting && deletingId === mapping.id}
        onConfirm={() => deleteMapping(mapping.id, { onSuccess: () => closeModal() })}
        onClose={closeModal}
      />,
      { size: "md" },
    );

  if (error) return <ErrorBox error={error} title="Не удалось получить маппинги" />;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <SearchBox
          value={searchQuery}
          onSearch={setSearchQuery}
          placeholder="Поиск по курсу, лабе, домену, context..."
          className="w-72"
        />
        <Button iconLeft={<PlusIcon size={16} />} onClick={openCreate}>
          Новый маппинг
        </Button>
      </div>

      {isLoading ? (
        <SkeletonTable
          rows={4}
          columns={[
            { span: 2, lines: 1 },
            { span: 2, badge: true },
            { span: 3, lines: 2 },
            { span: 2, lines: 1 },
            { span: 2, lines: 1 },
            { span: 1, lines: 1, align: "right" },
          ]}
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<LinkIcon size={20} />}
          title="Маппингов ещё нет"
          description="Добавьте сопоставление курса Moodle с доменом КИ для автоматизации запуска лаб"
          action={
            <Button size="sm" iconLeft={<PlusIcon size={14} />} onClick={openCreate}>
              Создать первый
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<LinkIcon size={20} />}
          title="По запросу ничего не найдено"
          description="Попробуйте изменить поисковый запрос"
        />
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">

          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-2 truncate">Курс</div>
            <div className="col-span-2 truncate">Лаба</div>
            <div className="col-span-3 truncate">LMS context</div>
            <div className="col-span-2 truncate">Домен КИ</div>
            <div className="col-span-2 truncate">Inspector</div>
            <div className="col-span-1 text-right truncate">Действия</div>
          </div>

          {filtered.map((mapping, idx) => (
            <div
              key={mapping.id}
              className={cn(
                "grid grid-cols-12 gap-4 px-4 py-3.5 items-center hover:bg-gray-50 transition group",
                idx === filtered.length - 1 ? "" : "border-b border-gray-100",
              )}
            >
              <div className="col-span-2 min-w-0">
                <div className="font-medium text-ki-dark truncate">{mapping.course_code}</div>
              </div>

              <div className="col-span-2">
                <Badge tone="violet">{mapping.lab_code}</Badge>
              </div>

              <div className="col-span-3 min-w-0">
                <div className="font-mono text-xs text-gray-600 truncate">
                  {mapping.lti_context_id}
                </div>
                {mapping.resource_link_id && (
                  <div className="font-mono text-[11px] text-gray-400 truncate mt-0.5">
                    {mapping.resource_link_id}
                  </div>
                )}
              </div>

              <div className="col-span-2 min-w-0">
                {domainsWithProjects.has(mapping.ki_domain_name) ? (
                  <span className="text-sm text-gray-700 truncate block">
                    {mapping.ki_domain_name}
                  </span>
                ) : (
                  <span
                    className="flex items-center gap-1.5 text-sm text-red-600 min-w-0"
                    title="В пуле нет проектов в этом домене — студенты получат pool_exhausted"
                  >
                    <AlertTriangleIcon size={14} className="flex-shrink-0" />
                    <span className="truncate min-w-0">{mapping.ki_domain_name || "—"}</span>
                  </span>
                )}
              </div>

              <div className="col-span-2 min-w-0">
                {mapping.inspector_template ? (
                  <span className="font-mono text-xs text-gray-700 truncate block">
                    {mapping.inspector_template}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </div>

              <div className="col-span-1 flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(mapping)}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-ki-blue hover:bg-ki-blue-light transition"
                  aria-label="Изменить"
                  title="Изменить"
                >
                  <SettingsIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => openDelete(mapping)}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition"
                  aria-label="Удалить"
                  title="Удалить"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
