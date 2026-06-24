"use client";

import { useState } from "react";

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5M4 7.5 7 4.5h10l3 3M4 7.5h16M9 12h6"
      />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14"
      />
    </svg>
  );
}

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
        throw new Error(
          (payload as { error?: string }).error || "Backup download failed",
        );
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
        <ArchiveIcon className="mt-0.5 h-6 w-6 shrink-0 text-violet-600" />
        <div>
          <h3 className="text-lg font-semibold text-zinc-900">Backup Your Data</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
            EvalAI retains your transcripts and reports for 2 months, after which
            they&apos;re automatically deleted. Download a .zip backup any time
            containing all transcripts (.txt/.md) and PDF reports stored for your
            account.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <DownloadIcon className="h-4 w-4" />
        {downloading ? "Preparing backup..." : "Download Backup (.zip)"}
      </button>
    </div>
  );
}
