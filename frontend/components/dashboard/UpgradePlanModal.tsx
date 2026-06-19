"use client";

import { useRouter } from "next/navigation";

type UpgradePlanModalProps = {
  open: boolean;
  onClose: () => void;
  uploadsUsed: number;
};

export default function UpgradePlanModal({
  open,
  onClose,
  uploadsUsed,
}: UpgradePlanModalProps) {
  const router = useRouter();

  if (!open) return null;

  function handleUpgrade() {
    router.push("/checkout");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 id="upgrade-modal-title" className="text-xl font-semibold text-zinc-900">
          Upload limit reached
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          You&apos;ve used {uploadsUsed} of 5 free uploads this month. Choose a plan to
          continue.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-900">Free</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">$0</p>
            <p className="text-xs text-zinc-500">per month</p>
            <ul className="mt-4 space-y-2 text-xs text-zinc-600">
              <li>5 uploads per month</li>
              <li>PDF token reports</li>
              <li>Dashboard access</li>
            </ul>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-white"
            >
              Stay on Free
            </button>
          </div>

          <div className="rounded-xl border-2 border-zinc-900 bg-white p-4">
            <p className="text-sm font-semibold text-zinc-900">Pro</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">$9</p>
            <p className="text-xs text-zinc-500">per month</p>
            <ul className="mt-4 space-y-2 text-xs text-zinc-600">
              <li>Unlimited uploads</li>
              <li>PDF token reports</li>
              <li>API access</li>
              <li>Priority processing</li>
            </ul>
            <button
              type="button"
              onClick={handleUpgrade}
              className="mt-4 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-zinc-500 hover:text-zinc-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
