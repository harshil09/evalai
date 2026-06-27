"use client";

import { getInitials, GLASS_CARD, GLASS_CARD_INNER } from "@/components/dashboard/dashboard-utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
      <div className={`${GLASS_CARD_INNER} flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-12 ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{fullName}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <Separator orientation="vertical" className="hidden h-10 sm:block" />

          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Plan</p>
            <p className="mt-1 flex items-center gap-2">
              <span className="text-sm font-semibold capitalize">{plan}</span>
              {isPro && (
                <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Pro · Active
                </Badge>
              )}
            </p>
          </div>

          <Separator orientation="vertical" className="hidden h-10 sm:block" />

          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Uploads this month
            </p>
            <p className="mt-1 text-sm font-semibold">
              {isPro ? "Unlimited" : `${uploadsUsed} / 5`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
