import { toast as sonnerToast } from "sonner";

export const toast = {
  success: (message: string, description?: string) =>
    sonnerToast.success(message, { description, icon: null }),
  error: (message: string, description?: string) =>
    sonnerToast.error(message, { description, icon: null }),
  info: (message: string, description?: string) =>
    sonnerToast.info(message, { description, icon: null }),
  warn: (message: string, description?: string) =>
    sonnerToast.warning(message, { description, icon: null }),
  promise: <T,>(
    promise: Promise<T>,
    config: { loading: string; success: string; error: string },
  ) =>
    sonnerToast.promise(promise, {
      ...config,
      icon: null,
    }),
};
