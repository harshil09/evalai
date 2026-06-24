import { Suspense } from "react";
import SignInPage from "./SignInPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a14] text-sm text-zinc-400">
          Loading...
        </div>
      }
    >
      <SignInPage />
    </Suspense>
  );
}
