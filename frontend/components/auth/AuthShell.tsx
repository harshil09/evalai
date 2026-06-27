"use client";

import Link from "next/link";
import EvalAILogo from "@/components/auth/EvalAILogo";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
      role="tablist"
      aria-label="Authentication mode"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === mode;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "rounded-md px-4 py-2 text-center text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--accent)_0%,_transparent_50%)] opacity-60"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md animate-auth-fade-up">
        <Card className="shadow-lg ring-1 ring-border/80">
          <CardHeader className="gap-5">
            <EvalAILogo size="sm" />
            <AuthModeTabs mode={mode} />
            <div className="space-y-1.5">
              <CardTitle className="text-xl font-semibold tracking-tight">{title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">{subtitle}</CardDescription>
            </div>
          </CardHeader>

          <CardContent>{children}</CardContent>

          <CardFooter className="justify-center border-0 bg-transparent pt-0 text-sm text-muted-foreground">
            {footer}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
