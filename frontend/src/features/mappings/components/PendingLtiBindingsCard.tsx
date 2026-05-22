"use client";

import { Button } from "@/shared/ui/Button";
import { LinkIcon, PlayIcon, TrashIcon } from "@/shared/icons/index-icons";
import { useModal } from "@/shared/modal/hooks/useModal";
import { formatRelative } from "@/shared/utils/format.util";
import { cn } from "@/shared/utils/cn";

import {
  useDismissPendingBinding,
  usePendingLtiBindings,
} from "@/features/mappings/hooks/usePendingLtiBindings";
import { IPendingLtiBinding } from "@/features/mappings/interfaces/mappings.interfaces";
import { UpsertMappingModal } from "@/features/mappings/components/UpsertMappingModal";

export function PendingLtiBindingsCard() {
  const { data, isLoading } = usePendingLtiBindings();
  const { mutate: dismiss, isPending: isDismissing, variables: dismissingId } =
    useDismissPendingBinding();
  const { openModal, closeModal } = useModal();

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  const openBindFor = (binding: IPendingLtiBinding) =>
    openModal(
      "Привязать активность из Moodle",
      <UpsertMappingModal
        onClose={closeModal}
        lockedLtiIds={{
          lti_context_id: binding.lti_context_id,
          resource_link_id: binding.resource_link_id,
          context_title: binding.context_title,
          resource_link_title: binding.resource_link_title,
        }}
      />,
      { size: "xl", scrollInner: true, noPadding: true },
    );

  return (
    <div className="mb-6 rounded-2xl border border-amber-200/70 bg-amber-50/60 overflow-hidden">
      <div className="px-5 py-4 flex items-start gap-3 border-b border-amber-100">
        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
          <LinkIcon size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ki-dark">
            Из Moodle пришли запросы без маппинга
          </h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Студенты пытались запустить эти активности, но в нашем сервисе ещё нет
            соответствующей конфигурации. Привяжите одним кликом — id из Moodle подставятся
            автоматически, копипаст не нужен.
          </p>
        </div>
      </div>

      <ul className="divide-y divide-amber-100/70">
        {data.map((binding) => (
          <li
            key={binding.id}
            className="px-5 py-3 flex items-center gap-4 hover:bg-amber-50 transition"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ki-dark truncate">
                {binding.resource_link_title ?? binding.context_title ?? "Без названия"}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-gray-500">
                {binding.context_title && (
                  <span className="truncate max-w-[180px]" title={binding.context_title}>
                    {binding.context_title}
                  </span>
                )}
                <span className="font-mono">
                  context: {binding.lti_context_id}
                </span>
                {binding.resource_link_id && (
                  <span className="font-mono">link: {binding.resource_link_id}</span>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 flex flex-col items-end gap-0.5 text-[11px] text-gray-500">
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium",
                  binding.seen_count > 1
                    ? "bg-amber-200/60 text-amber-900"
                    : "bg-amber-100/70 text-amber-800",
                )}
                title={`Пытались зайти ${binding.seen_count} раз(а)`}
              >
                {binding.seen_count > 1
                  ? `${binding.seen_count} студент(ов) ждут`
                  : "1 запрос"}
              </span>
              <span title={new Date(binding.last_seen_at).toLocaleString()}>
                {formatRelative(binding.last_seen_at)}
              </span>
            </div>

            <div className="flex-shrink-0 flex items-center gap-2">
              <Button
                size="sm"
                iconLeft={<PlayIcon size={14} />}
                onClick={() => openBindFor(binding)}
              >
                Привязать
              </Button>
              <button
                type="button"
                onClick={() => dismiss(binding.id)}
                disabled={isDismissing && dismissingId === binding.id}
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition disabled:opacity-50"
                aria-label="Отмахнуться"
                title="Удалить из списка ожидающих (не привязывать)"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
