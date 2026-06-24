"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type AuthMode = "signin" | "signup";

type AuthShellProps = {
  mode: AuthMode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

const FLOW_STEPS = [
  {
    label: "Upload",
    description: "Drop your .txt or .md transcript",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 7 7m-7-7-7 7" />
      </svg>
    ),
  },
  {
    label: "Analyze",
    description: "12 efficiency dimensions scored",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2" />
      </svg>
    ),
  },
  {
    label: "PDF report",
    description: "Download your full analysis",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
    ),
  },
] as const;

function AuthModeTabs({ mode }: { mode: AuthMode }) {
  const pathname = usePathname();

  const tabs = [
    { id: "signin" as const, label: "Sign in", href: "/signin" },
    { id: "signup" as const, label: "Sign up", href: "/signup" },
  ];

  return (
    <div
      className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
      role="tablist"
      aria-label="Authentication mode"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === mode || pathname === tab.href;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function ProductFlow({ mode }: { mode: AuthMode }) {
  const activeIndex = mode === "signup" ? 0 : 2;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="mt-8 animate-auth-fade-in">
      <div className="relative flex items-start justify-between gap-2">
        <div
          className="absolute left-[16%] right-[16%] top-5 h-0.5 overflow-hidden rounded-full bg-slate-200"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-500 ease-out"
            style={{ width: `${(activeIndex / (FLOW_STEPS.length - 1)) * 100}%` }}
          />
        </div>

        {FLOW_STEPS.map((step, index) => {
          const isActive = index <= activeIndex;
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={step.label}
              className="relative z-10 flex flex-1 flex-col items-center"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  isActive
                    ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-200"
                    : "border-slate-200 bg-white text-slate-400"
                } ${isHovered ? "scale-110" : "scale-100"}`}
              >
                {step.icon}
              </div>
              <p
                className={`mt-2 text-xs font-medium transition-colors ${
                  isActive ? "text-violet-700" : "text-slate-400"
                }`}
              >
                {step.label}
              </p>
              <p
                className={`mt-0.5 max-w-[90px] text-center text-[10px] leading-tight transition-all duration-200 ${
                  isHovered ? "text-slate-600 opacity-100" : "text-transparent opacity-0"
                }`}
              >
                {step.description}
              </p>
            </div>
          );
        })}
      </div>
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-4 py-12">
      <div
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 animate-auth-pulse-soft rounded-full bg-violet-200/40 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-1/4 h-72 w-72 animate-auth-pulse-soft rounded-full bg-fuchsia-200/30 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md animate-auth-fade-up">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow duration-300 hover:shadow-md sm:p-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">
              EvalAI
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>
          </div>

          <div className="mt-8">
            <AuthModeTabs mode={mode} />
            {children}
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>
        </div>

        <ProductFlow mode={mode} />
      </div>
    </div>
  );
}
