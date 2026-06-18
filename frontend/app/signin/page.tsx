import { Suspense } from "react";
import SignInForm from "./SignInForm";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-zinc-600">
          Loading...
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
