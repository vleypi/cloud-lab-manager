"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/shared/utils/cn";
import { INavItem } from "@/shared/layout/layout.interfaces";
import { useSidebar } from "@/shared/layout/SidebarProvider";

interface ISidebarNavProps {
  items: ReadonlyArray<INavItem>;
}

export function SidebarNav({ items }: ISidebarNavProps) {
  const pathname = usePathname();
  const { isMobile, closeMobile } = useSidebar();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive = !item.external && (
          item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
        );

        const className = cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap",
          isActive
            ? "bg-ki-blue-light text-ki-blue"
            : "text-gray-700 hover:bg-gray-100 transition",
        );

        const content = (
          <>
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="truncate min-w-0">{item.label}</span>
            {item.badge !== undefined && (
              <span className="ml-auto text-[11px] bg-white px-1.5 py-0.5 rounded-md text-gray-500">
                {item.badge}
              </span>
            )}
          </>
        );

        if (item.external) {
          return (
            <a
              key={item.id}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              title={item.label}
              className={className}
              onClick={isMobile ? closeMobile : undefined}
            >
              {content}
            </a>
          );
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={isMobile ? closeMobile : undefined}
            title={item.label}
            className={className}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
