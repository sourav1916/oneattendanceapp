const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** API format: `+91 9876543210` (country code, space, national digits). */
export function formatPhoneForApi(countryCode: string, nationalNumber: string): string {
  const codeDigits = countryCode.trim().replace(/\D/g, '');
  const code = `+${codeDigits}`;
  const digits = nationalNumber.replace(/\D/g, '');
  return `${code} ${digits}`;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidNationalMobile(digits: string): boolean {
  const cleaned = digits.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}
