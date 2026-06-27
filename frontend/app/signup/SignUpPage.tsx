"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isValidEmail } from "@/components/auth/auth-utils";
import AuthShell from "@/components/auth/AuthShell";
import {
  AuthField,
  AuthFooterLink,
  AuthSubmitButton,
  AuthTermsCheckbox,
  PasswordField,
} from "@/components/auth/AuthForm";
import { showAuthToast } from "@/components/auth/AuthToast";

function getConfigError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return "Supabase URL is missing. Check frontend/.env.local and restart the dev server.";
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return "Supabase publishable key is missing. Check frontend/.env.local and restart the dev server.";
  }
  return null;
}

export default function SignUpPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const configError = getConfigError();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    isValidEmail(email) &&
    password.length >= 6 &&
    termsAccepted &&
    !configError;

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (configError) {
      showAuthToast("error", configError);
      return;
    }
    if (!termsAccepted) {
      showAuthToast("error", "Please accept the Terms of Service to continue.");
      return;
    }
    if (!canSubmit) {
      showAuthToast("error", "Please fill in all fields. Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const trimmedEmail = email.trim();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        showAuthToast("error", signUpError.message);
        return;
      }
      if (data.user?.identities?.length === 0) {
        showAuthToast("error", "An account with this email may already exist. Try signing in.");
        return;
      }
      if (data.session) {
        await supabase.auth.signOut();
      }
      showAuthToast("success", "Account created! Sign in to continue.");
      router.replace(`/signin?registered=1&email=${encodeURIComponent(trimmedEmail)}`);
    } catch {
      showAuthToast("error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      mode="signup"
      title="Create an account"
      subtitle="Get started with EvalAI"
      footer={
        <AuthFooterLink prompt="Already have an account?" href="/signin" linkText="Sign in" />
      }
    >
      <form onSubmit={handleSignUp} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField
            id="firstName"
            label="First name"
            value={firstName}
            onChange={setFirstName}
            autoComplete="given-name"
            placeholder="Jane"
          />
          <AuthField
            id="lastName"
            label="Last name"
            value={lastName}
            onChange={setLastName}
            autoComplete="family-name"
            placeholder="Doe"
          />
        </div>
        <AuthField
          id="email"
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          validateEmail
          placeholder="you@example.com"
        />
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          showStrength
        />
        <AuthTermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} />
        <AuthSubmitButton
          label="Create account"
          loadingLabel="Creating account…"
          loading={loading}
          disabled={!canSubmit}
        />
      </form>
    </AuthShell>
  );
}
