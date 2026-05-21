"use client";

import { ReactNode, useCallback, useState } from "react";

import { useEscapeKey } from "@/shared/modal/hooks/useEscapeKey";
import {
  IOpenModalOptions,
  IModalState,
  TModalSize,
} from "@/shared/modal/modal.types";

const VISIBLE_DELAY_MS = 10;
const UNMOUNT_DELAY_MS = 220;

interface IUseModalStateReturn extends IModalState {
  openModal: (
    title: string | ReactNode,
    content: ReactNode,
    options?: IOpenModalOptions,
  ) => void;
  closeModal: () => void;
}

export function useModalState(): IUseModalStateReturn {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState<string | ReactNode>("");
  const [content, setContent] = useState<ReactNode>(null);
  const [size, setSize] = useState<TModalSize>("md");
  const [noPadding, setNoPadding] = useState(false);
  const [scrollInner, setScrollInner] = useState(false);
  const [hideHeader, setHideHeader] = useState(false);

  const openModal = useCallback(
    (
      newTitle: string | ReactNode,
      newContent: ReactNode,
      options: IOpenModalOptions = {},
    ) => {
      setTitle(newTitle);
      setContent(newContent);
      setSize(options.size ?? "md");
      setNoPadding(options.noPadding ?? false);
      setScrollInner(options.scrollInner ?? false);
      setHideHeader(options.hideHeader ?? false);
      setMounted(true);

      setTimeout(() => setVisible(true), VISIBLE_DELAY_MS);
    },
    [],
  );

  const closeModal = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setMounted(false);
      setContent(null);
    }, UNMOUNT_DELAY_MS);
  }, []);

  useEscapeKey(closeModal, visible);

  return {
    mounted,
    visible,
    title,
    content,
    size,
    noPadding,
    scrollInner,
    hideHeader,
    openModal,
    closeModal,
  };
}
