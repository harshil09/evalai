import { Suspense } from "react";
import AuthPage from "./AuthPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
          Loading...
        </div>
      }
    >
      <AuthPage />
    </Suspense>
  );
}
