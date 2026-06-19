import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
