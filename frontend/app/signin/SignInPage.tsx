"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isValidEmail } from "@/components/auth/auth-utils";
import AuthShell from "@/components/auth/AuthShell";
import {
  AuthFooterLink,
  AuthRememberForgot,
  AuthField,
  AuthSubmitButton,
  PasswordField,
} from "@/components/auth/AuthForm";
import { showAuthToast } from "@/components/auth/AuthToast";

const REMEMBER_EMAIL_KEY = "evalai_remember_email";

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
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = isValidEmail(email) && password.length > 0 && !configError;

  useEffect(() => {
    if (registered) {
      showAuthToast("success", "Account created successfully. Please sign in to continue.");
    }
  }, [registered]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved && !emailFromSignup) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      // ignore
    }
  }, [emailFromSignup]);

  async function handleForgotPassword() {
    const target = email.trim() || window.prompt("Enter your email address")?.trim();
    if (!target) return;
    if (!isValidEmail(target)) {
      showAuthToast("error", "Enter a valid email address first.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) {
      showAuthToast("error", error.message);
      return;
    }
    showAuthToast("success", "Password reset link sent. Check your inbox.");
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (configError) {
      showAuthToast("error", configError);
      return;
    }
    if (!canSubmit) {
      showAuthToast("error", "Please enter a valid email and password.");
      return;
    }
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) {
        showAuthToast("error", signInError.message);
        return;
      }
      try {
        if (remember) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, trimmedEmail);
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch {
        // ignore
      }
      showAuthToast("success", "Signed in successfully. Redirecting…");
      window.location.assign("/dashboard");
    } catch {
      showAuthToast("error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      mode="signin"
      title="Welcome back"
      subtitle="Sign in to your EvalAI workspace."
      footer={
        <AuthFooterLink prompt="No account?" href="/signup" linkText="Create one free" />
      }
    >
      <form onSubmit={handleSignIn} className="space-y-5">
        <AuthField
          id="email"
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          validateEmail
        />
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <AuthRememberForgot
          remember={remember}
          onRememberChange={setRemember}
          onForgotPassword={handleForgotPassword}
        />
        <AuthSubmitButton
          label="Sign in"
          loadingLabel="Signing in…"
          loading={loading}
          disabled={!canSubmit}
        />
      </form>
    </AuthShell>
  );
}
