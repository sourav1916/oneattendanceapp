import countryCodeJson from './CountryCode.json';

export type CountryCodeJsonEntry = {
  name: string;
  code: string;
  dial_code: string;
};

export type LoginCountry = {
  name: string;
  code: string;
  dialCode: string;
  /** Lowercase name + ISO + dial digits for search. */
  searchText: string;
};

function toLoginCountry(entry: CountryCodeJsonEntry): LoginCountry {
  const dialCode = `+${entry.dial_code}`;
  const searchText = `${entry.name} ${entry.code} ${dialCode} ${entry.dial_code}`.toLowerCase();
  return {
    name: entry.name,
    code: entry.code,
    dialCode,
    searchText,
  };
}

export const LOGIN_COUNTRIES: LoginCountry[] = (
  countryCodeJson as CountryCodeJsonEntry[]
)
  .map(toLoginCountry)
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_LOGIN_COUNTRY: LoginCountry =
  LOGIN_COUNTRIES.find(c => c.code === 'IN') ?? LOGIN_COUNTRIES[0]!;

export function findLoginCountryByDialCode(dialCode: string): LoginCountry | undefined {
  const digits = dialCode.trim().replace(/\D/g, '');
  if (!digits) {
    return undefined;
  }
  const normalized = `+${digits}`;
  return LOGIN_COUNTRIES.find(c => c.dialCode === normalized);
}

/** Real-time filter: matches country name, ISO code, or dial code as user types. */
export function filterLoginCountries(query: string): LoginCountry[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return LOGIN_COUNTRIES;
  }

  const q = trimmed.toLowerCase();
  const qDigits = q.replace(/\D/g, '');

  return LOGIN_COUNTRIES.filter(country => {
    if (country.searchText.includes(q)) {
      return true;
    }
    if (qDigits.length > 0 && country.dialCode.replace(/\D/g, '').startsWith(qDigits)) {
      return true;
    }
    return false;
  });
}

/** E.164-style digits without `+` (country code + national). */
export function combinePhoneDigits(country: LoginCountry, nationalDigits: string): string {
  const code = country.dialCode.replace(/\D/g, '');
  const nat = nationalDigits.replace(/\D/g, '');
  return `${code}${nat}`;
}

/** Split stored phone digits into country + national (longest dial-code match). */
export function resolveCountryAndNationalFromDigits(
  fullDigits: string,
  fallback: LoginCountry = DEFAULT_LOGIN_COUNTRY,
): { country: LoginCountry; national: string } {
  const d = fullDigits.replace(/\D/g, '');
  if (!d) {
    return { country: fallback, national: '' };
  }

  const byDialLength = [...LOGIN_COUNTRIES].sort(
    (a, b) => b.dialCode.replace(/\D/g, '').length - a.dialCode.replace(/\D/g, '').length,
  );
  for (const country of byDialLength) {
    const codeDigits = country.dialCode.replace(/\D/g, '');
    if (codeDigits.length > 0 && d.startsWith(codeDigits) && d.length > codeDigits.length) {
      return { country, national: d.slice(codeDigits.length) };
    }
  }

  return { country: fallback, national: d };
}

export function formatPhoneDisplay(country: LoginCountry, nationalDigits: string): string {
  const nat = nationalDigits.replace(/\D/g, '');
  return nat ? `${country.dialCode} ${nat}` : country.dialCode;
}
