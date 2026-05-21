"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/shared/ui/Button";
import { ConfirmDeleteModal } from "@/shared/ui/ConfirmDeleteModal";
import {
  AlertTriangleIcon,
  ClockIcon,
  KeyIcon,
  LockIcon,
  TrashIcon,
  UnlockIcon,
} from "@/shared/icons/index-icons";
import { useModal } from "@/shared/modal/hooks/useModal";
import { useMe } from "@/shared/identity/useMe";
import { ROUTES } from "@/shared/config/routes.constant";

import {
  canDestroy,
  canExtend,
  canFreeze,
  canUnfreeze,
} from "@/features/stands/constants/stands.constants";
import { CredentialsModal } from "@/features/stands/components/CredentialsModal";
import { ExtendModal } from "@/features/stands/components/ExtendModal";
import { FreezeModal } from "@/features/stands/components/FreezeModal";
import { ReportIncidentModal } from "@/features/stands/components/ReportIncidentModal";
import { useDestroyStand } from "@/features/stands/hooks/useDestroyStand";
import { useUnfreezeStand } from "@/features/stands/hooks/useUnfreezeStand";
import { IStand } from "@/features/stands/interfaces/stands.interfaces";

interface IStandActionsProps {
  stand: IStand;

  mode?: "student" | "admin";
}

export function StandActions({ stand, mode = "student" }: IStandActionsProps) {
  const router = useRouter();
  const { user } = useMe();
  const { openModal, closeModal } = useModal();
  const { mutate: destroy, isPending: isDestroying } = useDestroyStand();
  const { mutate: unfreeze, isPending: isUnfreezing } = useUnfreezeStand();

  const actorId = user?.externalId;

  const openCredentials = () =>
    openModal(
      "SSH-доступ к стенду",
      <CredentialsModal stand={stand} onClose={closeModal} />,
      { size: "lg" },
    );

  const openReportIncident = () =>
    openModal(
      "Сообщить о проблеме",
      <ReportIncidentModal
        standId={stand.id}
        reportedBy={stand.owner_external_id}
        onClose={closeModal}
      />,
    );

  if (mode === "student") {
    return (
      <div className="space-y-2">
        {stand.status === "ready" && (
          <Button
            onClick={openCredentials}
            variant="secondary"
            iconLeft={<KeyIcon size={16} />}
            fullWidth
          >
            Получить SSH-ключ
          </Button>
        )}

        {stand.status === "ready" && (
          <Button
            onClick={openReportIncident}
            variant="outline"
            iconLeft={<AlertTriangleIcon size={16} />}
            fullWidth
          >
            Сообщить о проблеме
          </Button>
        )}

        {stand.status === "frozen" && stand.incident_reported && (
          <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
            Преподаватель уведомлён о проблеме. Стенд сохранён для разбора, удаление по таймеру
            приостановлено. Ожидайте ответа.
          </div>
        )}
      </div>
    );
  }

  const openExtend = () =>
    openModal(
      "Продлить срок жизни",
      <ExtendModal standId={stand.id} requestedBy={actorId} onClose={closeModal} />,
    );

  const openFreeze = () =>
    openModal(
      "Заморозить стенд",
      <FreezeModal standId={stand.id} requestedBy={actorId} onClose={closeModal} />,
    );

  const openUnfreeze = () =>
    openModal(
      "Разморозить стенд?",
      <ConfirmDeleteModal
        tone="info"
        icon={<UnlockIcon size={20} />}
        triggerIcon={<UnlockIcon size={14} />}
        description={
          <>
            Стенд вернётся в состояние <strong>READY</strong> и продолжит выполнение лабораторной.
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

  const openDestroy = () =>
    openModal(
      "Удалить стенд?",
      <ConfirmDeleteModal
        description={
          <>
            Стенд будет уничтожен, ресурсы освобождены, а проект вернётся в пул КИ.
          </>
        }
        itemLabel={stand.id}
        confirmLabel="Да, удалить"
        pendingLabel="Удаление..."
        isPending={isDestroying}
        onConfirm={() =>
          destroy(stand.id, {
            onSuccess: () => {
              closeModal();
              router.push(ROUTES.ADMIN.STANDS);
            },
          })
        }
        onClose={closeModal}
      />,
    );

  return (
    <div className="space-y-2">
      {canExtend(stand.status) && (
        <Button
          onClick={openExtend}
          variant="outline"
          iconLeft={<ClockIcon size={16} />}
          fullWidth
        >
          Продлить TTL
        </Button>
      )}

      {canFreeze(stand.status) && (
        <Button
          onClick={openFreeze}
          variant="outline"
          iconLeft={<LockIcon size={16} />}
          fullWidth
        >
          Заморозить
        </Button>
      )}

      {canUnfreeze(stand.status) && (
        <Button
          onClick={openUnfreeze}
          variant="outline"
          iconLeft={<UnlockIcon size={16} />}
          fullWidth
        >
          Разморозить и продолжить
        </Button>
      )}

      {canDestroy(stand.status) && (
        <Button
          onClick={openDestroy}
          variant="danger"
          iconLeft={<TrashIcon size={16} />}
          fullWidth
        >
          Удалить стенд
        </Button>
      )}
    </div>
  );
}
