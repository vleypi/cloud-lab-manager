"use client";

import { useEffect, useRef, useState } from "react";

import { LogoBadge } from "@/shared/icons/LogoBadge";
import { LogoutIcon } from "@/shared/icons/index-icons";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useMe } from "@/shared/identity/useMe";
import { useSidebar } from "@/shared/layout/SidebarProvider";
import { useSignOut } from "@/features/auth/hooks/useSignOut";

export function AppBar() {
  const { toggle } = useSidebar();

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-30 flex-shrink-0">
      <div className="flex items-center justify-between pl-4 pr-6 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={toggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label="Переключить меню"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <LogoBadge height={32} />
        </div>

        <div className="flex items-center gap-3">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function UserMenu() {
  const { user } = useMe();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) {
    return <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />;
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="hover:opacity-80 transition cursor-pointer"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserAvatar user={user} size="md" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-100 bg-white shadow-lg p-3 z-50"
        >
          <div className="flex items-center gap-3 mb-2 px-2 py-1">
            <UserAvatar user={user} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-ki-dark truncate">{user.displayName}</div>
            </div>
          </div>

          <div className="h-px bg-gray-100 my-2" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut.mutate();
            }}
            disabled={signOut.isPending}
            className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition disabled:opacity-60"
          >
            <LogoutIcon size={14} />
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}
