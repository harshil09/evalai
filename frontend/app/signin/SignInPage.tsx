"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isValidEmail } from "@/components/auth/auth-utils";
import AuthShell from "@/components/auth/AuthShell";
import {
  AuthError,
  AuthField,
  AuthFooterLink,
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

export default function SignInPage() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const configError = getConfigError();

  const registered = searchParams.get("registered") === "1";
  const emailFromSignup = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(emailFromSignup);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(configError);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    isValidEmail(email) && password.length > 0 && !configError;

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (configError) {
      setError(configError);
      return;
    }
    if (!canSubmit) {
      setError("Please enter a valid email and password.");
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
      window.location.assign("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      mode="signin"
      title="Sign in to your account"
      subtitle="Access your dashboard, upload history, and PDF reports."
      footer={
        <AuthFooterLink prompt="Don't have an account?" href="/signup" linkText="Sign up" />
      }
    >
      <form onSubmit={handleSignIn} className="space-y-5">
        {registered && (
          <AuthSuccess message="Account created successfully. Please sign in to continue." />
        )}
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="eg. john@example.com"
          validateEmail
        />
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <AuthError message={error} />
        <AuthSubmitButton label="Sign in" loading={loading} disabled={!canSubmit} />
      </form>
    </AuthShell>
  );
}
