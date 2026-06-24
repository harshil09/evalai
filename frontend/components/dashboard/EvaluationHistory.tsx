"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { matchesEvaluationSearch } from "@/components/dashboard/dashboard-utils";

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
  searchQuery?: string;
};

const STATUS_LABELS: Record<Evaluation["status"], string> = {
  pending: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_COLORS: Record<Evaluation["status"], string> = {
  pending: "bg-zinc-500/20 text-zinc-300 ring-1 ring-zinc-500/30",
  processing: "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30",
  completed: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30",
  failed: "bg-red-500/20 text-red-300 ring-1 ring-red-500/30",
};

const PAGE_SIZE = 5;

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

export default function EvaluationHistory({
  refreshKey,
  searchQuery = "",
}: EvaluationHistoryProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const loadEvaluations = useCallback(async () => {
    try {
      const trimmedSearch = searchQuery.trim();

      if (trimmedSearch) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");

        const { data, error: fetchError } = await supabase
          .from("evaluations")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        setEvaluations(data ?? []);
      } else {
        const response = await fetch("/api/evaluations");
        if (!response.ok) throw new Error("Failed to load evaluations");
        const data = (await response.json()) as { evaluations: Evaluation[] };
        setEvaluations(data.evaluations);
      }

      setError(null);
    } catch {
      setError("Could not load your upload history.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setLoading(true);
    loadEvaluations();
  }, [loadEvaluations, refreshKey]);

  const filteredEvaluations = searchQuery.trim()
    ? evaluations.filter((row) => matchesEvaluationSearch(row, searchQuery))
    : evaluations;

  const visible = filteredEvaluations.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEvaluations.length;

  useEffect(() => {
    const hasActive = evaluations.some(
      (e) => e.status === "pending" || e.status === "processing",
    );
    if (!hasActive) return;
    const interval = window.setInterval(() => void loadEvaluations(), 4000);
    return () => window.clearInterval(interval);
  }, [evaluations, loadEvaluations]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      channel = supabase
        .channel(`evaluations-history-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "evaluations", filter: `user_id=eq.${user.id}` },
          () => loadEvaluations(),
        )
        .subscribe();

      if (cancelled && channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    }

    subscribe();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadEvaluations]);

  async function deleteEvaluation(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This removes the transcript, PDF, and record.`)) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/evaluations/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error || "Could not delete");
      }
      setEvaluations((rows) => rows.filter((row) => row.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function downloadFile(id: string, type: "transcript" | "report") {
    setDownloadingId(`${id}-${type}`);
    setError(null);
    try {
      const response = await fetch(`/api/evaluations/${id}/${type}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error || "Download failed");
      }
      const data = (await response.json()) as { url: string; filename?: string };
      const link = document.createElement("a");
      link.href = data.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      if (data.filename) link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading history...</p>;

  if (filteredEvaluations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center">
        <p className="font-medium text-white">
          {searchQuery.trim() ? "No documents match your search" : "No uploads in the last 7 days"}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {searchQuery.trim()
            ? "Try a different file name or date."
            : "Upload a transcript to see it here."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evaluations.some((e) => e.status === "pending" || e.status === "processing") && (
        <p className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
          Analysis in progress — refreshing automatically.
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Transcript</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tokens</th>
                <th className="px-4 py-3">Efficiency</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {visible.map((evaluation) => {
                const summary = evaluation.evaluation_summary as {
                  total_tokens?: number;
                  prompting_recommendations?: {
                    prompt_efficiency?: { efficiency_score?: number; grade?: string };
                  };
                } | null;
                const name = evaluation.title || evaluation.original_filename || "Untitled";

                return (
                  <tr key={evaluation.id} className="align-top hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {formatFileSize(evaluation.file_size_bytes)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(evaluation.created_at).toLocaleDateString()}
                      <p className="text-xs text-zinc-600">
                        {new Date(evaluation.created_at).toLocaleTimeString()}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {fileTypeLabel(evaluation.content_type, evaluation.original_filename)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[evaluation.status]}`}
                      >
                        {STATUS_LABELS[evaluation.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {evaluation.status === "completed" && summary?.total_tokens != null
                        ? summary.total_tokens.toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {evaluation.status === "completed" &&
                      summary?.prompting_recommendations?.prompt_efficiency?.efficiency_score !=
                        null ? (
                        <div>
                          <p className="font-medium text-white">
                            {summary.prompting_recommendations.prompt_efficiency.efficiency_score}%
                          </p>
                          <p className="text-xs text-zinc-500">
                            {summary.prompting_recommendations.prompt_efficiency.grade}
                          </p>
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={() => downloadFile(evaluation.id, "transcript")}
                          disabled={downloadingId === `${evaluation.id}-transcript`}
                          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-indigo-400/40 disabled:opacity-50"
                        >
                          Transcript
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadFile(evaluation.id, "report")}
                          disabled={
                            evaluation.status !== "completed" ||
                            downloadingId === `${evaluation.id}-report`
                          }
                          className="auth-gradient-btn rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                        >
                          PDF report
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEvaluation(evaluation.id, name)}
                          disabled={deletingId === evaluation.id}
                          className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Delete
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

      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.08]"
          >
            Load more
          </button>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        Showing {visible.length} of {filteredEvaluations.length}
        {searchQuery.trim() ? " matching" : ""} uploads in your history.
      </p>
    </div>
  );
}
