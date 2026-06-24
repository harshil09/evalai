"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import EvalAILogo from "@/components/auth/EvalAILogo";
import AccountSummaryCard from "@/components/dashboard/AccountSummaryCard";
import BackupData from "@/components/dashboard/BackupData";
import DashboardTabs, { type DashboardTab } from "@/components/dashboard/DashboardTabs";
import DashboardKpiCards from "@/components/dashboard/DashboardKpiCards";
import DocumentSearch from "@/components/dashboard/DocumentSearch";
import EvaluationHistory from "@/components/dashboard/EvaluationHistory";
import UploadTranscript from "@/components/dashboard/UploadTranscript";
import { GLASS_CARD, GLASS_CARD_INNER } from "@/components/dashboard/dashboard-utils";

type Profile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  plan: string;
};

export default function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<DashboardTab>("upload");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [historySearchQuery, setHistorySearchQuery] = useState("");

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
    const tab = searchParams.get("tab");
    if (tab === "upload" || tab === "history" || tab === "backup") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (sessionStorage.getItem("upgradeSuccess") === "1") {
      sessionStorage.removeItem("upgradeSuccess");
      setSuccessMessage("Welcome to Pro! You can now upload unlimited transcripts.");
      setActiveTab("upload");
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
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a14] text-sm text-zinc-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a14] px-4 py-8 sm:py-10">
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 animate-auth-orb rounded-full bg-indigo-600/20 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 animate-auth-orb-delayed rounded-full bg-violet-600/15 blur-[100px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <EvalAILogo size="sm" variant="dark" interactive />
          <div className="flex flex-1 flex-col gap-3 sm:mx-6 sm:max-w-md">
            <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white sm:self-center"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m0 0 4-4m-4 4 4 4m10-4h2a2 2 0 012 2v6a2 2 0 01-2 2h-2" />
            </svg>
            Sign out
          </button>
        </header>

        {error && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </p>
        )}

        {successMessage && (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </p>
        )}

        {activeTab === "upload" && profile && (
          <div className="flex flex-col gap-6 animate-auth-fade-up">
            <AccountSummaryCard
              firstName={profile.first_name}
              lastName={profile.last_name}
              email={profile.email}
              plan={profile.plan}
              uploadsUsed={usageCount ?? 0}
            />

            <DashboardKpiCards refreshKey={refreshKey} />

            <section className={GLASS_CARD}>
              <div className="dashboard-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
              <div className={GLASS_CARD_INNER}>
                <h2 className="text-lg font-semibold text-white">Upload a Transcript</h2>
                <div className="mt-5">
                  <UploadTranscript
                    plan={profile.plan}
                    uploadsUsed={usageCount ?? 0}
                    onUploaded={handleUploaded}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "history" && (
          <div className="flex flex-col gap-6 animate-auth-fade-up">
            <DocumentSearch
              query={historySearchQuery}
              onQueryChange={setHistorySearchQuery}
            />

            <section className={GLASS_CARD}>
              <div className="dashboard-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
              <div className={GLASS_CARD_INNER}>
                <h2 className="text-lg font-semibold text-white">History</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {historySearchQuery.trim()
                    ? "Matching transcripts and PDF reports across all uploads."
                    : "Transcripts and PDF reports from the last 7 days."}
                </p>
                <div className="mt-5">
                  <EvaluationHistory
                    refreshKey={refreshKey}
                    searchQuery={historySearchQuery}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "backup" && (
          <section className={`${GLASS_CARD} animate-auth-fade-up`}>
            <div className="dashboard-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className={GLASS_CARD_INNER}>
              <BackupData />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
