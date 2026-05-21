"use client";

import { createContext, ReactNode, useMemo } from "react";

import { useModalState } from "@/shared/modal/hooks/useModalState";
import { ModalRenderer } from "@/shared/modal/ModalRenderer";
import { IModalContextValue } from "@/shared/modal/modal.types";

export const ModalContext = createContext<IModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const state = useModalState();

  const value = useMemo<IModalContextValue>(
    () => ({
      openModal: state.openModal,
      closeModal: state.closeModal,
    }),
    [state.openModal, state.closeModal],
  );

  return (
    <ModalContext.Provider value={value}>
      {children}
      <ModalRenderer
        mounted={state.mounted}
        visible={state.visible}
        title={state.title}
        content={state.content}
        size={state.size}
        noPadding={state.noPadding}
        scrollInner={state.scrollInner}
        hideHeader={state.hideHeader}
        onClose={state.closeModal}
      />
    </ModalContext.Provider>
  );
}
