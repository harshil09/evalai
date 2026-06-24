"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isValidEmail } from "@/components/auth/auth-utils";
import AuthShell from "@/components/auth/AuthShell";
import {
  AuthError,
  AuthField,
  AuthFooterLink,
  AuthSubmitButton,
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

export default function SignUpPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const configError = getConfigError();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(configError);
  const [loading, setLoading] = useState(false);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    isValidEmail(email) &&
    password.length >= 6 &&
    !configError;

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (configError) {
      setError(configError);
      return;
    }
    if (!canSubmit) {
      setError("Please fill in all fields. Password must be at least 6 characters.");
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
      router.replace(`/signin?registered=1&email=${encodeURIComponent(trimmedEmail)}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      mode="signup"
      title="Create your account"
      subtitle="Upload AI transcripts and receive structured efficiency reports."
      footer={
        <AuthFooterLink prompt="Already have an account?" href="/signin" linkText="Log in" />
      }
    >
      <form onSubmit={handleSignUp} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField
            id="firstName"
            label="First Name"
            value={firstName}
            onChange={setFirstName}
            autoComplete="given-name"
            placeholder="eg. John"
          />
          <AuthField
            id="lastName"
            label="Last Name"
            value={lastName}
            onChange={setLastName}
            autoComplete="family-name"
            placeholder="eg. Francisco"
          />
        </div>
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
          autoComplete="new-password"
          showStrength
        />
        <AuthError message={error} />
        <AuthSubmitButton label="Sign up" loading={loading} disabled={!canSubmit} />
      </form>
    </AuthShell>
  );
}
