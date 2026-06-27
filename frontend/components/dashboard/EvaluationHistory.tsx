"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { matchesEvaluationSearch } from "@/components/dashboard/dashboard-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

const STATUS_VARIANTS: Record<
  Evaluation["status"],
  { variant: "secondary" | "default" | "destructive" | "outline"; className?: string }
> = {
  pending: { variant: "secondary" },
  processing: {
    variant: "default",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300",
  },
  completed: {
    variant: "secondary",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  failed: { variant: "destructive" },
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

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (filteredEvaluations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
        <p className="font-medium">
          {searchQuery.trim() ? "No documents match your search" : "No uploads in the last 7 days"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
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
        <Alert className="border-blue-200 bg-blue-50 text-blue-800">
          <AlertDescription>Analysis in progress — refreshing automatically.</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-4">Transcript</TableHead>
              <TableHead className="px-4">Uploaded</TableHead>
              <TableHead className="px-4">Type</TableHead>
              <TableHead className="px-4">Status</TableHead>
              <TableHead className="px-4">Tokens</TableHead>
              <TableHead className="px-4">Efficiency</TableHead>
              <TableHead className="px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((evaluation) => {
              const summary = evaluation.evaluation_summary as {
                total_tokens?: number;
                prompting_recommendations?: {
                  prompt_efficiency?: { efficiency_score?: number; grade?: string };
                };
              } | null;
              const name = evaluation.title || evaluation.original_filename || "Untitled";
              const statusStyle = STATUS_VARIANTS[evaluation.status];

              return (
                <TableRow key={evaluation.id} className="align-top">
                  <TableCell className="px-4 whitespace-normal">
                    <p className="font-medium">{name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatFileSize(evaluation.file_size_bytes)}
                    </p>
                  </TableCell>
                  <TableCell className="px-4 whitespace-normal text-muted-foreground">
                    {new Date(evaluation.created_at).toLocaleDateString()}
                    <p className="text-xs">
                      {new Date(evaluation.created_at).toLocaleTimeString()}
                    </p>
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {fileTypeLabel(evaluation.content_type, evaluation.original_filename)}
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge
                      variant={statusStyle.variant}
                      className={cn(statusStyle.className)}
                    >
                      {STATUS_LABELS[evaluation.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4">
                    {evaluation.status === "completed" && summary?.total_tokens != null
                      ? summary.total_tokens.toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="px-4 whitespace-normal">
                    {evaluation.status === "completed" &&
                    summary?.prompting_recommendations?.prompt_efficiency?.efficiency_score !=
                      null ? (
                      <div>
                        <p className="font-medium">
                          {summary.prompting_recommendations.prompt_efficiency.efficiency_score}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {summary.prompting_recommendations.prompt_efficiency.grade}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFile(evaluation.id, "transcript")}
                        disabled={downloadingId === `${evaluation.id}-transcript`}
                      >
                        Transcript
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => downloadFile(evaluation.id, "report")}
                        disabled={
                          evaluation.status !== "completed" ||
                          downloadingId === `${evaluation.id}-report`
                        }
                      >
                        PDF report
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteEvaluation(evaluation.id, name)}
                        disabled={deletingId === evaluation.id}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Load more
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {visible.length} of {filteredEvaluations.length}
        {searchQuery.trim() ? " matching" : ""} uploads in your history.
      </p>
    </div>
  );
}
