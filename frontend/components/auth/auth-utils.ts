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

/** Per-segment colors: red → orange → indigo → green */
export const STRENGTH_SEGMENT_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-indigo-500",
  "bg-emerald-500",
] as const;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
