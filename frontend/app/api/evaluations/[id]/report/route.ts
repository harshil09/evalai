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
    .select("id, status, report_path, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !evaluation) {
    return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
  }

  if (evaluation.status !== "completed" || !evaluation.report_path) {
    return NextResponse.json(
      { error: "Report is not ready yet" },
      { status: 409 },
    );
  }

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from("reports")
    .createSignedUrl(evaluation.report_path, 3600);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
