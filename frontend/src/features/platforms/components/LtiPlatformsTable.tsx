"use client";

import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorBox } from "@/shared/ui/ErrorBox";
import { ChevronRightIcon, LinkIcon, PlusIcon } from "@/shared/icons/index-icons";
import { SkeletonTable } from "@/shared/ui/Skeleton";
import { cn } from "@/shared/utils/cn";
import { useModal } from "@/shared/modal/hooks/useModal";

import { AddPlatformModal } from "@/features/platforms/components/AddPlatformModal";
import { PlatformDetailsModal } from "@/features/platforms/components/PlatformDetailsModal";
import { usePlatforms } from "@/features/platforms/hooks/usePlatforms";
import { ILtiPlatform } from "@/features/platforms/interfaces/platforms.interfaces";

export function LtiPlatformsTable() {
  const { data, isLoading, error } = usePlatforms();
  const { openModal, closeModal } = useModal();

  const openAdd = () =>
    openModal(
      "Зарегистрировать LTI платформу",
      <AddPlatformModal onClose={closeModal} />,
      { size: "lg" },
    );

  const openDetails = (platform: ILtiPlatform) =>
    openModal("Детали платформы", <PlatformDetailsModal platform={platform} />, {
      size: "lg",
    });

  if (error) return <ErrorBox error={error} title="Не удалось получить список платформ" />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button iconLeft={<PlusIcon size={16} />} onClick={openAdd}>
          Зарегистрировать платформу
        </Button>
      </div>

      {isLoading ? (
        <SkeletonTable
          rows={3}
          columns={[
            { span: 4, lines: 2 },
            { span: 3, lines: 1 },
            { span: 2, lines: 1 },
            { span: 2, badge: true },
            { span: 1, lines: 1, align: "right" },
          ]}
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<LinkIcon size={20} />}
          title="Платформ ещё нет"
          description="Зарегистрируйте Moodle инстанцию, из которой студенты будут запускать стенды"
          action={
            <Button size="sm" iconLeft={<PlusIcon size={14} />} onClick={openAdd}>
              Добавить первую
            </Button>
          }
        />
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">

          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-4 truncate">Платформа</div>
            <div className="col-span-3 truncate">Client ID</div>
            <div className="col-span-2 truncate">Deployments</div>
            <div className="col-span-2 truncate">Статус</div>
            <div className="col-span-1 text-right truncate">Детали</div>
          </div>

          {data.map((platform, idx) => (
            <div
              key={platform.id}
              onClick={() => openDetails(platform)}
              className={cn(
                "grid grid-cols-12 gap-4 px-4 py-3.5 items-center hover:bg-gray-50 transition cursor-pointer group",
                idx === data.length - 1 ? "" : "border-b border-gray-100",
              )}
            >
              <div className="col-span-4 min-w-0">
                <div className="font-medium text-ki-dark truncate">{platform.name}</div>
                <div className="text-xs text-gray-400 font-mono truncate">{platform.issuer}</div>
              </div>

              <div className="col-span-3 min-w-0">
                <div className="font-mono text-xs text-gray-700 truncate">
                  {platform.client_id}
                </div>
              </div>

              <div className="col-span-2 min-w-0">
                {platform.deployment_ids.length === 0 ? (
                  <span className="text-xs text-gray-400">—</span>
                ) : (
                  <div className="font-mono text-xs text-gray-700 truncate">
                    <span className="text-gray-400">{platform.deployment_ids.length}× </span>
                    {platform.deployment_ids.join(", ")}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <Badge tone={platform.enabled ? "success" : "neutral"}>
                  {platform.enabled ? "Активна" : "Отключена"}
                </Badge>
              </div>

              <div className="col-span-1 flex items-center justify-end">
                <ChevronRightIcon
                  size={16}
                  className="text-gray-300 group-hover:text-ki-blue group-hover:translate-x-0.5 transition"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
