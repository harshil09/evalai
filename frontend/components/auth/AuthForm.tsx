"use client";

import Link from "next/link";
import { useState } from "react";

type AuthLayoutProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
};

function ShieldLogo() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 shadow-sm">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    </div>
  );
}

export function AuthLayout({ children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <ShieldLogo />
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            EvalAI
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Find out how efficiently you really use AI tools
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </div>
        {footer && (
          <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>
        )}
      </div>
    </div>
  );
}

type AuthTab = "signin" | "signup";

export function AuthTabs({
  active,
  onChange,
}: {
  active: AuthTab;
  onChange: (tab: AuthTab) => void;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
      <button
        type="button"
        onClick={() => onChange("signin")}
        className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
          active === "signin"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        Sign In
      </button>
      <button
        type="button"
        onClick={() => onChange("signup")}
        className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
          active === "signup"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        Sign Up
      </button>
    </div>
  );
}

type AuthFieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
};

export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required = true,
  placeholder,
}: AuthFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
      />
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

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required = true,
  placeholder = "••••••••",
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition hover:text-slate-900"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
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
      className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
    >
      {message}
    </div>
  );
}

export function AuthSubmitButton({
  label,
  loading,
}: {
  label: string;
  loading: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
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
      <Link href={href} className="font-medium text-violet-600 hover:text-violet-700">
        {linkText}
      </Link>
    </>
  );
}
