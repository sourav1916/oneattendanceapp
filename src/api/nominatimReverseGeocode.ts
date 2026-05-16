import axios from 'axios';

import { APP_PORTAL_URL } from '@src/utils/config';

/** OpenStreetMap Nominatim — see https://operations.osmfoundation.org/policies/nominatim/ */
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/reverse';
const MIN_INTERVAL_MS = 1100;
const USER_AGENT = `One Attendance/1.0 (${APP_PORTAL_URL}; attendance app)`;

export type NominatimReverseJson = {
  display_name?: string;
  lat?: string;
  lon?: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
  licence?: string;
};

const fullJsonCache = new Map<string, NominatimReverseJson | null>();

let queue: Promise<void> = Promise.resolve();
let hasCompletedRequest = false;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    if (hasCompletedRequest) {
      await delay(MIN_INTERVAL_MS);
    }
    try {
      return await task();
    } finally {
      hasCompletedRequest = true;
    }
  });
  queue = next.then(() => undefined).catch(() => undefined);
  return next;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchReverseJson(latN: string, lonN: string): Promise<NominatimReverseJson | null> {
  const url = `${NOMINATIM_BASE}?format=jsonv2&lat=${encodeURIComponent(latN)}&lon=${encodeURIComponent(lonN)}`;
  try {
    const { data } = await axios.get<NominatimReverseJson>(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    });
    return data ?? null;
  } catch {
    return null;
  }
}

function coordKey(lat: string, lon: string): string {
  return `${String(lat).trim()},${String(lon).trim()}`;
}

async function loadReverse(latN: string, lonN: string): Promise<NominatimReverseJson | null> {
  const key = coordKey(latN, lonN);
  if (fullJsonCache.has(key)) {
    return fullJsonCache.get(key) ?? null;
  }
  return enqueue(async () => {
    if (fullJsonCache.has(key)) {
      return fullJsonCache.get(key) ?? null;
    }
    try {
      const data = await fetchReverseJson(latN, lonN);
      fullJsonCache.set(key, data);
      return data;
    } catch {
      fullJsonCache.set(key, null);
      return null;
    }
  });
}

export async function reverseGeocode(lat: string, lon: string): Promise<string | null> {
  const latN = String(lat).trim();
  const lonN = String(lon).trim();
  const data = await loadReverse(latN, lonN);
  if (!data || typeof data.display_name !== 'string' || !data.display_name.trim()) {
    return null;
  }
  return data.display_name.trim();
}

export async function reverseGeocodeFull(
  lat: string,
  lon: string,
): Promise<NominatimReverseJson | null> {
  const latN = String(lat).trim();
  const lonN = String(lon).trim();
  return loadReverse(latN, lonN);
}
