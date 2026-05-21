"use client";

import { cn } from "@/shared/utils/cn";

interface IPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

type TItem = number | "dots";

function buildItems(page: number, totalPages: number): TItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: TItem[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) items.push("dots");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < totalPages - 1) items.push("dots");
  items.push(totalPages);
  return items;
}

export function Pagination({ page, totalPages, onPageChange, className }: IPaginationProps) {
  if (totalPages <= 1) return null;
  const items = buildItems(page, totalPages);

  return (
    <nav
      className={cn("flex items-center justify-center gap-1 mt-6", className)}
      aria-label="Пагинация"
    >
      <PageButton
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        ariaLabel="Предыдущая страница"
      >
        ‹
      </PageButton>

      {items.map((item, index) =>
        item === "dots" ? (
          <span key={`dots-${index}`} className="px-2 text-gray-300 text-sm">…</span>
        ) : (
          <PageButton
            key={item}
            active={item === page}
            onClick={() => onPageChange(item)}
            ariaLabel={`Страница ${item}`}
          >
            {item}
          </PageButton>
        ),
      )}

      <PageButton
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        ariaLabel="Следующая страница"
      >
        ›
      </PageButton>
    </nav>
  );
}

interface IPageButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  ariaLabel: string;
}

function PageButton({ children, onClick, active, disabled, ariaLabel }: IPageButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={cn(
        "min-w-8 h-8 px-2.5 rounded-lg text-sm transition",
        active
          ? "bg-ki-dark text-white font-semibold"
          : "bg-white text-gray-600 hover:bg-gray-100 border border-transparent",
        disabled && "opacity-40 cursor-not-allowed hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}
