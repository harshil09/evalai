"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import UpgradePlanModal from "@/components/dashboard/UpgradePlanModal";

type UploadTranscriptProps = {
  plan: string;
  uploadsUsed: number;
  onUploaded: () => void;
};

type CatalogModel = {
  model_id: string;
  provider: string;
};

const ALLOWED_EXTENSIONS = [".txt", ".md", ".markdown"];
const FREE_UPLOAD_LIMIT = 5;

function detectContentType(file: File): string | null {
  if (file.type === "text/plain") return "text/plain";
  if (file.type === "text/markdown" || file.type === "text/x-markdown") {
    return "text/markdown";
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  return null;
}

export default function UploadTranscript({
  plan,
  uploadsUsed,
  onUploaded,
}: UploadTranscriptProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [userReportedModel, setUserReportedModel] = useState("");
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const atFreeLimit = plan === "free" && uploadsUsed >= FREE_UPLOAD_LIMIT;

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        const response = await fetch("/api/models");
        if (!response.ok) return;
        const payload = (await response.json()) as { models: CatalogModel[] };
        if (!cancelled) {
          setModels(payload.models ?? []);
        }
      } finally {
        if (!cancelled) {
          setModelsLoading(false);
        }
      }
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);
    setSuccess(null);
  }

  async function uploadFile(contentType: string) {
    if (!file) return;

    const createResponse = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || file.name,
        original_filename: file.name,
        content_type: contentType,
        file_size_bytes: file.size,
        user_reported_model: userReportedModel || null,
      }),
    });

    const createPayload = await createResponse.json();

    if (createResponse.status === 429 || createPayload.code === "UPLOAD_LIMIT_REACHED") {
      setShowUpgradeModal(true);
      return;
    }

    if (!createResponse.ok) {
      throw new Error(createPayload.error || "Could not create evaluation job");
    }

    const transcriptPath =
      (createPayload.transcript_path as string) ||
      (createPayload.evaluation?.transcript_path as string);
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("transcripts")
      .upload(transcriptPath, file, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    setSuccess("Transcript uploaded. The worker will analyze it shortly.");
    setFile(null);
    setTitle("");
    setUserReportedModel("");
    onUploaded();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a transcript file first.");
      return;
    }

    const contentType = detectContentType(file);
    if (!contentType) {
      setError("Only .txt and .md transcript files are supported.");
      return;
    }

    const extensionOk = ALLOWED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext),
    );
    if (!extensionOk) {
      setError("Only .txt and .md transcript files are supported.");
      return;
    }

    if (atFreeLimit) {
      setShowUpgradeModal(true);
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      await uploadFile(contentType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <UpgradePlanModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        uploadsUsed={uploadsUsed}
      />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 p-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-zinc-700">
            Title (optional)
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Support chat — March 2026"
          />
        </div>
        <div>
          <label htmlFor="model" className="block text-sm font-medium text-zinc-700">
            AI model used (optional)
          </label>
          <select
            id="model"
            value={userReportedModel}
            onChange={(event) => setUserReportedModel(event.target.value)}
            disabled={modelsLoading}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">
              {modelsLoading ? "Loading models..." : "Auto-detect / not sure"}
            </option>
            {models.map((model) => (
              <option key={model.model_id} value={model.model_id}>
                {model.model_id} ({model.provider})
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-zinc-500">
            Improves cost comparison when your transcript does not name the model.
          </p>
        </div>
        <div>
          <label htmlFor="transcript" className="block text-sm font-medium text-zinc-700">
            Transcript file
          </label>
          <div className="mt-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 transition hover:border-zinc-400 hover:bg-zinc-100/80">
            <input
              id="transcript"
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              onChange={handleFileChange}
              className="block w-full cursor-pointer text-sm text-zinc-700 file:mr-4 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-50"
            />
            {file ? (
              <p className="mt-3 text-sm font-medium text-zinc-900">
                Selected: {file.name}
              </p>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                Choose a .txt or .md file to upload
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Plain text or markdown with lines like User: and Agent:
          </p>
        </div>
        {atFreeLimit && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Free plan limit reached (5/month). Upgrade to Pro to upload more.
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {success}
          </p>
        )}
        <button
          type="submit"
          disabled={uploading || !file}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload & analyze"}
        </button>
      </form>
    </>
  );
}
