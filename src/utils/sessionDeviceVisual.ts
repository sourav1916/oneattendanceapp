export type SessionDeviceIcon = 'cellphone' | 'tablet' | 'laptop' | 'monitor';

export type SessionDeviceVisual = {
  icon: SessionDeviceIcon;
  accent: string;
  tint: string;
};

const DEFAULT_VISUAL: SessionDeviceVisual = {
  icon: 'monitor',
  accent: '#6366f1',
  tint: '#eef2ff',
};

const CURRENT_VISUAL: SessionDeviceVisual = {
  icon: 'cellphone',
  accent: '#0d9488',
  tint: '#ccfbf1',
};

export function resolveSessionDeviceVisual(
  userAgent: string,
  deviceName: string,
  isCurrent: boolean,
): SessionDeviceVisual {
  if (isCurrent) {
    return CURRENT_VISUAL;
  }
  const haystack = `${userAgent} ${deviceName}`.toLowerCase();
  if (/ipad|tablet/.test(haystack)) {
    return { icon: 'tablet', accent: '#7c3aed', tint: '#ede9fe' };
  }
  if (/iphone|android|mobile|phone/.test(haystack)) {
    return { icon: 'cellphone', accent: '#0891b2', tint: '#cffafe' };
  }
  if (/windows|macintosh|mac os|linux|laptop/.test(haystack)) {
    return { icon: 'laptop', accent: '#2563eb', tint: '#dbeafe' };
  }
  return DEFAULT_VISUAL;
}

export function sessionDeviceTint(scheme: 'light' | 'dark', visual: SessionDeviceVisual): string {
  return scheme === 'dark' ? `${visual.accent}22` : visual.tint;
}
