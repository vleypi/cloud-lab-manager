"use client";

import { cn } from "@/shared/utils/cn";

export interface IDonutSegment {
  value: number;
  color: string;
  label: string;
}

interface IDonutProps {
  segments: ReadonlyArray<IDonutSegment>;
  size?: number;
  legend?: boolean;
  centerLabel?: string;
  className?: string;
}

const RADIUS = 42;
const STROKE = 12;

export function Donut({
  segments,
  size = 140,
  legend = true,
  centerLabel,
  className,
}: IDonutProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const circumference = 2 * Math.PI * RADIUS;
  let offset = 0;

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="flex-shrink-0 -rotate-90"
      >
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#f3f4f6" strokeWidth={STROKE} />
        {segments.map((segment, i) => {
          const fraction = total > 0 ? segment.value / total : 0;
          const dash = circumference * fraction;
          const gap = circumference - dash;
          const segmentOffset = offset;
          offset += dash;
          return (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-segmentOffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          );
        })}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dy="0.35em"
          className="rotate-90 origin-center"
          fill="#081a12"
          fontSize="20"
          fontWeight="700"
        >
          {centerLabel ?? total}
        </text>
      </svg>

      {legend && (
        <div className="flex flex-col gap-2 min-w-0">
          {segments.map((segment, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-xs text-gray-500 truncate">{segment.label}</span>
              <span className="text-xs font-semibold text-ki-dark ml-auto">
                {segment.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
