import { NextResponse } from "next/server";

import { createClient, getAuthUserId } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const userId = await getAuthUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: evaluation, error } = await supabase
    .from("evaluations")
    .select("id, transcript_path, report_path, user_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !evaluation) {
    return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const storagePaths: { bucket: "transcripts" | "reports"; path: string }[] = [];

  if (evaluation.transcript_path) {
    storagePaths.push({ bucket: "transcripts", path: evaluation.transcript_path });
  }
  if (evaluation.report_path) {
    storagePaths.push({ bucket: "reports", path: evaluation.report_path });
  }

  for (const { bucket, path } of storagePaths) {
    const { error: storageError } = await admin.storage.from(bucket).remove([path]);
    if (storageError) {
      return NextResponse.json(
        { error: `Could not delete ${bucket} file` },
        { status: 500 },
      );
    }
  }

  const { error: deleteError } = await admin
    .from("evaluations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (deleteError) {
    return NextResponse.json({ error: "Could not delete evaluation" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
