"use client";

import Link from "next/link";
import { useState } from "react";
import {
  STRENGTH_COLORS,
  STRENGTH_LABELS,
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
  placeholder?: string;
  validateEmail?: boolean;
};

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required = true,
  placeholder,
  validateEmail = false,
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  const showValid = validateEmail && value.length > 0 && isValidEmail(value);
  const showInvalid = validateEmail && value.length > 0 && !isValidEmail(value) && !focused;

  return (
    <div className="group">
      <label
        htmlFor={id}
        className={`mb-1.5 block text-sm font-medium transition-colors ${
          focused ? "text-violet-700" : "text-slate-700"
        }`}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 ${
            showInvalid
              ? "border-red-300 ring-2 ring-red-50"
              : showValid
                ? "border-emerald-300 ring-2 ring-emerald-50"
                : focused
                  ? "border-violet-500 ring-2 ring-violet-100"
                  : "border-slate-300 hover:border-slate-400"
          } ${validateEmail ? "pr-10" : ""}`}
        />
        {validateEmail && showValid && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-auth-fade-in">
            <CheckIcon />
          </span>
        )}
      </div>
      {showInvalid && (
        <p className="mt-1.5 animate-auth-fade-in text-xs text-red-600">
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
    <div className="mt-2 animate-auth-fade-in space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              strength >= level ? STRENGTH_COLORS[strength] : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Strength:{" "}
        <span
          className={`font-medium ${
            strength <= 1
              ? "text-red-600"
              : strength === 2
                ? "text-amber-600"
                : strength === 3
                  ? "text-violet-600"
                  : "text-emerald-600"
          }`}
        >
          {STRENGTH_LABELS[strength]}
        </span>
        {strength < 1 && password.length > 0 && (
          <span className="text-slate-400"> · min. 6 characters</span>
        )}
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
  placeholder?: string;
  showStrength?: boolean;
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required = true,
  placeholder = "Enter your password",
  showStrength = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className={`mb-1.5 block text-sm font-medium transition-colors ${
          focused ? "text-violet-700" : "text-slate-700"
        }`}
      >
        {label}
      </label>
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
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-white py-2.5 pl-3 pr-10 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 ${
            focused
              ? "border-violet-500 ring-2 ring-violet-100"
              : "border-slate-300 hover:border-slate-400"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {showStrength ? (
        <PasswordStrengthMeter password={value} />
      ) : null}
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="animate-auth-shake rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </div>
  );
}

export function AuthSuccess({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="status"
      className="animate-auth-fade-in rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
    >
      {message}
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
  loading,
  disabled = false,
}: {
  label: string;
  loading: boolean;
  disabled?: boolean;
}) {
  const isDisabled = loading || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 ${
        isDisabled
          ? "cursor-not-allowed bg-violet-400"
          : "bg-violet-600 hover:bg-violet-700 hover:shadow-md hover:shadow-violet-200 active:scale-[0.98]"
      }`}
    >
      {loading && <Spinner />}
      {loading ? "Please wait..." : label}
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
        className="font-semibold text-violet-600 underline-offset-2 transition hover:text-violet-700 hover:underline"
      >
        {linkText}
      </Link>
    </>
  );
}
