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
      const response = await fetch("/api/billing/upgrade", { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Checkout failed");
      }

      sessionStorage.setItem("upgradeSuccess", "1");

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Checkout
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">TranscriptIQ Pro</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Dummy payment page for demo purposes. No real charge is made.
        </p>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600">Pro plan</span>
            <span className="font-medium text-zinc-900">$9.00 / month</span>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-zinc-600">
            <li>Unlimited transcript uploads</li>
            <li>Token analysis PDF reports</li>
            <li>API access</li>
          </ul>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="card-name" className="block text-sm font-medium text-zinc-700">
              Name on card
            </label>
            <input
              id="card-name"
              type="text"
              defaultValue="Demo User"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="card-number" className="block text-sm font-medium text-zinc-700">
              Card number
            </label>
            <input
              id="card-number"
              type="text"
              defaultValue="4242 4242 4242 4242"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="expiry" className="block text-sm font-medium text-zinc-700">
                Expiry
              </label>
              <input
                id="expiry"
                type="text"
                defaultValue="12/28"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="cvc" className="block text-sm font-medium text-zinc-700">
                CVC
              </label>
              <input
                id="cvc"
                type="text"
                defaultValue="123"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
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
          className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Processing..." : "Checkout — $9.00"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mt-3 w-full text-center text-sm text-zinc-500 hover:text-zinc-700"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
