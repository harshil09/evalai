"use client";

import Link from "next/link";
import { useState } from "react";
import {
  STRENGTH_LABELS,
  STRENGTH_SEGMENT_COLORS,
  getPasswordStrength,
  isValidEmail,
} from "@/components/auth/auth-utils";

type AuthFieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  validateEmail?: boolean;
};

const inputBase =
  "peer w-full rounded-xl border bg-white/[0.04] px-4 pb-2.5 pt-5 text-sm text-white outline-none transition-all duration-200 placeholder-transparent";

function fieldBorderClass(
  focused: boolean,
  showValid: boolean,
  showInvalid: boolean,
): string {
  if (showInvalid) return "border-red-500/70 ring-1 ring-red-500/30";
  if (showValid) return "border-emerald-500/70 ring-1 ring-emerald-500/30";
  if (focused) return "border-indigo-400/60 ring-1 ring-indigo-400/25";
  return "border-white/10 hover:border-white/20";
}

function floatingLabelClass(focused: boolean, hasValue: boolean): string {
  const up = focused || hasValue;
  return `pointer-events-none absolute left-4 transition-all duration-200 ${
    up
      ? "top-2 text-[10px] font-medium uppercase tracking-wide text-indigo-300"
      : "top-1/2 -translate-y-1/2 text-sm text-zinc-500"
  }`;
}

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required = true,
  validateEmail = false,
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const hasValue = value.length > 0;
  const showValid = validateEmail && hasValue && isValidEmail(value);
  const showInvalid = validateEmail && touched && hasValue && !isValidEmail(value);

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setTouched(true);
          }}
          autoComplete={autoComplete}
          required={required}
          placeholder=" "
          className={`${inputBase} ${fieldBorderClass(focused, showValid, showInvalid)}`}
        />
        <label htmlFor={id} className={floatingLabelClass(focused, hasValue)}>
          {label}
        </label>
      </div>
      {showInvalid && (
        <p className="mt-1.5 animate-auth-fade-in text-xs text-red-400">
          Enter a valid email address
        </p>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  return (
    <div className="mt-3 animate-auth-fade-in space-y-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              strength >= level
                ? STRENGTH_SEGMENT_COLORS[level - 1]
                : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Strength:{" "}
        <span
          className={`font-medium ${
            strength <= 1
              ? "text-red-400"
              : strength === 2
                ? "text-orange-400"
                : strength === 3
                  ? "text-indigo-400"
                  : "text-emerald-400"
          }`}
        >
          {STRENGTH_LABELS[strength]}
        </span>
      </p>
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  showStrength?: boolean;
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required = true,
  showStrength = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const hasValue = value.length > 0;

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          required={required}
          placeholder=" "
          className={`${inputBase} pr-11 ${fieldBorderClass(focused, false, false)}`}
        />
        <label htmlFor={id} className={floatingLabelClass(focused, hasValue)}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {showStrength ? <PasswordStrengthMeter password={value} /> : null}
    </div>
  );
}

export function AuthTermsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-400">
      <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-4 w-4 rounded border border-white/20 bg-white/[0.04] transition peer-checked:border-indigo-500 peer-checked:bg-indigo-600" />
        <svg
          className="pointer-events-none absolute h-2.5 w-2.5 text-white opacity-0 transition peer-checked:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="3"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span>
        I agree to the{" "}
        <span className="text-indigo-400">Terms of Service</span> and{" "}
        <span className="text-indigo-400">Privacy Policy</span>
      </span>
    </label>
  );
}

export function AuthRememberForgot({
  remember,
  onRememberChange,
  onForgotPassword,
}: {
  remember: boolean;
  onRememberChange: (value: boolean) => void;
  onForgotPassword: () => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <label className="flex cursor-pointer items-center gap-2 text-zinc-400">
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => onRememberChange(e.target.checked)}
            className="peer sr-only"
          />
          <span className="h-4 w-4 rounded border border-white/20 bg-white/[0.04] transition peer-checked:border-indigo-500 peer-checked:bg-indigo-600" />
          <svg
            className="pointer-events-none absolute h-2.5 w-2.5 text-white opacity-0 transition peer-checked:opacity-100"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        Remember me
      </label>
      <button
        type="button"
        onClick={onForgotPassword}
        className="font-medium text-indigo-400 transition hover:text-indigo-300"
      >
        Forgot password?
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function AuthSubmitButton({
  label,
  loadingLabel,
  loading,
  disabled = false,
}: {
  label: string;
  loadingLabel: string;
  loading: boolean;
  disabled?: boolean;
}) {
  const isDisabled = loading || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={`auth-gradient-btn group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 ${
        isDisabled
          ? "cursor-not-allowed opacity-50"
          : "hover:shadow-lg hover:shadow-indigo-900/40 active:scale-[0.98]"
      }`}
    >
      <span className="auth-btn-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
      <span className="relative flex items-center gap-2">
        {loading && <Spinner />}
        {loading ? loadingLabel : label}
      </span>
    </button>
  );
}

export function AuthFooterLink({
  prompt,
  href,
  linkText,
}: {
  prompt: string;
  href: string;
  linkText: string;
}) {
  return (
    <>
      {prompt}{" "}
      <Link
        href={href}
        className="font-semibold text-indigo-400 underline-offset-2 transition hover:text-indigo-300 hover:underline"
      >
        {linkText}
      </Link>
    </>
  );
}
