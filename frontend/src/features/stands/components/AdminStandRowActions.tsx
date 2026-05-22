"use client";

import { ActionMenu, IActionMenuItem } from "@/shared/ui/ActionMenu";
import { ConfirmDeleteModal } from "@/shared/ui/ConfirmDeleteModal";
import { ClockIcon, LockIcon, TrashIcon, UnlockIcon } from "@/shared/icons/index-icons";
import { useModal } from "@/shared/modal/hooks/useModal";
import { useMe } from "@/shared/identity/useMe";

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

  const handleFreeze = () => {
    openModal(
      "Заморозить стенд",
      <FreezeModal standId={stand.id} requestedBy={actorId} onClose={closeModal} />,
    );
  };

  const handleExtend = () => {
    openModal(
      "Продлить срок жизни",
      <ExtendModal standId={stand.id} requestedBy={actorId} onClose={closeModal} />,
    );
  };

  const handleUnfreeze = () => {
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

  const handleDestroy = () => {
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

  const items: IActionMenuItem[] = [
    {
      key: "extend",
      label: "Продлить TTL",
      icon: <ClockIcon size={14} />,
      tone: "primary",
      hidden: !canExtend(stand.status),
      onClick: handleExtend,
    },
    {
      key: "freeze",
      label: "Заморозить",
      icon: <LockIcon size={14} />,
      hidden: !canFreeze(stand.status),
      onClick: handleFreeze,
    },
    {
      key: "unfreeze",
      label: "Разморозить",
      icon: <UnlockIcon size={14} />,
      tone: "primary",
      hidden: !canUnfreeze(stand.status),
      onClick: handleUnfreeze,
    },
    {
      key: "destroy",
      label: "Удалить",
      icon: <TrashIcon size={14} />,
      tone: "danger",
      hidden: !canDestroy(stand.status),
      onClick: handleDestroy,
    },
  ];

  return (
    <div
      className="flex items-center justify-center"
      onClick={(event) => event.stopPropagation()}
    >
      <ActionMenu items={items} emptyHint="—" />
    </div>
  );
}
