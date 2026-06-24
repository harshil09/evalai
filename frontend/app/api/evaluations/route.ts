import { NextResponse } from "next/server";

import { createClient, getAuthUserId } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

const ALLOWED_TYPES = new Set(["text/plain", "text/markdown"]);
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const userId = await getAuthUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    title?: string;
    original_filename?: string;
    content_type?: string;
    file_size_bytes?: number;
    user_reported_model?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const originalFilename = body.original_filename?.trim();
  const contentType = body.content_type?.trim();
  const fileSizeBytes = body.file_size_bytes;

  if (!originalFilename || !contentType || fileSizeBytes == null) {
    return NextResponse.json(
      { error: "original_filename, content_type, and file_size_bytes are required" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Only text/plain and text/markdown files are supported" },
      { status: 400 },
    );
  }

  if (fileSizeBytes <= 0 || fileSizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: "File must be between 1 byte and 2 MB" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const userReportedModel = body.user_reported_model?.trim() || null;

  if (userReportedModel) {
    const { data: modelRow, error: modelError } = await admin
      .from("model_catalog")
      .select("model_id")
      .eq("model_id", userReportedModel)
      .eq("active", true)
      .maybeSingle();

    if (modelError || !modelRow) {
      return NextResponse.json(
        { error: "Unknown or inactive model selected" },
        { status: 400 },
      );
    }
  }

  const { data, error } = await admin.rpc("create_evaluation_job", {
    p_user_id: userId,
    p_title: body.title?.trim() || originalFilename,
    p_original_filename: originalFilename,
    p_content_type: contentType,
    p_file_size_bytes: fileSizeBytes,
    p_user_reported_model: userReportedModel,
  });

  if (error) {
    const message = error.message.includes("upload limit")
      ? error.message
      : "Could not create evaluation job";
    const status = error.message.includes("upload limit") ? 429 : 500;
    return NextResponse.json(
      {
        error: message,
        code: error.message.includes("upload limit") ? "UPLOAD_LIMIT_REACHED" : undefined,
      },
      { status },
    );
  }

  return NextResponse.json({
    evaluation: data,
    transcript_path: data.transcript_path,
  });
}

export async function GET() {
  const userId = await getAuthUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load evaluations" }, { status: 500 });
  }

  return NextResponse.json({ evaluations: data ?? [] });
}
