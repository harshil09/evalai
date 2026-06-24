"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/upgrade", {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired. Please sign in again and retry checkout.");
        }
        throw new Error(payload.error || "Checkout failed");
      }

      sessionStorage.setItem("upgradeSuccess", "1");
      router.push("/dashboard?tab=upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[#635bff] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white">stripe</span>
            <span className="rounded bg-white/20 px-2 py-0.5 text-xs text-white">Test mode</span>
          </div>
        </div>

        <div className="p-6">
          <h1 className="text-xl font-semibold text-slate-900">EvalAI Pro</h1>
          <p className="mt-1 text-sm text-slate-600">
            Dummy Stripe checkout — no real charge is made.
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Pro plan · monthly</span>
              <span className="font-semibold text-slate-900">$9.00</span>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              <li>Unlimited transcript uploads</li>
              <li>PDF reports with Nightingale skill charts</li>
              <li>Hybrid prompting coach analysis</li>
            </ul>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label htmlFor="card-number" className="block text-xs font-medium text-slate-600">
                Card number
              </label>
              <input
                id="card-number"
                type="text"
                readOnly
                defaultValue="4242 4242 4242 4242"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="expiry" className="block text-xs font-medium text-slate-600">
                  Expiry
                </label>
                <input
                  id="expiry"
                  type="text"
                  readOnly
                  defaultValue="12 / 34"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="cvc" className="block text-xs font-medium text-slate-600">
                  CVC
                </label>
                <input
                  id="cvc"
                  type="text"
                  readOnly
                  defaultValue="123"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className="mt-5 w-full rounded-lg bg-[#635bff] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#5851ea] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Processing..." : "Pay $9.00"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-3 w-full text-center text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
