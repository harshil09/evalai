"use client";

import { useCallback, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background px-4 py-8 sm:py-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--accent)_0%,_transparent_55%)] opacity-50"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <EvalAILogo size="sm" />
          <div className="flex flex-1 flex-col gap-3 sm:mx-6 sm:max-w-md">
            <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleSignOut}
            className="self-start sm:self-center"
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {activeTab === "upload" && profile && (
          <div className="flex animate-auth-fade-up flex-col gap-6">
            <AccountSummaryCard
              firstName={profile.first_name}
              lastName={profile.last_name}
              email={profile.email}
              plan={profile.plan}
              uploadsUsed={usageCount ?? 0}
            />

            <DashboardKpiCards refreshKey={refreshKey} />

            <section className={GLASS_CARD}>
              <div className={GLASS_CARD_INNER}>
                <h2 className="text-lg font-semibold tracking-tight">Upload a Transcript</h2>
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
          <div className="flex animate-auth-fade-up flex-col gap-6">
            <DocumentSearch
              query={historySearchQuery}
              onQueryChange={setHistorySearchQuery}
            />

            <section className={GLASS_CARD}>
              <div className={GLASS_CARD_INNER}>
                <h2 className="text-lg font-semibold tracking-tight">History</h2>
                <p className="mt-1 text-sm text-muted-foreground">
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
            <div className={GLASS_CARD_INNER}>
              <BackupData />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
