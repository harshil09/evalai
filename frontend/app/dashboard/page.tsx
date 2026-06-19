"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import DashboardTabs, { type DashboardTab } from "@/components/dashboard/DashboardTabs";
import EvaluationHistory from "@/components/dashboard/EvaluationHistory";
import UploadTranscript from "@/components/dashboard/UploadTranscript";

type Profile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  plan: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashboardTab>("upload");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadDashboard = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/signin");
      return;
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, plan")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profileRow) {
      setError("Could not load your profile.");
      setLoading(false);
      return;
    }

    setProfile(profileRow);

    const monthKey = new Date().toISOString().slice(0, 7);
    const { data: usageRow } = await supabase
      .from("usage_counters")
      .select("upload_count")
      .eq("user_id", session.user.id)
      .eq("month_key", monthKey)
      .maybeSingle();

    setUsageCount(usageRow?.upload_count ?? 0);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshKey]);

  useEffect(() => {
    if (sessionStorage.getItem("upgradeSuccess") === "1") {
      sessionStorage.removeItem("upgradeSuccess");
      setSuccessMessage("Welcome to Pro! You can now upload unlimited transcripts.");
      setRefreshKey((value) => value + 1);
    }
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/signin");
    router.refresh();
  }

  function handleUploaded() {
    setRefreshKey((value) => value + 1);
    setUsageCount((value) => (value ?? 0) + 1);
    loadDashboard();
    setActiveTab("history");
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Upload chat transcripts for token analysis and PDF reports.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
          >
            Sign out
          </button>
        </header>

        {error && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </p>
        )}

        {successMessage && (
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {successMessage}
          </p>
        )}

        {profile && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Account
            </h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Name</dt>
                <dd className="font-medium text-zinc-900">
                  {[profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
                    "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Email</dt>
                <dd className="font-medium text-zinc-900">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Plan</dt>
                <dd className="font-medium capitalize text-zinc-900">
                  {profile.plan}
                  {profile.plan === "pro" && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Active
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Uploads this month</dt>
                <dd className="font-medium text-zinc-900">
                  {usageCount ?? 0}
                  {profile.plan === "free" ? " / 5" : " · unlimited"}
                </dd>
              </div>
            </dl>
          </section>
        )}

        <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "upload" && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">New evaluation</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Upload a User / Agent transcript. The Python worker generates your PDF
              report — view it in the History tab.
            </p>
            <div className="mt-4">
              {profile && (
                <UploadTranscript
                  plan={profile.plan}
                  uploadsUsed={usageCount ?? 0}
                  onUploaded={handleUploaded}
                />
              )}
            </div>
          </section>
        )}

        {activeTab === "history" && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Upload history</h2>
            <p className="mt-1 text-sm text-zinc-600">
              All your transcripts and generated PDF reports. Download either file
              anytime.
            </p>
            <div className="mt-4">
              <EvaluationHistory refreshKey={refreshKey} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
