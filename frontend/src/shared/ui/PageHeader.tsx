import { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

interface IPageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: IPageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ki-dark truncate">{title}</h1>
        {description && (
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
