"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useState } from "react";

import { cn } from "@/shared/utils/cn";

interface ISearchBoxProps {
  value: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBox({
  value,
  onSearch,
  placeholder = "Поиск...",
  className,
}: ISearchBoxProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const submit = () => onSearch(draft.trim());

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") submit();
    if (event.key === "Escape") {
      setDraft("");
      onSearch("");
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  };

  return (
    <div className={cn("relative", className ?? "w-64")}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </span>
      <input
        type="search"
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={submit}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-10 text-sm border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-ki-blue/30 focus:border-ki-blue transition"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            onSearch("");
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ki-dark transition"
          aria-label="Очистить"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
