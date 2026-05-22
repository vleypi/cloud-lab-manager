"use client";

import { useState } from "react";

import { ActionMenu, IActionMenuItem } from "@/shared/ui/ActionMenu";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { ConfirmDeleteModal } from "@/shared/ui/ConfirmDeleteModal";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { SearchBox } from "@/shared/ui/SearchBox";
import { SkeletonTable } from "@/shared/ui/Skeleton";
import { LayersIcon, PlusIcon, TrashIcon } from "@/shared/icons/index-icons";
import { formatDateTime } from "@/shared/utils/format.util";
import { useModal } from "@/shared/modal/hooks/useModal";

import { usePoolProjects } from "@/features/pool/hooks/usePoolProjects";
import { useDeletePoolProject } from "@/features/pool/hooks/useDeletePoolProject";
import { POOL_STATUS_LABELS, POOL_STATUS_TONE } from "@/features/pool/constants/pool.constants";
import { IPoolProject } from "@/features/pool/interfaces/pool.interfaces";
import { AddPoolProjectModal } from "@/features/pool/components/AddPoolProjectModal";

interface IPoolProjectsTableProps {
  className?: string;
}

export function PoolProjectsTable({ className }: IPoolProjectsTableProps) {
  const { data: projects, isLoading, error } = usePoolProjects();
  const { mutate: deleteProject, isPending: isDeleting, variables: deletingId } =
    useDeletePoolProject();
  const { openModal, closeModal } = useModal();
  const [searchQuery, setSearchQuery] = useState("");

  const handleAddClick = () => {
    openModal("Добавить проект КИ в пул", <AddPoolProjectModal onClose={closeModal} />, {
      size: "lg",
    });
  };

  const handleDeleteClick = (project: IPoolProject) => {
    openModal(
      "Удалить проект из пула?",
      <ConfirmDeleteModal
        description={
          <>
            Вы собираетесь удалить проект <strong>{project.ki_project_name}</strong> из пула
            ресурсов КИ.
          </>
        }
        itemLabel={project.ki_project_id}
        confirmLabel="Да, удалить"
        pendingLabel="Удаление..."
        isPending={isDeleting && deletingId === project.id}
        onConfirm={() =>
          deleteProject(project.id, {
            onSuccess: () => closeModal(),
          })
        }
        onClose={closeModal}
      />,
      { size: "md" },
    );
  };

  if (error) return <ErrorBox error={error} title="Не удалось получить пул" />;

  const filtered = (projects ?? []).filter((project) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.ki_project_name.toLowerCase().includes(query) ||
      project.ki_project_id.toLowerCase().includes(query) ||
      project.ki_domain_name.toLowerCase().includes(query)
    );
  });

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <SearchBox
          value={searchQuery}
          onSearch={setSearchQuery}
          placeholder="Поиск по имени, домену, id..."
          className="w-72"
        />
        <div className="flex items-center gap-2">
          <Button iconLeft={<PlusIcon size={16} />} onClick={handleAddClick}>
            Добавить проект
          </Button>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable
          rows={4}
          columns={[
            { span: 4, lines: 2 },
            { span: 3, lines: 1 },
            { span: 2, badge: true },
            { span: 2, lines: 1 },
            { span: 1, lines: 1, align: "right" },
          ]}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<LayersIcon size={20} />}
          title={searchQuery ? "По запросу ничего не найдено" : "Пул пуст"}
          description={
            searchQuery
              ? "Попробуйте изменить поисковый запрос"
              : "Добавьте предсозданные проекты КИ для распределения студентам"
          }
          action={
            !searchQuery && (
              <Button iconLeft={<PlusIcon size={16} />} onClick={handleAddClick} size="sm">
                Добавить первый проект
              </Button>
            )
          }
        />
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">

          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-4 truncate">Имя проекта</div>
            <div className="col-span-3 truncate">Домен</div>
            <div className="col-span-2 truncate">Статус</div>
            <div className="col-span-2 truncate">Освободился</div>
            <div className="col-span-1 text-center truncate">Действия</div>
          </div>

          {filtered.map((project, idx) => (
            <ProjectRow
              key={project.id}
              project={project}
              isLast={idx === filtered.length - 1}
              onDeleteClick={handleDeleteClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface IProjectRowProps {
  project: IPoolProject;
  isLast: boolean;
  onDeleteClick: (project: IPoolProject) => void;
}

function ProjectRow({ project, isLast, onDeleteClick }: IProjectRowProps) {
  const canDelete = project.status === "free" || project.status === "disabled";

  return (
    <div
      className={`grid grid-cols-12 gap-4 px-4 py-3.5 items-center hover:bg-gray-50 transition group ${
        isLast ? "" : "border-b border-gray-100"
      }`}
    >
      <div className="col-span-4 min-w-0">
        <div className="font-medium text-ki-dark truncate">{project.ki_project_name}</div>
        <div className="text-xs text-gray-400 font-mono truncate">{project.ki_project_id}</div>
      </div>

      <div className="col-span-3 text-sm text-gray-600 truncate">{project.ki_domain_name}</div>

      <div className="col-span-2">
        <Badge tone={POOL_STATUS_TONE[project.status]}>
          {POOL_STATUS_LABELS[project.status]}
        </Badge>
      </div>

      <div className="col-span-2 text-xs text-gray-500 truncate">
        {project.last_released_at ? formatDateTime(project.last_released_at) : "—"}
      </div>

      <div className="col-span-1 flex items-center justify-center">
        <ActionMenu
          emptyHint="занят"
          items={[
            {
              key: "delete",
              label: "Удалить проект",
              icon: <TrashIcon size={14} />,
              tone: "danger",
              hidden: !canDelete,
              onClick: () => onDeleteClick(project),
            },
          ] satisfies IActionMenuItem[]}
        />
      </div>
    </div>
  );
}
