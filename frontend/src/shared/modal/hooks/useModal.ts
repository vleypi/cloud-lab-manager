"use client";

import { useContext } from "react";

import { ModalContext } from "@/shared/modal/ModalProvider";
import { IModalContextValue } from "@/shared/modal/modal.types";

export function useModal(): IModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used within ModalProvider");
  }
  return ctx;
}
