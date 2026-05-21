import { ReactNode } from "react";

export type TModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface IModalProps {
  title: string | ReactNode;
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: TModalSize;
  noPadding?: boolean;
  scrollInner?: boolean;
  hideHeader?: boolean;
}

export interface IModalContextValue {
  openModal: (
    title: string | ReactNode,
    content: ReactNode,
    options?: IOpenModalOptions,
  ) => void;
  closeModal: () => void;
}

export interface IOpenModalOptions {
  size?: TModalSize;
  noPadding?: boolean;
  scrollInner?: boolean;
  hideHeader?: boolean;
}

export interface IModalState {
  mounted: boolean;
  visible: boolean;
  title: string | ReactNode;
  content: ReactNode;
  size: TModalSize;
  noPadding: boolean;
  scrollInner: boolean;
  hideHeader: boolean;
}
