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

  function handleUpgradeToPro() {
    router.push("/checkout");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="upgrade-modal-title" className="text-xl font-semibold text-slate-900">
          Choose your plan
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          You&apos;ve used {uploadsUsed} of 5 free uploads this month. Upgrade to Pro for
          unlimited transcript analysis.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Free</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">$0</p>
            <p className="text-xs text-slate-500">per month</p>
            <ul className="mt-4 space-y-2 text-xs text-slate-600">
              <li>5 uploads per month</li>
              <li>PDF analysis reports</li>
              <li>12 skill dimensions</li>
            </ul>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
            >
              Stay on Free
            </button>
          </div>

          <div className="rounded-xl border-2 border-violet-600 bg-violet-50/40 p-4">
            <p className="text-sm font-semibold text-violet-700">Pro</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">$9</p>
            <p className="text-xs text-slate-500">per month</p>
            <ul className="mt-4 space-y-2 text-xs text-slate-600">
              <li>Unlimited uploads</li>
              <li>PDF analysis reports</li>
              <li>Priority processing</li>
            </ul>
            <button
              type="button"
              onClick={handleUpgradeToPro}
              className="mt-4 w-full rounded-lg bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
