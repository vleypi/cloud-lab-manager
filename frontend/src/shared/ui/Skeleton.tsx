import { CSSProperties } from "react";

import { cn } from "@/shared/utils/cn";

interface ISkeletonProps {
  className?: string;
}

export function Skeleton({ className }: ISkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-gray-200/70 animate-pulse-soft",
        className,
      )}
    />
  );
}

export function SkeletonLine({
  width = "w-full",
  height = "h-3",
  className,
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return <Skeleton className={cn(width, height, "rounded", className)} />;
}

export function SkeletonCircle({
  size = "w-10 h-10",
  className,
}: {
  size?: string;
  className?: string;
}) {
  return <Skeleton className={cn(size, "rounded-full", className)} />;
}

export function SkeletonSquare({
  size = "w-12 h-12",
  rounded = "rounded-xl",
  className,
}: {
  size?: string;
  rounded?: string;
  className?: string;
}) {
  return <Skeleton className={cn(size, rounded, className)} />;
}

export function SkeletonStatCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4">
      <SkeletonSquare />
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonLine width="w-16" height="h-5" />
        <SkeletonLine width="w-24" height="h-3" />
      </div>
    </div>
  );
}

export interface ISkeletonColumn {
  span: number;
  lines?: 1 | 2;
  align?: "left" | "right";
  badge?: boolean;
}

function colStyle(span: number): CSSProperties {
  return { gridColumn: `span ${span} / span ${span}` };
}

export function SkeletonTableRow({
  columns,
  isLast = false,
}: {
  columns: ReadonlyArray<ISkeletonColumn>;
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-12 gap-4 px-4 py-3.5 items-center",
        isLast ? "" : "border-b border-gray-100",
      )}
    >
      {columns.map((column, idx) => (
        <div
          key={idx}
          style={colStyle(column.span)}
          className={cn(
            "flex flex-col min-w-0",
            column.align === "right" ? "items-end" : "items-start",
            (column.lines ?? 1) === 2 ? "gap-1.5" : "",
          )}
        >
          {column.badge ? (
            <SkeletonLine width="w-20" height="h-5" className="rounded-md" />
          ) : (
            <>
              <SkeletonLine
                width={column.lines === 2 ? "w-3/4" : "w-4/5"}
                height="h-3"
              />
              {column.lines === 2 && <SkeletonLine width="w-1/2" height="h-2.5" />}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({
  columns,
  rows = 5,
}: {
  columns: ReadonlyArray<ISkeletonColumn>;
  rows?: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">

      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100">
        {columns.map((column, idx) => (
          <div key={idx} style={colStyle(column.span)}>
            <SkeletonLine width="w-16" height="h-2.5" className="bg-gray-300/60" />
          </div>
        ))}
      </div>

      {Array.from({ length: rows }).map((_, idx) => (
        <SkeletonTableRow key={idx} columns={columns} isLast={idx === rows - 1} />
      ))}
    </div>
  );
}
