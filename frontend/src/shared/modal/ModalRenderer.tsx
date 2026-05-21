"use client";

import { Modal } from "@/shared/modal/Modal";
import { IModalState } from "@/shared/modal/modal.types";

interface IModalRendererProps extends IModalState {
  onClose: () => void;
}

export function ModalRenderer({
  mounted,
  visible,
  title,
  content,
  size,
  noPadding,
  scrollInner,
  hideHeader,
  onClose,
}: IModalRendererProps) {
  if (!mounted) return null;

  return (
    <Modal
      title={title}
      visible={visible}
      onClose={onClose}
      size={size}
      noPadding={noPadding}
      scrollInner={scrollInner}
      hideHeader={hideHeader}
    >
      {content}
    </Modal>
  );
}
