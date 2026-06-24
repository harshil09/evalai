import { Suspense } from "react";
import SignUpPage from "./SignUpPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
          Loading...
        </div>
      }
    >
      <SignUpPage />
    </Suspense>
  );
}
