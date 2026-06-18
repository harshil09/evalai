"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  AuthError,
  AuthField,
  AuthLayout,
  AuthSubmitButton,
  AuthSuccess,
  PasswordField,
} from "@/components/auth/AuthForm";

function getConfigError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return "Supabase URL is missing. Check frontend/.env.local and restart the dev server.";
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return "Supabase publishable key is missing. Check frontend/.env.local and restart the dev server.";
  }
  return null;
}

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const configError = getConfigError();

  const registered = searchParams.get("registered") === "1";
  const emailFromSignup = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(emailFromSignup);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(configError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (configError) {
      setError(configError);
      return;
    }

    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to access your transcripts and reports."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-zinc-900 underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {registered && (
          <AuthSuccess message="Account created successfully. Please sign in to continue." />
        )}
        <AuthField
          id="email"
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <AuthError message={error} />
        <AuthSubmitButton label="Sign in" loading={loading} />
      </form>
    </AuthLayout>
  );
}
