import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StoredSelectedCompany } from '@src/types/company';

const SELECTED_COMPANY_KEY = '@oneattendance/selectedCompanyJson';

export async function saveSelectedCompany(
  company: StoredSelectedCompany,
): Promise<void> {
  await AsyncStorage.setItem(SELECTED_COMPANY_KEY, JSON.stringify(company));
}

export async function loadSelectedCompany(): Promise<StoredSelectedCompany | null> {
  const raw = await AsyncStorage.getItem(SELECTED_COMPANY_KEY);
  if (!raw?.trim()) {
    return null;
  }
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') {
      return null;
    }
    const obj = o as Record<string, unknown>;
    const id = obj.id;
    const name = obj.name;
    const relation = obj.relation;
    const logo_url = obj.logo_url;
    if (typeof id !== 'number' || typeof name !== 'string' || typeof relation !== 'string') {
      return null;
    }
    const relOk = relation === 'owned' || relation === 'employee';
    if (!relOk || !name.trim()) {
      return null;
    }
    return {
      id,
      name: name.trim(),
      logo_url:
        typeof logo_url === 'string' && logo_url.trim() ? logo_url.trim() : null,
      role: typeof obj.role === 'string' ? obj.role : undefined,
      relation,
    };
  } catch {
    return null;
  }
}

export async function clearSelectedCompany(): Promise<void> {
  await AsyncStorage.removeItem(SELECTED_COMPANY_KEY);
}
