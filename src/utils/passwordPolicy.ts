/** Any non–letter/digit/whitespace counts as a special character for policy checks. */
const HAS_SPECIAL_RE = /[^A-Za-z0-9\s]/;

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordPolicyAnalysis = {
  minLength: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
  noEdgeSpaces: boolean;
};

export function analyzePasswordPolicy(password: string): PasswordPolicyAnalysis {
  const noEdgeSpaces = password === password.trim();
  const value = password.trim();

  return {
    noEdgeSpaces,
    minLength: value.length >= MIN_PASSWORD_LENGTH,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    digit: /\d/.test(value),
    special: HAS_SPECIAL_RE.test(value),
  };
}

export function isPasswordPolicySatisfied(analysis: PasswordPolicyAnalysis): boolean {
  return (
    analysis.noEdgeSpaces &&
    analysis.minLength &&
    analysis.upper &&
    analysis.lower &&
    analysis.digit &&
    analysis.special
  );
}

export function validatePasswordWithConfirm(
  password: string,
  confirmPassword: string,
): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (password !== password.trim()) {
    return 'Password must not have leading or trailing spaces.';
  }

  const analysis = analyzePasswordPolicy(password);
  if (!analysis.minLength) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!analysis.upper) {
    return 'Password must include at least one uppercase letter.';
  }
  if (!analysis.lower) {
    return 'Password must include at least one lowercase letter.';
  }
  if (!analysis.digit) {
    return 'Password must include at least one number.';
  }
  if (!analysis.special) {
    return 'Password must include at least one special character.';
  }
  if (!confirmPassword) {
    return 'Please confirm your password.';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
}
