"use client";

import { ConfirmDeleteModal } from "@/shared/ui/ConfirmDeleteModal";
import { ClockIcon, LockIcon, TrashIcon, UnlockIcon } from "@/shared/icons/index-icons";
import { useModal } from "@/shared/modal/hooks/useModal";
import { useMe } from "@/shared/identity/useMe";
import { cn } from "@/shared/utils/cn";

import {
  canDestroy,
  canExtend,
  canFreeze,
  canUnfreeze,
} from "@/features/stands/constants/stands.constants";
import { ExtendModal } from "@/features/stands/components/ExtendModal";
import { FreezeModal } from "@/features/stands/components/FreezeModal";
import { useDestroyStand } from "@/features/stands/hooks/useDestroyStand";
import { useUnfreezeStand } from "@/features/stands/hooks/useUnfreezeStand";
import { IStand } from "@/features/stands/interfaces/stands.interfaces";

interface IAdminStandRowActionsProps {
  stand: IStand;
}

export function AdminStandRowActions({ stand }: IAdminStandRowActionsProps) {
  const { user } = useMe();
  const { openModal, closeModal } = useModal();
  const { mutate: unfreeze, isPending: isUnfreezing } = useUnfreezeStand();
  const { mutate: destroy, isPending: isDestroying } = useDestroyStand();

  const actorId = user?.externalId;
  const ownerLabel = stand.owner_display_name ?? stand.owner_external_id;

  const handleFreeze = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openModal(
      "Заморозить стенд",
      <FreezeModal standId={stand.id} requestedBy={actorId} onClose={closeModal} />,
    );
  };

  const handleExtend = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openModal(
      "Продлить срок жизни",
      <ExtendModal standId={stand.id} requestedBy={actorId} onClose={closeModal} />,
    );
  };

  const handleUnfreeze = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openModal(
      "Разморозить стенд?",
      <ConfirmDeleteModal
        tone="info"
        icon={<UnlockIcon size={20} />}
        triggerIcon={<UnlockIcon size={14} />}
        description={
          <>
            Стенд <strong>{ownerLabel}</strong> вернётся в состояние <strong>READY</strong> и
            продолжит выполнение лабы.
          </>
        }
        confirmLabel="Разморозить"
        pendingLabel="Размораживаем..."
        isPending={isUnfreezing}
        onConfirm={() =>
          unfreeze(
            { standId: stand.id, payload: { requested_by: actorId } },
            { onSuccess: () => closeModal() },
          )
        }
        onClose={closeModal}
      />,
    );
  };

  const handleDestroy = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openModal(
      "Удалить стенд?",
      <ConfirmDeleteModal
        description={
          <>
            Стенд студента <strong>{ownerLabel}</strong> будет уничтожен, ресурсы освобождены, а
            проект вернётся в пул.
          </>
        }
        itemLabel={stand.id}
        confirmLabel="Да, удалить"
        pendingLabel="Удаление..."
        isPending={isDestroying}
        onConfirm={() =>
          destroy(stand.id, {
            onSuccess: () => closeModal(),
          })
        }
        onClose={closeModal}
      />,
    );
  };

  return (
    <div
      className="flex items-center justify-end gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      {canExtend(stand.status) && (
        <IconAction
          title="Продлить TTL"
          tone="blue"
          onClick={handleExtend}
          icon={<ClockIcon size={14} />}
        />
      )}

      {canFreeze(stand.status) && (
        <IconAction
          title="Заморозить"
          tone="cyan"
          onClick={handleFreeze}
          icon={<LockIcon size={14} />}
        />
      )}

      {canUnfreeze(stand.status) && (
        <IconAction
          title="Разморозить"
          tone="blue"
          onClick={handleUnfreeze}
          icon={<UnlockIcon size={14} />}
        />
      )}

      {canDestroy(stand.status) && (
        <IconAction
          title="Удалить"
          tone="red"
          onClick={handleDestroy}
          icon={<TrashIcon size={14} />}
        />
      )}
    </div>
  );
}

function IconAction({
  title,
  tone,
  onClick,
  icon,
}: {
  title: string;
  tone: "cyan" | "red" | "blue";
  onClick: (event: React.MouseEvent) => void;
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "red"
      ? "bg-red-50 text-red-600 hover:bg-red-100"
      : tone === "cyan"
        ? "bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
        : "bg-ki-blue-light text-ki-blue-strong hover:bg-blue-100";
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "h-8 w-8 inline-flex items-center justify-center rounded-lg transition active:scale-[0.96]",
        toneClass,
      )}
    >
      {icon}
    </button>
  );
}
