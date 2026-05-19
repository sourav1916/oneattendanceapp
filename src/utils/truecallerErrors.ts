function extractTruecallerErrorText(message: string): string {
  const trimmed = message.trim();
  if (!trimmed.startsWith('{')) {
    return trimmed;
  }
  try {
    const parsed = JSON.parse(trimmed) as { message?: unknown };
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // Fall through to the raw string.
  }
  return trimmed;
}

/**
 * Truecaller SDK / consent UI errors that mean the user closed or denied the flow.
 * These should not surface as blocking alerts on the login screen.
 */
export function isTruecallerUserDismissal(message: string): boolean {
  const normalized = extractTruecallerErrorText(message).toLowerCase();
  if (!normalized) {
    return true;
  }

  const dismissalPhrases = [
    'user denied',
    'user cancelled',
    'user canceled',
    'cancelled by user',
    'canceled by user',
    'consent denied',
    'consent not granted',
    'consent dismissed',
    'permission denied',
    'permission not granted',
    'verification cancelled',
    'verification canceled',
    'verification dismissed',
    'user_denied',
    'user_cancelled',
    'user_canceled',
    'activity cancelled',
    'activity canceled',
    'request cancelled',
    'request canceled',
    'flow cancelled',
    'flow canceled',
    'declined',
    'dismissed',
    'aborted',
    // SDK / bridge messages observed when the user backs out of consent
    'truecaller authentication failed',
    'truecaller authenticcation failed',
  ];

  if (dismissalPhrases.some(phrase => normalized.includes(phrase))) {
    return true;
  }

  const dismissalPatterns = [
    /\bcancel(led|lation)?\b/,
    /\bdismiss(ed|al)?\b/,
    /\bdenied\b/,
    /\bnot\s+granted\b/,
    /\buser\s+denied\b/,
  ];

  return dismissalPatterns.some(pattern => pattern.test(normalized));
}
