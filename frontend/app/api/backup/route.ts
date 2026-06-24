import JSZip from "jszip";
import { NextResponse } from "next/server";

import { createClient, getAuthUserId } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

type EvaluationRow = {
  id: string;
  title: string | null;
  original_filename: string | null;
  content_type: string;
  transcript_path: string;
  report_path: string | null;
  status: string;
};

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\.+$/, "");
  return cleaned || "file";
}

function uniqueName(base: string, used: Set<string>): string {
  let name = base;
  let counter = 1;

  while (used.has(name.toLowerCase())) {
    const dot = base.lastIndexOf(".");
    name =
      dot > 0
        ? `${base.slice(0, dot)}-${counter}${base.slice(dot)}`
        : `${base}-${counter}`;
    counter += 1;
  }

  used.add(name.toLowerCase());
  return name;
}

async function downloadStorageFile(
  admin: ReturnType<typeof createAdminClient>,
  bucket: "transcripts" | "reports",
  path: string,
): Promise<Buffer | null> {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) {
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function GET() {
  const userId = await getAuthUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: evaluations, error } = await supabase
    .from("evaluations")
    .select(
      "id, title, original_filename, content_type, transcript_path, report_path, status",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load evaluations" }, { status: 500 });
  }

  const rows = (evaluations ?? []) as EvaluationRow[];
  const admin = createAdminClient();
  const zip = new JSZip();
  const transcriptsFolder = zip.folder("transcripts");
  const reportsFolder = zip.folder("reports");
  const usedTranscriptNames = new Set<string>();
  const usedReportNames = new Set<string>();

  await Promise.all(
    rows.map(async (evaluation) => {
      const displayName =
        evaluation.title || evaluation.original_filename || evaluation.id;

      if (evaluation.transcript_path && transcriptsFolder) {
        const transcriptBytes = await downloadStorageFile(
          admin,
          "transcripts",
          evaluation.transcript_path,
        );

        if (transcriptBytes) {
          const transcriptName = uniqueName(
            sanitizeFilename(evaluation.original_filename || `${displayName}.txt`),
            usedTranscriptNames,
          );
          transcriptsFolder.file(transcriptName, transcriptBytes);
        }
      }

      if (
        evaluation.status === "completed" &&
        evaluation.report_path &&
        reportsFolder
      ) {
        const reportBytes = await downloadStorageFile(
          admin,
          "reports",
          evaluation.report_path,
        );

        if (reportBytes) {
          const reportName = uniqueName(
            sanitizeFilename(`${displayName}-report.pdf`),
            usedReportNames,
          );
          reportsFolder.file(reportName, reportBytes);
        }
      }
    }),
  );

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="evalai-backup-${date}.zip"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}
