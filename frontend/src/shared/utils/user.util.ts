import { IUser } from "@/shared/identity/user.types";

export function getUserInitials(user: Pick<IUser, "displayName" | "externalId">): string {
  const source = user.displayName?.trim() || user.externalId;
  if (!source) return "?";

  const parts = source
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .slice(0, 2);

  if (parts.length === 0) return source[0]?.toUpperCase() ?? "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
