"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  STRENGTH_LABELS,
  STRENGTH_SEGMENT_COLORS,
  getPasswordStrength,
  isValidEmail,
} from "@/components/auth/auth-utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthFieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  validateEmail?: boolean;
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
  validateEmail = false,
  placeholder,
}: AuthFieldProps) {
  const [touched, setTouched] = useState(false);
  const showValid = validateEmail && value.length > 0 && isValidEmail(value);
  const showInvalid = validateEmail && touched && value.length > 0 && !isValidEmail(value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        aria-invalid={showInvalid || undefined}
        className={cn(
          "h-10 transition-colors",
          showValid && "border-emerald-500/70 ring-3 ring-emerald-500/20",
          showInvalid && "border-destructive ring-3 ring-destructive/20",
        )}
      />
      {showInvalid && (
        <p className="animate-auth-fade-in text-xs text-destructive">
          Enter a valid email address
        </p>
      )}
    </div>
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
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              strength >= level ? STRENGTH_SEGMENT_COLORS[level - 1] : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Strength:{" "}
        <span
          className={cn(
            "font-medium",
            strength <= 1 && "text-destructive",
            strength === 2 && "text-orange-500",
            strength === 3 && "text-primary",
            strength >= 4 && "text-emerald-600",
          )}
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

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          className="h-10 pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
    <div className="flex items-start gap-3">
      <Checkbox
        id="terms"
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <Label htmlFor="terms" className="cursor-pointer text-sm leading-snug font-normal text-muted-foreground">
        I agree to the{" "}
        <span className="text-primary">Terms of Service</span> and{" "}
        <span className="text-primary">Privacy Policy</span>
      </Label>
    </div>
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
      <div className="flex items-center gap-2">
        <Checkbox
          id="remember"
          checked={remember}
          onCheckedChange={(value) => onRememberChange(value === true)}
        />
        <Label htmlFor="remember" className="cursor-pointer font-normal text-muted-foreground">
          Remember me
        </Label>
      </div>
      <Button
        type="button"
        variant="link"
        onClick={onForgotPassword}
        className="h-auto px-0 text-primary"
      >
        Forgot password?
      </Button>
    </div>
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
    <Button
      type="submit"
      disabled={isDisabled}
      size="lg"
      className="h-10 w-full transition-all active:scale-[0.98]"
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {loading ? loadingLabel : label}
    </Button>
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
        className="font-semibold text-primary underline-offset-4 transition-colors hover:underline"
      >
        {linkText}
      </Link>
    </>
  );
}
