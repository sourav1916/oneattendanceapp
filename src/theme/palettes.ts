export type AppThemeColors = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryPressed: string;
  border: string;
  danger: string;
  /** Secondary / ghost button fill */
  secondaryButton: string;
  /** Modal overlay scrim */
  overlay: string;
};

export const lightTheme: AppThemeColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  primary: '#2563eb',
  primaryPressed: '#1d4ed8',
  border: '#e2e8f0',
  danger: '#dc2626',
  secondaryButton: '#f1f5f9',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

export const darkTheme: AppThemeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  primary: '#60a5fa',
  primaryPressed: '#3b82f6',
  border: '#334155',
  danger: '#f87171',
  secondaryButton: '#334155',
  overlay: 'rgba(0, 0, 0, 0.65)',
};
