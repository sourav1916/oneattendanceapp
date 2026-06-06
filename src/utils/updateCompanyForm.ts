import type { CompanyListItem } from '@src/types/companyList';
import type { AttendanceMethod, UpdateCompanyPayload } from '@src/types/updateCompany';

const NAME_MAX_LEN = 255;
const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;

export const ATTENDANCE_METHOD_OPTIONS: AttendanceMethod[] = ['manual', 'gps', 'ip'];

function trimOrEmpty(value: string): string {
  return value.trim();
}

function trimOrNull(value: string): string | null {
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseCompanyIps(value: string): string[] {
  return value
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

function normalizeMethods(methods: string[]): AttendanceMethod[] {
  const allowed = new Set(ATTENDANCE_METHOD_OPTIONS);
  return methods
    .map(m => m.trim().toLowerCase())
    .filter((m): m is AttendanceMethod => allowed.has(m as AttendanceMethod));
}

export type UpdateCompanyFormState = {
  name: string;
  legalName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: string;
  longitude: string;
  transactionCurrency: string;
  maxDistance: string;
  companyIps: string;
  clearIps: boolean;
  isActive: boolean;
  attendanceMethods: AttendanceMethod[];
  newLogoUrl: string | null;
};

export function companyToFormState(company: CompanyListItem): UpdateCompanyFormState {
  return {
    name: company.name,
    legalName: company.legal_name ?? '',
    addressLine1: company.address_line1 ?? '',
    addressLine2: company.address_line2 ?? '',
    city: company.city ?? '',
    state: company.state ?? '',
    postalCode: company.postal_code ?? '',
    country: company.country ?? '',
    latitude: company.latitude != null ? String(company.latitude) : '',
    longitude: company.longitude != null ? String(company.longitude) : '',
    transactionCurrency: company.transaction_currency ?? '',
    maxDistance: company.max_distance != null ? String(company.max_distance) : '',
    companyIps: company.company_ips.join(', '),
    clearIps: false,
    isActive: company.is_active,
    attendanceMethods: normalizeMethods(company.attendance_methods),
    newLogoUrl: null,
  };
}

export type ValidateUpdateCompanyResult =
  | { ok: true }
  | { ok: false; errorKey: string; errorParams?: Record<string, unknown> };

export function validateUpdateCompanyForm(
  form: UpdateCompanyFormState,
  logoUploading: boolean,
  pendingLogo: boolean,
): ValidateUpdateCompanyResult {
  const name = trimOrEmpty(form.name);
  if (!name) {
    return { ok: false, errorKey: 'home.companyList.updateModal.errors.nameRequired' };
  }
  if (name.length > NAME_MAX_LEN) {
    return { ok: false, errorKey: 'home.companyList.updateModal.errors.nameTooLong' };
  }
  if (logoUploading) {
    return { ok: false, errorKey: 'home.companyList.updateModal.errors.logoUploading' };
  }
  if (pendingLogo && !form.newLogoUrl?.trim()) {
    return { ok: false, errorKey: 'home.companyList.updateModal.errors.logoUploadPending' };
  }
  if (form.latitude.trim()) {
    const lat = parseOptionalNumber(form.latitude);
    if (lat == null || lat < -90 || lat > 90) {
      return { ok: false, errorKey: 'home.companyList.updateModal.errors.invalidLatitude' };
    }
  }
  if (form.longitude.trim()) {
    const lng = parseOptionalNumber(form.longitude);
    if (lng == null || lng < -180 || lng > 180) {
      return { ok: false, errorKey: 'home.companyList.updateModal.errors.invalidLongitude' };
    }
  }
  if (form.maxDistance.trim()) {
    const max = parseOptionalNumber(form.maxDistance);
    if (max == null || max < 0) {
      return { ok: false, errorKey: 'home.companyList.updateModal.errors.invalidMaxDistance' };
    }
  }
  if (!form.clearIps && form.companyIps.trim()) {
    const ips = parseCompanyIps(form.companyIps);
    for (const ip of ips) {
      if (!IPV4_RE.test(ip)) {
        return {
          ok: false,
          errorKey: 'home.companyList.updateModal.errors.invalidIp',
          errorParams: { ip },
        };
      }
    }
  }
  if (form.attendanceMethods.length === 0) {
    return { ok: false, errorKey: 'home.companyList.updateModal.errors.methodsRequired' };
  }
  return { ok: true };
}

export function buildUpdateCompanyPayload(
  company: CompanyListItem,
  form: UpdateCompanyFormState,
): UpdateCompanyPayload | null {
  const payload: UpdateCompanyPayload = { id: company.id };
  let hasChange = false;

  const name = trimOrEmpty(form.name);
  if (name !== company.name) {
    payload.name = name;
    hasChange = true;
  }

  const legal = trimOrNull(form.legalName);
  const prevLegal = company.legal_name?.trim() || null;
  if (legal !== prevLegal) {
    payload.legal_name = legal ?? '';
    hasChange = true;
  }

  const logo = form.newLogoUrl?.trim();
  if (logo) {
    payload.logo_url = logo;
    hasChange = true;
  }

  if (form.isActive !== company.is_active) {
    payload.is_active = form.isActive;
    hasChange = true;
  }

  const addressFields: Array<{
    key: keyof UpdateCompanyPayload;
    value: string;
    prev: string | null;
  }> = [
    { key: 'address_line1', value: form.addressLine1, prev: company.address_line1 },
    { key: 'address_line2', value: form.addressLine2, prev: company.address_line2 },
    { key: 'city', value: form.city, prev: company.city },
    { key: 'state', value: form.state, prev: company.state },
    { key: 'postal_code', value: form.postalCode, prev: company.postal_code },
    { key: 'country', value: form.country, prev: company.country },
  ];

  for (const field of addressFields) {
    const next = trimOrNull(field.value);
    const prev = field.prev?.trim() || null;
    if (next !== prev) {
      (payload as Record<string, unknown>)[field.key] = next ?? '';
      hasChange = true;
    }
  }

  const lat = parseOptionalNumber(form.latitude);
  const prevLat = company.latitude;
  if ((lat ?? null) !== (prevLat ?? null)) {
    if (lat != null) {
      payload.latitude = lat;
    }
    hasChange = true;
  }

  const lng = parseOptionalNumber(form.longitude);
  const prevLng = company.longitude;
  if ((lng ?? null) !== (prevLng ?? null)) {
    if (lng != null) {
      payload.longitude = lng;
    }
    hasChange = true;
  }

  const currency = trimOrNull(form.transactionCurrency);
  const prevCurrency = company.transaction_currency?.trim() || null;
  if (currency !== prevCurrency) {
    payload.transaction_currency = currency ?? '';
    hasChange = true;
  }

  const maxDistance = parseOptionalNumber(form.maxDistance);
  const prevMax = company.max_distance;
  if ((maxDistance ?? null) !== (prevMax ?? null)) {
    if (maxDistance != null) {
      payload.max_distance = maxDistance;
    }
    hasChange = true;
  }

  if (form.clearIps) {
    payload.clear_ips = true;
    hasChange = true;
  } else {
    const ips = parseCompanyIps(form.companyIps);
    if (!arraysEqual(ips, company.company_ips)) {
      payload.company_ips = ips;
      hasChange = true;
    }
  }

  const methods = form.attendanceMethods;
  if (!arraysEqual(methods, normalizeMethods(company.attendance_methods))) {
    payload.attendance_methods = methods;
    hasChange = true;
  }

  return hasChange ? payload : null;
}
