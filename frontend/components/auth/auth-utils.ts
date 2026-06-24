export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 0;

  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

  return Math.min(score, 4) as PasswordStrength;
}

export const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"] as const;

export const STRENGTH_COLORS = [
  "bg-slate-200",
  "bg-red-400",
  "bg-amber-400",
  "bg-violet-500",
  "bg-emerald-500",
] as const;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
