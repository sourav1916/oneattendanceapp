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
