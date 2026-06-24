"use client";

import Link from "next/link";
import EvalAILogo from "@/components/auth/EvalAILogo";

type AuthMode = "signin" | "signup";

type AuthShellProps = {
  mode: AuthMode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

function AuthModeTabs({ mode }: { mode: AuthMode }) {
  const tabs = [
    { id: "signin" as const, label: "Sign in", href: "/signin" },
    { id: "signup" as const, label: "Create account", href: "/signup" },
  ];

  return (
    <div
      className="relative mb-8 grid grid-cols-2 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10"
      role="tablist"
      aria-label="Authentication mode"
    >
      <div
        className={`pointer-events-none absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-violet-900/40 transition-all duration-300 ease-out ${
          mode === "signup" ? "left-[calc(50%+2px)]" : "left-1"
        }`}
        aria-hidden="true"
      />
      {tabs.map((tab) => {
        const isActive = tab.id === mode;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`relative z-10 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors duration-200 ${
              isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function AuthShell({
  mode,
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a14] px-4 py-12">
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 animate-auth-orb rounded-full bg-indigo-600/25 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 animate-auth-orb-delayed rounded-full bg-violet-600/20 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-purple-500/10 blur-[80px]"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md animate-auth-fade-up">
        <div className="auth-glass-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-10">
          <div className="auth-shimmer-sweep pointer-events-none absolute inset-0" aria-hidden="true" />

          <div className="relative">
            <div className="mb-6 flex justify-center">
              <EvalAILogo variant="dark" size="md" />
            </div>

            <AuthModeTabs mode={mode} />

            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.65rem]">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{subtitle}</p>
            </div>

            {children}

            <p className="mt-8 text-center text-sm text-zinc-500">{footer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
