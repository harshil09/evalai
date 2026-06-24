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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      onClick={onClose}
    >
      <div
        className="dashboard-glass-card w-full max-w-lg rounded-2xl border border-white/10 bg-[#12121f]/95 p-6 shadow-2xl backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="upgrade-modal-title" className="text-xl font-semibold text-white">
          Choose your plan
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          You&apos;ve used {uploadsUsed} of 5 free uploads this month. Upgrade to Pro for
          unlimited transcript analysis.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white">Free</p>
            <p className="mt-1 text-2xl font-bold text-white">$0</p>
            <p className="text-xs text-zinc-500">per month</p>
            <ul className="mt-4 space-y-2 text-xs text-zinc-400">
              <li>5 uploads per month</li>
              <li>PDF analysis reports</li>
              <li>12 skill dimensions</li>
            </ul>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.05]"
            >
              Stay on Free
            </button>
          </div>

          <div className="rounded-xl border-2 border-violet-500/50 bg-violet-500/10 p-4">
            <p className="text-sm font-semibold text-violet-300">Pro</p>
            <p className="mt-1 text-2xl font-bold text-white">$9</p>
            <p className="text-xs text-zinc-500">per month</p>
            <ul className="mt-4 space-y-2 text-xs text-zinc-400">
              <li>Unlimited uploads</li>
              <li>PDF analysis reports</li>
              <li>Priority processing</li>
            </ul>
            <button
              type="button"
              onClick={handleUpgradeToPro}
              className="auth-gradient-btn mt-4 w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-zinc-500 hover:text-zinc-300"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
