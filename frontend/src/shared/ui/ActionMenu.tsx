"use client";

import {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { MoreVerticalIcon } from "@/shared/icons/index-icons";
import { cn } from "@/shared/utils/cn";

export interface IActionMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  tone?: "default" | "primary" | "danger";
  disabled?: boolean;
  hidden?: boolean;
}

interface IActionMenuProps {
  items: ReadonlyArray<IActionMenuItem>;
  ariaLabel?: string;
  align?: "end" | "start";
  className?: string;
  disabled?: boolean;
  emptyHint?: string;
}

const MENU_WIDTH = 200;
const MENU_GAP = 6;
const VIEWPORT_PADDING = 8;

export function ActionMenu({
  items,
  ariaLabel = "Действия",
  align = "end",
  className,
  disabled,
  emptyHint,
}: IActionMenuProps) {
  const visibleItems = items.filter((item) => !item.hidden);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? visibleItems.length * 40 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < menuHeight + MENU_GAP + VIEWPORT_PADDING;
    const top = placeAbove ? rect.top - menuHeight - MENU_GAP : rect.bottom + MENU_GAP;
    const rawLeft = align === "end" ? rect.right - MENU_WIDTH : rect.left;
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, rawLeft),
      window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING,
    );
    setPosition({ top, left });
  }, [align, visibleItems.length]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    const handleViewportChange = () => updatePosition();

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, updatePosition]);

  const handleTriggerClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const handleItemClick = (event: React.MouseEvent, item: IActionMenuItem) => {
    event.preventDefault();
    event.stopPropagation();
    if (item.disabled) return;
    setIsOpen(false);
    item.onClick();
  };

  if (visibleItems.length === 0) {
    return emptyHint ? (
      <span className="text-[11px] text-gray-300">{emptyHint}</span>
    ) : null;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={disabled}
        className={cn(
          "h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-400",
          "transition hover:bg-gray-100 hover:text-gray-700 active:scale-[0.96]",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
          isOpen ? "bg-gray-100 text-gray-700" : "",
          className,
        )}
      >
        <MoreVerticalIcon size={16} />
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="fixed z-[1000] py-1 rounded-xl border border-gray-100 bg-white shadow-lg shadow-gray-900/10 animate-menu-pop"
            onClick={(event) => event.stopPropagation()}
          >
            {visibleItems.map((item) => {
              const toneClass =
                item.tone === "danger"
                  ? "text-red-600 hover:bg-red-50"
                  : item.tone === "primary"
                    ? "text-ki-blue-strong hover:bg-ki-blue-light"
                    : "text-gray-700 hover:bg-gray-50";
              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={(event) => handleItemClick(event, item)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition",
                    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
                    toneClass,
                  )}
                >
                  {item.icon && (
                    <span className="flex-shrink-0 inline-flex items-center justify-center">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
