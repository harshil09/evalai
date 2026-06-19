import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: evaluation, error } = await supabase
    .from("evaluations")
    .select("id, transcript_path, user_id, original_filename")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !evaluation) {
    return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
  }

  if (!evaluation.transcript_path) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from("transcripts")
    .createSignedUrl(evaluation.transcript_path, 3600);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  }

  return NextResponse.json({
    url: signed.signedUrl,
    filename: evaluation.original_filename ?? "transcript",
  });
}
