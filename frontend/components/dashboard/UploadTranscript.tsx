"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import UpgradePlanModal from "@/components/dashboard/UpgradePlanModal";

type UploadTranscriptProps = {
  plan: string;
  uploadsUsed: number;
  onUploaded: () => void;
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

function validateFile(file: File): string | null {
  const contentType = detectContentType(file);
  if (!contentType) {
    return `${file.name}: only .txt and .md files are supported.`;
  }
  const extensionOk = ALLOWED_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );
  if (!extensionOk) {
    return `${file.name}: only .txt and .md files are supported.`;
  }
  return null;
}

function CloudUploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="mx-auto h-10 w-10 text-violet-500"
      aria-hidden="true"
    >
      <path d="M12 16V4m0 0 7 7m-7-7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4 18.5A4.5 4.5 0 0 0 8.5 23h7A4.5 4.5 0 0 0 20 18.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function UploadTranscript({
  plan,
  uploadsUsed,
  onUploaded,
}: UploadTranscriptProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const atFreeLimit = plan === "free" && uploadsUsed >= FREE_UPLOAD_LIMIT;

  useEffect(() => {
    if (atFreeLimit) {
      setShowUpgradeModal(true);
    }
  }, [atFreeLimit]);

  function handleChooseFile() {
    if (atFreeLimit) {
      setShowUpgradeModal(true);
      return;
    }
    inputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected);
    setError(null);
    setSuccess(null);
  }

  async function uploadSingleFile(file: File): Promise<"ok" | "limit"> {
    const contentType = detectContentType(file);
    if (!contentType) {
      throw new Error(`${file.name}: unsupported file type.`);
    }

    const createResponse = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: file.name,
        original_filename: file.name,
        content_type: contentType,
        file_size_bytes: file.size,
        user_reported_model: null,
      }),
    });

    const createPayload = await createResponse.json();

    if (createResponse.status === 429 || createPayload.code === "UPLOAD_LIMIT_REACHED") {
      return "limit";
    }

    if (!createResponse.ok) {
      throw new Error(createPayload.error || `Could not create evaluation for ${file.name}`);
    }

    const transcriptPath =
      (createPayload.transcript_path as string) ||
      (createPayload.evaluation?.transcript_path as string);
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("transcripts")
      .upload(transcriptPath, file, { contentType, upsert: false });

    if (uploadError) {
      throw new Error(`${file.name}: ${uploadError.message}`);
    }

    return "ok";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (files.length === 0) {
      setError("Choose at least one transcript file.");
      return;
    }

    const validationErrors = files
      .map((selectedFile) => validateFile(selectedFile))
      .filter((message): message is string => message !== null);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      return;
    }

    if (plan === "free" && uploadsUsed + files.length > FREE_UPLOAD_LIMIT) {
      setShowUpgradeModal(true);
      return;
    }

    if (atFreeLimit) {
      setShowUpgradeModal(true);
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    let uploadedCount = 0;
    const failures: string[] = [];
    const remainingFiles: File[] = [];
    let hitLimit = false;

    try {
      for (const selectedFile of files) {
        try {
          const result = await uploadSingleFile(selectedFile);
          if (result === "limit") {
            hitLimit = true;
            remainingFiles.push(
              selectedFile,
              ...files.slice(files.indexOf(selectedFile) + 1),
            );
            break;
          }
          uploadedCount += 1;
        } catch (err) {
          failures.push(
            err instanceof Error ? err.message : `Upload failed for ${selectedFile.name}`,
          );
          remainingFiles.push(selectedFile);
        }
      }

      if (uploadedCount > 0) {
        onUploaded();
      }

      if (hitLimit) {
        setShowUpgradeModal(true);
      }

      if (uploadedCount > 0 && failures.length === 0 && !hitLimit) {
        setSuccess(
          uploadedCount === 1
            ? "Transcript uploaded. The worker will analyze it shortly."
            : `${uploadedCount} transcripts uploaded. The worker will analyze them shortly.`,
        );
        setFiles([]);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      } else if (uploadedCount > 0) {
        setSuccess(
          `${uploadedCount} of ${files.length} transcripts uploaded. The worker will analyze them shortly.`,
        );
        setFiles(remainingFiles);
      } else {
        setFiles(remainingFiles);
      }

      if (failures.length > 0) {
        setError(failures.join(" "));
      } else if (hitLimit && uploadedCount === 0) {
        setError("Free plan upload limit reached. Upgrade to Pro to continue.");
      }
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm leading-relaxed text-slate-600">
          Upload a <code className="text-slate-800">.txt</code> or{" "}
          <code className="text-slate-800">.md</code> file of your AI conversation.
          EvalAI scores the transcript across 12 efficiency dimensions and generates a PDF
          report.
        </p>

        <div>
          <input
            ref={inputRef}
            id="transcript"
            type="file"
            multiple
            accept=".txt,.md,.markdown,text/plain,text/markdown"
            onChange={handleFileChange}
            className="sr-only"
          />
          <button
            type="button"
            onClick={handleChooseFile}
            className={`w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
              atFreeLimit
                ? "border-amber-200 bg-amber-50/50 hover:border-amber-300"
                : "border-violet-200 bg-violet-50/40 hover:border-violet-300 hover:bg-violet-50"
            }`}
          >
            <CloudUploadIcon />
            <p className="mt-3 text-sm font-medium text-slate-800">
              {atFreeLimit
                ? "Free plan limit reached — choose a plan to continue"
                : "Click to choose a .txt or .md file"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Max 5MB</p>
          </button>

          {files.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              {files.map((selectedFile) => (
                <li
                  key={`${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`}
                >
                  {selectedFile.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {atFreeLimit && (
          <button
            type="button"
            onClick={() => setShowUpgradeModal(true)}
            className="w-full rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-medium text-violet-800 transition hover:bg-violet-100"
          >
            View Free &amp; Pro plans
          </button>
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
          disabled={uploading || files.length === 0}
          onClick={(event) => {
            if (atFreeLimit) {
              event.preventDefault();
              setShowUpgradeModal(true);
            }
          }}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading
            ? "Uploading..."
            : atFreeLimit
              ? "Upgrade to upload more"
              : "Analyze Transcript"}
        </button>
      </form>
    </>
  );
}
