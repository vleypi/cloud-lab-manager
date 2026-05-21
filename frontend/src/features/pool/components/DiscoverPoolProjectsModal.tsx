"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { Input } from "@/shared/ui/Input";
import { SearchBox } from "@/shared/ui/SearchBox";
import { SkeletonTable } from "@/shared/ui/Skeleton";
import { LayersIcon, RefreshIcon } from "@/shared/icons/index-icons";

import { useDiscoverPoolProjects } from "@/features/pool/hooks/useDiscoverPoolProjects";
import { useBulkAddPoolProjects } from "@/features/pool/hooks/useBulkAddPoolProjects";
import { IDiscoveredKiProject } from "@/features/pool/interfaces/pool.interfaces";

interface IDiscoverPoolProjectsModalProps {
  onClose: () => void;
}

export function DiscoverPoolProjectsModal({ onClose }: IDiscoverPoolProjectsModalProps) {
  const [domainFilter, setDomainFilter] = useState("");
  const [appliedDomain, setAppliedDomain] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching, error } = useDiscoverPoolProjects(appliedDomain);
  const { mutate: bulkAdd, isPending: isAdding } = useBulkAddPoolProjects();

  const projects = data ?? [];

  const filtered = useMemo(() => {
    if (!search) return projects;
    const q = search.toLowerCase();
    return projects.filter((p) =>
      [p.ki_project_name, p.ki_project_id, p.ki_domain_name].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [projects, search]);

  const selectableIds = useMemo(
    () => filtered.filter((p) => !p.already_in_pool).map((p) => p.ki_project_id),
    [filtered],
  );

  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.has(id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const id of selectableIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of selectableIds) next.add(id);
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplyDomain = () => {
    const trimmed = domainFilter.trim();
    setAppliedDomain(trimmed || undefined);
    setSelectedIds(new Set());
  };

  const handleSubmit = () => {
    const byId = new Map(projects.map((p) => [p.ki_project_id, p] as const));
    const payload = Array.from(selectedIds)
      .map((id) => byId.get(id))
      .filter((p): p is IDiscoveredKiProject => Boolean(p))
      .map((p) => ({
        ki_project_id: p.ki_project_id,
        ki_project_name: p.ki_project_name,
        ki_domain_id: p.ki_domain_id,
        ki_domain_name: p.ki_domain_name,
        ki_network_id: p.ki_network_id ?? undefined,
        ki_router_id: p.ki_router_id ?? undefined,
      }));

    if (payload.length === 0) return;

    bulkAdd(
      { projects: payload },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          onClose();
        },
      },
    );
  };

  const freshCount = projects.filter((p) => !p.already_in_pool).length;
  const knownCount = projects.length - freshCount;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
        <div className="text-xs font-semibold text-ki-dark uppercase tracking-wide">
          Источник: Keystone КИ
        </div>
        <p className="text-xs text-gray-500">
          Сервис обращается к Keystone и листает существующие проекты. Помеченные «в пуле»
          уже зарегистрированы — добавить их повторно нельзя. Сколько отметите — столько
          студентов сможете обслужить.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Фильтр по UUID домена (опц.)"
              value={domainFilter}
              onChange={(event) => setDomainFilter(event.target.value)}
              placeholder="domain uuid — пусто чтобы взять все"
              hint="Ускоряет на больших инсталляциях КИ"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleApplyDomain}
            iconLeft={<RefreshIcon size={14} />}
            isLoading={isFetching}
          >
            Обновить
          </Button>
        </div>
      </div>

      {error && <ErrorBox error={error} title="Не удалось получить список проектов КИ" />}

      <div className="flex items-center justify-between gap-3">
        <SearchBox
          value={search}
          onSearch={setSearch}
          placeholder="Поиск по имени, домену, id..."
          className="w-72"
        />
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <Badge tone="info">{freshCount} новых</Badge>
          <Badge tone="neutral">{knownCount} в пуле</Badge>
          {selectedIds.size > 0 && (
            <Badge tone="success">выбрано: {selectedIds.size}</Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable
          rows={5}
          columns={[
            { span: 1, lines: 1 },
            { span: 5, lines: 2 },
            { span: 4, lines: 1 },
            { span: 2, badge: true },
          ]}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<LayersIcon size={20} />}
          title="Ничего не найдено"
          description={
            search
              ? "Сбросьте поиск или измените фильтр домена"
              : "В КИ нет проектов или у сервисного юзера нет прав на listing — Keystone вернул пустой список. Используйте «Добавить проект» вручную."
          }
        />
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden max-h-[420px] overflow-y-auto">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 z-10">
            <div className="col-span-1 flex items-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={selectableIds.length === 0}
                className="w-4 h-4 rounded border-gray-300 text-ki-blue focus:ring-ki-blue/30 disabled:opacity-50"
                aria-label="Выбрать все видимые"
              />
            </div>
            <div className="col-span-5 truncate">Проект</div>
            <div className="col-span-4 truncate">Домен</div>
            <div className="col-span-2 truncate text-right">Статус</div>
          </div>

          {filtered.map((p) => (
            <ProjectRow
              key={p.ki_project_id}
              project={p}
              checked={selectedIds.has(p.ki_project_id)}
              onToggle={() => toggleOne(p.ki_project_id)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          {selectedIds.size === 0
            ? "Отметьте проекты, которые хотите завести в пул"
            : `Будет добавлено: ${selectedIds.size}`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isAdding}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isAdding}
            disabled={selectedIds.size === 0}
          >
            Добавить в пул ({selectedIds.size})
          </Button>
        </div>
      </div>
    </div>
  );
}

interface IProjectRowProps {
  project: IDiscoveredKiProject;
  checked: boolean;
  onToggle: () => void;
}

function ProjectRow({ project, checked, onToggle }: IProjectRowProps) {
  const disabled = project.already_in_pool;
  return (
    <label
      className={`grid grid-cols-12 gap-3 px-4 py-3 items-center border-b border-gray-100 last:border-b-0 transition ${
        disabled
          ? "bg-gray-50/40 text-gray-400 cursor-not-allowed"
          : "hover:bg-gray-50 cursor-pointer"
      }`}
    >
      <div className="col-span-1 flex items-center">
        <input
          type="checkbox"
          checked={checked && !disabled}
          onChange={onToggle}
          disabled={disabled}
          className="w-4 h-4 rounded border-gray-300 text-ki-blue focus:ring-ki-blue/30 disabled:opacity-50"
          aria-label={`Выбрать ${project.ki_project_name}`}
        />
      </div>
      <div className="col-span-5 min-w-0">
        <div className={`font-medium truncate ${disabled ? "" : "text-ki-dark"}`}>
          {project.ki_project_name}
        </div>
        <div className="text-xs text-gray-400 font-mono truncate">
          {project.ki_project_id}
        </div>
      </div>
      <div className="col-span-4 min-w-0 text-sm">
        <div className="truncate">{project.ki_domain_name || "—"}</div>
        {project.ki_network_id && (
          <div className="text-[11px] text-gray-400 font-mono truncate">
            net: {project.ki_network_id}
          </div>
        )}
      </div>
      <div className="col-span-2 flex justify-end">
        {project.already_in_pool ? (
          <Badge tone="neutral">в пуле</Badge>
        ) : (
          <Badge tone="success">доступен</Badge>
        )}
      </div>
    </label>
  );
}
