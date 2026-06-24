"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  computeKpiStats,
  formatTokenCount,
  GLASS_CARD,
  type DashboardKpiStats,
  type EvaluationRow,
} from "@/components/dashboard/dashboard-utils";

type DashboardKpiCardsProps = {
  refreshKey: number;
};

type KpiTile = {
  label: string;
  value: string;
  hint?: string;
  accent?: "violet" | "cyan" | "emerald" | "indigo";
};

const ACCENT_RING: Record<NonNullable<KpiTile["accent"]>, string> = {
  violet: "from-violet-500/20 to-transparent",
  cyan: "from-cyan-500/20 to-transparent",
  emerald: "from-emerald-500/20 to-transparent",
  indigo: "from-indigo-500/20 to-transparent",
};

function KpiCard({ label, value, hint, accent = "violet" }: KpiTile) {
  return (
    <div
      className={`${GLASS_CARD} dashboard-kpi-tile group overflow-hidden p-4 sm:p-5`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${ACCENT_RING[accent]} opacity-80`}
        aria-hidden="true"
      />
      <div className="dashboard-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-white transition group-hover:scale-[1.02]">
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      </div>
    </div>
  );
}

function buildTiles(stats: DashboardKpiStats): KpiTile[] {
  return [
    {
      label: "Reports completed",
      value: String(stats.reportsCompleted),
      hint: "All time",
      accent: "indigo",
    },
    {
      label: "Avg efficiency",
      value: stats.avgEfficiency != null ? `${stats.avgEfficiency}%` : "—",
      hint: "Prompt efficiency",
      accent: "violet",
    },
    {
      label: "User efficiency",
      value:
        stats.avgUserEfficiency != null ? `${stats.avgUserEfficiency}%` : "—",
      hint: "AI tool usage",
      accent: "cyan",
    },
    {
      label: "Total tokens",
      value: stats.totalTokens > 0 ? formatTokenCount(stats.totalTokens) : "—",
      hint: "Analyzed",
      accent: "emerald",
    },
  ];
}

export default function DashboardKpiCards({ refreshKey }: DashboardKpiCardsProps) {
  const [stats, setStats] = useState<DashboardKpiStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("evaluations")
        .select("id, title, original_filename, status, created_at, evaluation_summary")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setStats(computeKpiStats((data ?? []) as EvaluationRow[]));
    } catch {
      setStats(computeKpiStats([]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className={`${GLASS_CARD} h-24 animate-pulse bg-white/[0.04]`}
          />
        ))}
      </div>
    );
  }

  const tiles = buildTiles(stats ?? computeKpiStats([]));

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <KpiCard key={tile.label} {...tile} />
      ))}
    </div>
  );
}
