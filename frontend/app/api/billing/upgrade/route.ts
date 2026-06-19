import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
    .eq("id", user.id)
    .select("id, plan, subscription_status, pro_since")
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not upgrade plan" }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
