"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  AuthError,
  AuthField,
  AuthLayout,
  AuthSubmitButton,
  AuthSuccess,
  AuthTabs,
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

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const configError = getConfigError();

  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "signin";
  const [tab, setTab] = useState<"signin" | "signup">(initialTab);
  const registered = searchParams.get("registered") === "1";
  const emailFromSignup = searchParams.get("email") ?? "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(emailFromSignup);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(configError);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
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

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (configError) {
      setError(configError);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] ?? "";
      const lastName = nameParts.slice(1).join(" ");

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.user?.identities?.length === 0) {
        setError("An account with this email may already exist. Try signing in.");
        return;
      }
      if (data.session) {
        await supabase.auth.signOut();
      }
      setTab("signin");
      router.replace(`/auth?registered=1&email=${encodeURIComponent(trimmedEmail)}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <AuthTabs active={tab} onChange={setTab} />

      {tab === "signin" ? (
        <form onSubmit={handleSignIn} className="space-y-4">
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
          <AuthSubmitButton label="Sign In" loading={loading} />
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="space-y-4">
          <AuthField
            id="fullName"
            label="Full Name"
            value={fullName}
            onChange={setFullName}
            autoComplete="name"
            placeholder="e.g. Jane Doe"
          />
          <AuthField
            id="signupEmail"
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <PasswordField
            id="signupPassword"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
          <AuthError message={error} />
          <AuthSubmitButton label="Sign Up" loading={loading} />
        </form>
      )}
    </AuthLayout>
  );
}
