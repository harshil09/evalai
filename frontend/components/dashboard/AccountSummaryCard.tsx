"use client";

import { getInitials, GLASS_CARD, GLASS_CARD_INNER } from "@/components/dashboard/dashboard-utils";

type AccountSummaryCardProps = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  plan: string;
  uploadsUsed: number;
};

export default function AccountSummaryCard({
  firstName,
  lastName,
  email,
  plan,
  uploadsUsed,
}: AccountSummaryCardProps) {
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") || email.split("@")[0];
  const initials = getInitials(firstName, lastName, email);
  const isPro = plan === "pro";

  return (
    <section className={GLASS_CARD}>
      <div className="dashboard-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className={`${GLASS_CARD_INNER} flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-900/40 ring-2 ring-white/10">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{fullName}</p>
            <p className="truncate text-sm text-zinc-400">{email}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="hidden h-10 w-px bg-white/10 sm:block" aria-hidden="true" />

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Plan</p>
            <p className="mt-1 flex items-center gap-2">
              <span className="text-sm font-semibold capitalize text-white">{plan}</span>
              {isPro && (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                  Pro · Active
                </span>
              )}
            </p>
          </div>

          <div className="hidden h-10 w-px bg-white/10 sm:block" aria-hidden="true" />

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Uploads this month
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {isPro ? "Unlimited" : `${uploadsUsed} / 5`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
