"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type MeResponse = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  plan: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/signin");
        return;
      }

      const metadata = session.user.user_metadata ?? {};

      setProfile({
        id: session.user.id,
        email: session.user.email ?? null,
        first_name: metadata.first_name ?? null,
        last_name: metadata.last_name ?? null,
        plan: "free",
      });
      setLoading(false);

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = (await response.json()) as MeResponse;
          setProfile(data);
          setError(null);
        } else {
          setError(
            "Signed in successfully, but the API could not load your profile. Make sure the backend is running and SUPABASE_URL is set in backend/.env.",
          );
        }
      } catch {
        setError(
          "Signed in successfully, but the backend API is not reachable. Start it on port 8000.",
        );
      }
    }

    loadProfile();
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/signin");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600">
          You are signed in. JWT authentication is active between the frontend
          and backend.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </p>
        )}

        {profile && (
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between border-b border-zinc-100 pb-2">
              <dt className="text-zinc-500">Name</dt>
              <dd className="font-medium text-zinc-900">
                {[profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
                  "—"}
              </dd>
            </div>
            <div className="flex justify-between border-b border-zinc-100 pb-2">
              <dt className="text-zinc-500">Email</dt>
              <dd className="font-medium text-zinc-900">{profile.email}</dd>
            </div>
            <div className="flex justify-between border-b border-zinc-100 pb-2">
              <dt className="text-zinc-500">Plan</dt>
              <dd className="font-medium capitalize text-zinc-900">{profile.plan}</dd>
            </div>
          </dl>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-8 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
