export type EvaluationSummary = {
  total_tokens?: number;
  user_evaluation?: {
    overall_score?: number;
  };
  prompting_recommendations?: {
    prompt_efficiency?: {
      efficiency_score?: number;
      grade?: string;
    };
  };
};

export type EvaluationRow = {
  id: string;
  title: string | null;
  original_filename: string | null;
  status: string;
  created_at: string;
  evaluation_summary: Record<string, unknown> | null;
};

export function getEfficiencyScore(
  summary: Record<string, unknown> | null,
): number | null {
  const data = summary as EvaluationSummary | null;
  const score = data?.prompting_recommendations?.prompt_efficiency?.efficiency_score;
  return typeof score === "number" ? score : null;
}

export function getAiScore(summary: Record<string, unknown> | null): number | null {
  const data = summary as EvaluationSummary | null;
  const score = data?.user_evaluation?.overall_score;
  return typeof score === "number" ? score : null;
}

export function getTotalTokens(summary: Record<string, unknown> | null): number | null {
  const data = summary as EvaluationSummary | null;
  const tokens = data?.total_tokens;
  return typeof tokens === "number" ? tokens : null;
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toLocaleString();
}

export type DashboardKpiStats = {
  reportsCompleted: number;
  avgEfficiency: number | null;
  avgUserEfficiency: number | null;
  totalTokens: number;
};

export function computeKpiStats(rows: EvaluationRow[]): DashboardKpiStats {
  const efficiencyScores = rows
    .map((row) => getEfficiencyScore(row.evaluation_summary))
    .filter((score): score is number => score != null);

  const userEfficiencyScores = rows
    .map((row) => getAiScore(row.evaluation_summary))
    .filter((score): score is number => score != null);

  const totalTokens = rows.reduce((sum, row) => {
    return sum + (getTotalTokens(row.evaluation_summary) ?? 0);
  }, 0);

  const avg = (values: number[]) =>
    values.length > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : null;

  return {
    reportsCompleted: rows.length,
    avgEfficiency: avg(efficiencyScores),
    avgUserEfficiency: avg(userEfficiencyScores),
    totalTokens,
  };
}

export function getDisplayName(evaluation: EvaluationRow): string {
  return evaluation.title || evaluation.original_filename || "Untitled";
}

function matchesEvaluationDate(createdAt: string, query: string): boolean {
  const normalized = query.trim();
  if (!normalized) return true;

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return false;

  const isoDate = date.toISOString().slice(0, 10);
  const localeDate = date.toLocaleDateString();
  const localeDateUs = date.toLocaleDateString("en-US");

  return (
    isoDate.includes(normalized) ||
    localeDate.toLowerCase().includes(normalized.toLowerCase()) ||
    localeDateUs.toLowerCase().includes(normalized.toLowerCase())
  );
}

export function matchesEvaluationSearch(
  evaluation: Pick<EvaluationRow, "title" | "original_filename" | "created_at">,
  query: string,
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const name = getDisplayName(evaluation as EvaluationRow).toLowerCase();
  return name.includes(trimmed) || matchesEvaluationDate(evaluation.created_at, query);
}

export function getInitials(
  firstName: string | null,
  lastName: string | null,
  email: string,
): string {
  const first = firstName?.trim().charAt(0) ?? "";
  const last = lastName?.trim().charAt(0) ?? "";
  if (first || last) {
    return `${first}${last}`.toUpperCase();
  }
  return email.charAt(0).toUpperCase();
}

export const GLASS_CARD =
  "rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md";

export const GLASS_CARD_INNER = "p-6 sm:p-7";
