import { NextResponse } from "next/server";

import { createClient, getAuthUserId } from "@/utils/supabase/server";

export async function GET() {
  const userId = await getAuthUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("model_catalog")
    .select("model_id, provider")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("model_id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Could not load models" }, { status: 500 });
  }

  return NextResponse.json({ models: data ?? [] });
}
