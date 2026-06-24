import { Suspense } from "react";
import DashboardContent from "./DashboardContent";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a14] text-sm text-zinc-400">
          Loading...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
