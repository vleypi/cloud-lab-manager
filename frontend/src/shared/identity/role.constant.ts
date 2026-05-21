import { IUser } from "@/shared/identity/user.types";

export const USER_BADGE_LABEL = {
  SUPER_ADMIN: "Супер-админ",
  REGULAR: "Пользователь",
} as const;

export const USER_BADGE_CLASSES = {
  SUPER_ADMIN: "bg-red-50 text-red-600",
  REGULAR: "bg-blue-50 text-blue-600",
} as const;

export function canAccessAdminPanel(user: IUser | null | undefined): boolean {
  return Boolean(user?.isSuperAdmin);
}
