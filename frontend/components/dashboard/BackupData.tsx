"use client";

import { useState } from "react";
import { Archive, Download, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function BackupData() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch("/api/backup");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error || "Backup download failed");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "evalai-backup.zip";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Archive className="mt-0.5 size-6 shrink-0 text-primary" />
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Backup Your Data</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            EvalAI retains your transcripts and reports for 2 months, after which
            they&apos;re automatically deleted. Download a .zip backup any time
            containing all transcripts (.txt/.md) and PDF reports stored for your
            account.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="transition-all active:scale-[0.98]"
      >
        {downloading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {downloading ? "Preparing backup..." : "Download Backup (.zip)"}
      </Button>
    </div>
  );
}
