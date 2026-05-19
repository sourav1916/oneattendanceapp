import type {
  ProfileEmployeeCompany,
  ProfileOwnedCompany,
  StoredSelectedCompany,
} from '@src/types/company';

function toStored(
  row: ProfileOwnedCompany | ProfileEmployeeCompany,
  relation: StoredSelectedCompany['relation'],
): StoredSelectedCompany | null {
  const id = row.id;
  if (typeof id !== 'number') {
    return null;
  }
  const legal =
    'legal_name' in row && typeof row.legal_name === 'string'
      ? row.legal_name.trim()
      : '';
  const nm = typeof row.name === 'string' ? row.name.trim() : '';
  const displayName = nm || legal;
  if (!displayName) {
    return null;
  }
  const logoRaw = row.logo_url;
  const logo_url =
    typeof logoRaw === 'string' && logoRaw.trim() ? logoRaw.trim() : null;
  const role = typeof row.role === 'string' ? row.role : undefined;
  return { id, name: displayName, logo_url, role, relation };
}

/**
 * Merges `owned_companies` and employment `companies` with stable de-dupe by `id`
 * (prefer the owned entry when both exist).
 */
export function companiesFromProfileRole(payload: {
  owned_companies?: ProfileOwnedCompany[];
  companies?: ProfileEmployeeCompany[];
}): StoredSelectedCompany[] {
  const byId = new Map<number, StoredSelectedCompany>();

  for (const raw of payload.owned_companies ?? []) {
    const c = toStored(raw, 'owned');
    if (c) {
      byId.set(c.id, c);
    }
  }
  for (const raw of payload.companies ?? []) {
    const c = toStored(raw, 'employee');
    if (!c) {
      continue;
    }
    if (!byId.has(c.id)) {
      byId.set(c.id, c);
    }
  }

  return Array.from(byId.values());
}

/** Stable compare for profile-role company lists (order-independent). */
export function companiesListEqual(
  a: readonly StoredSelectedCompany[],
  b: readonly StoredSelectedCompany[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortKey = (c: StoredSelectedCompany) => `${c.id}:${c.relation}`;
  const sortedA = [...a].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  const sortedB = [...b].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  return sortedA.every((item, i) => {
    const other = sortedB[i]!;
    return (
      item.id === other.id &&
      item.name === other.name &&
      item.relation === other.relation &&
      (item.logo_url ?? null) === (other.logo_url ?? null) &&
      (item.role ?? '') === (other.role ?? '')
    );
  });
}
