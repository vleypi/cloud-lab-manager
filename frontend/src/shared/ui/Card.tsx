import { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

interface ICardProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

interface ICardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function Card({ children, className, noPadding = false }: ICardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-gray-100 rounded-2xl",
        !noPadding && "p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions, className }: ICardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-ki-dark truncate">{title}</h3>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
