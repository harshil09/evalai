"use client";

import { Search } from "lucide-react";
import { GLASS_CARD, GLASS_CARD_INNER } from "@/components/dashboard/dashboard-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DocumentSearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
};

export default function DocumentSearch({ query, onQueryChange }: DocumentSearchProps) {
  return (
    <section className={GLASS_CARD}>
      <div className={GLASS_CARD_INNER}>
        <Label htmlFor="document-search" className="text-sm font-semibold">
          Search documents
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Find a transcript by file name or upload date (e.g. 6/24/2026 or 2026-06-24).
          Results appear in the history table below.
        </p>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="document-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Document name or date..."
            className="h-10 pl-9"
          />
        </div>
      </div>
    </section>
  );
}
