"use client";

import { GLASS_CARD, GLASS_CARD_INNER } from "@/components/dashboard/dashboard-utils";

type DocumentSearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
};

export default function DocumentSearch({ query, onQueryChange }: DocumentSearchProps) {
  return (
    <section className={GLASS_CARD}>
      <div className="dashboard-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className={GLASS_CARD_INNER}>
        <label htmlFor="document-search" className="text-sm font-semibold text-white">
          Search documents
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Find a transcript by file name or upload date (e.g. 6/24/2026 or 2026-06-24).
          Results appear in the history table below.
        </p>

        <div className="relative mt-4">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            id="document-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Document name or date..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/25"
          />
        </div>
      </div>
    </section>
  );
}
