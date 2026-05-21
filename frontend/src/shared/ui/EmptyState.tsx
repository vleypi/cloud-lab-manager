import { ReactNode } from "react";

import { cn } from "@/shared/utils/cn";

interface IEmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: IEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60",
        className,
      )}
    >
      {icon && (
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-semibold text-ki-dark">{title}</h4>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
