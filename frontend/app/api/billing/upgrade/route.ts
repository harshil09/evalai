import { NextResponse } from "next/server";

import { getAuthUserId } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST() {
  const userId = await getAuthUserId();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({
      plan: "pro",
      subscription_status: "active",
      pro_since: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id, plan, subscription_status, pro_since")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not upgrade plan" }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
