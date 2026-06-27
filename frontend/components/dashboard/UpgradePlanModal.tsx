"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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

  function handleUpgradeToPro() {
    router.push("/checkout");
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose your plan</DialogTitle>
          <DialogDescription>
            You&apos;ve used {uploadsUsed} of 5 free uploads this month. Upgrade to Pro for
            unlimited transcript analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm">
            <p className="text-sm font-semibold">Free</p>
            <p className="mt-1 text-2xl font-bold">$0</p>
            <p className="text-xs text-muted-foreground">per month</p>
            <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
              <li>5 uploads per month</li>
              <li>PDF analysis reports</li>
              <li>12 skill dimensions</li>
            </ul>
            <Button type="button" variant="outline" onClick={onClose} className="mt-4 w-full">
              Stay on Free
            </Button>
          </div>

          <div
            className={cn(
              "rounded-xl border-2 border-primary/40 bg-accent/50 p-4 transition-shadow hover:shadow-md",
            )}
          >
            <p className="text-sm font-semibold text-primary">Pro</p>
            <p className="mt-1 text-2xl font-bold">$9</p>
            <p className="text-xs text-muted-foreground">per month</p>
            <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
              <li>Unlimited uploads</li>
              <li>PDF analysis reports</li>
              <li>Priority processing</li>
            </ul>
            <Button type="button" onClick={handleUpgradeToPro} className="mt-4 w-full">
              Upgrade to Pro
            </Button>
          </div>
        </div>

        <Button type="button" variant="ghost" onClick={onClose} className="w-full text-muted-foreground">
          Maybe later
        </Button>
      </DialogContent>
    </Dialog>
  );
}
