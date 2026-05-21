import { cn } from "@/shared/utils/cn";
import { IUser } from "@/shared/identity/user.types";
import { getUserInitials } from "@/shared/utils/user.util";

type TAvatarSize = "xs" | "sm" | "md" | "lg";

interface IUserAvatarProps {
  user: Pick<IUser, "displayName" | "externalId">;
  size?: TAvatarSize;
  className?: string;
}

const SIZE_CLASS: Record<TAvatarSize, string> = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
};

export function UserAvatar({ user, size = "md", className }: IUserAvatarProps) {
  const initials = getUserInitials(user);
  const gradient = pickGradient(user.externalId);

  return (
    <div
      className={cn(
        "rounded-xl flex items-center justify-center text-white font-semibold flex-shrink-0",
        SIZE_CLASS[size],
        gradient,
        className,
      )}
    >
      {initials}
    </div>
  );
}

const GRADIENTS = [
  "bg-gradient-to-br from-violet-400 to-pink-400",
  "bg-gradient-to-br from-blue-400 to-cyan-400",
  "bg-gradient-to-br from-emerald-400 to-teal-400",
  "bg-gradient-to-br from-amber-400 to-orange-400",
  "bg-gradient-to-br from-rose-400 to-red-400",
  "bg-gradient-to-br from-indigo-400 to-blue-400",
];

function pickGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}
