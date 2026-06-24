"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export type Evaluation = {
  id: string;
  title: string | null;
  original_filename: string | null;
  content_type: string;
  transcript_path: string;
  report_path: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  evaluation_summary: Record<string, unknown> | null;
  file_size_bytes: number | null;
  created_at: string;
  completed_at: string | null;
};

type EvaluationHistoryProps = {
  refreshKey: number;
};

const STATUS_LABELS: Record<Evaluation["status"], string> = {
  pending: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_COLORS: Record<Evaluation["status"], string> = {
  pending: "bg-zinc-100 text-zinc-700",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function fileTypeLabel(contentType: string, filename: string | null): string {
  if (contentType === "text/markdown") return "Markdown";
  if (contentType === "text/plain") return "Plain text";
  if (filename?.toLowerCase().endsWith(".md")) return "Markdown";
  return "Text";
}

export default function EvaluationHistory({ refreshKey }: EvaluationHistoryProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadEvaluations = useCallback(async () => {
    try {
      const response = await fetch("/api/evaluations");
      if (!response.ok) {
        throw new Error("Failed to load evaluations");
      }
      const data = (await response.json()) as { evaluations: Evaluation[] };
      setEvaluations(data.evaluations);
      setError(null);
    } catch {
      setError("Could not load your upload history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvaluations();
  }, [loadEvaluations, refreshKey]);

  useEffect(() => {
    const hasActiveJob = evaluations.some(
      (evaluation) =>
        evaluation.status === "pending" || evaluation.status === "processing",
    );
    if (!hasActiveJob) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadEvaluations();
    }, 4000);

    return () => window.clearInterval(interval);
  }, [evaluations, loadEvaluations]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribeToEvaluations() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user) return;

      channel = supabase
        .channel(`evaluations-history-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "evaluations",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadEvaluations();
          },
        )
        .subscribe();

      if (cancelled && channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    }

    subscribeToEvaluations();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadEvaluations]);

  async function downloadFile(
    evaluationId: string,
    type: "transcript" | "report",
  ) {
    setDownloadingId(`${evaluationId}-${type}`);
    setError(null);

    try {
      const response = await fetch(`/api/evaluations/${evaluationId}/${type}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = (payload as { error?: string }).error;
        throw new Error(
          message ||
            (response.status === 401
              ? "Session expired. Refresh the page and sign in again."
              : type === "report"
                ? "Report is not ready yet."
                : "Transcript unavailable."),
        );
      }

      const data = (await response.json()) as { url: string; filename?: string };
      const link = document.createElement("a");
      link.href = data.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      if (data.filename) {
        link.download = data.filename;
      }
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading history...</p>;
  }

  if (evaluations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center">
        <p className="font-medium text-zinc-900">No uploads in the last 7 days</p>
        <p className="mt-1 text-sm text-zinc-500">
          Upload a transcript to see it here. Older evaluations are not shown in History.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evaluations.some(
        (evaluation) =>
          evaluation.status === "pending" || evaluation.status === "processing",
      ) && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Analysis in progress — this page refreshes automatically every few seconds.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Transcript</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tokens</th>
                <th className="px-4 py-3">AI score</th>
                <th className="px-4 py-3">Efficiency</th>
                <th className="px-4 py-3">Est. savings</th>
                <th className="px-4 py-3 text-right">Downloads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {evaluations.map((evaluation) => {
        const summary = evaluation.evaluation_summary as {
          total_tokens?: number;
          best_fit_model?: string;
          user_evaluation?: {
            overall_score?: number;
            grade?: string;
          };
          prompting_recommendations?: {
            prompt_efficiency?: {
              efficiency_score?: number;
              grade?: string;
            };
            optimized_session?: {
              savings_tokens?: number;
              savings_percent?: number;
            };
            token_savings_estimate?: {
              savings_tokens?: number;
              savings_percent?: number;
            };
            task_type?: {
              label?: string;
            };
            model_advice?: {
              tier_recommended_model?: string;
            };
            tiered_model_picks?: {
              picks?: Array<{ model_id: string; label: string }>;
            };
          };
        } | null;
                const displayName =
                  evaluation.title || evaluation.original_filename || "Untitled";
                const isDownloadingTranscript =
                  downloadingId === `${evaluation.id}-transcript`;
                const isDownloadingReport =
                  downloadingId === `${evaluation.id}-report`;

                return (
                  <tr key={evaluation.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{displayName}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {formatFileSize(evaluation.file_size_bytes)}
                      </p>
                      {evaluation.status === "failed" && evaluation.error_message && (
                        <p className="mt-1 text-xs text-red-600">
                          {evaluation.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <time dateTime={evaluation.created_at}>
                        {new Date(evaluation.created_at).toLocaleDateString()}
                      </time>
                      <p className="text-xs text-zinc-400">
                        {new Date(evaluation.created_at).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {fileTypeLabel(
                        evaluation.content_type,
                        evaluation.original_filename,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[evaluation.status]}`}
                      >
                        {STATUS_LABELS[evaluation.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {evaluation.status === "completed" && summary?.total_tokens != null
                        ? summary.total_tokens.toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {evaluation.status === "completed" &&
                      summary?.user_evaluation?.overall_score != null ? (
                        <div>
                          <p className="font-medium text-zinc-900">
                            {summary.user_evaluation.overall_score}%
                          </p>
                          <p className="text-xs text-zinc-500">
                            {summary.user_evaluation.grade}
                          </p>
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {evaluation.status === "completed" &&
                      summary?.prompting_recommendations?.prompt_efficiency
                        ?.efficiency_score != null ? (
                        <div>
                          <p className="font-medium text-zinc-900">
                            {
                              summary.prompting_recommendations.prompt_efficiency
                                .efficiency_score
                            }
                            %
                          </p>
                          <p className="text-xs text-zinc-500">
                            {summary.prompting_recommendations.prompt_efficiency.grade}
                          </p>
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {evaluation.status === "completed" &&
                      ((summary?.prompting_recommendations?.optimized_session?.savings_tokens ??
                        0) > 0 ||
                        (summary?.prompting_recommendations?.token_savings_estimate
                          ?.savings_tokens ?? 0) > 0) ? (
                        <div>
                          <p className="font-medium text-zinc-900">
                            {(summary?.prompting_recommendations?.optimized_session
                              ?.savings_percent ??
                              summary?.prompting_recommendations?.token_savings_estimate
                                ?.savings_percent ??
                              0)}
                            %
                          </p>
                          <p className="text-xs text-zinc-500">
                            {(summary?.prompting_recommendations?.optimized_session
                              ?.savings_tokens ??
                              summary?.prompting_recommendations?.token_savings_estimate
                                ?.savings_tokens ??
                              0).toLocaleString()}{" "}
                            tokens
                          </p>
                          {(summary?.prompting_recommendations?.tiered_model_picks?.picks?.[1]
                            ?.model_id ||
                            summary?.prompting_recommendations?.model_advice
                              ?.tier_recommended_model) && (
                            <p className="text-xs text-zinc-500">
                              →{" "}
                              {summary.prompting_recommendations.tiered_model_picks?.picks?.[1]
                                ?.model_id ??
                                summary.prompting_recommendations.model_advice
                                  ?.tier_recommended_model}
                            </p>
                          )}
                          {summary?.prompting_recommendations?.task_type?.label && (
                            <p className="text-xs text-zinc-400">
                              {summary.prompting_recommendations.task_type.label}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={() => downloadFile(evaluation.id, "transcript")}
                          disabled={isDownloadingTranscript}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                        >
                          {isDownloadingTranscript ? "Loading..." : "Transcript"}
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadFile(evaluation.id, "report")}
                          disabled={
                            evaluation.status !== "completed" || isDownloadingReport
                          }
                          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isDownloadingReport ? "Loading..." : "PDF report"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        {evaluations.length} upload{evaluations.length === 1 ? "" : "s"} in your history.
        PDF reports are available when status is Completed.
      </p>
    </div>
  );
}
