import { APP_PORTAL_URL, COMPANY_DISPLAY_NAME } from '@src/utils/config';

/**
 * About screen — edit these values to match your product / company details.
 * Keep `appVersion` in sync with `android/app/build.gradle` (`versionName`) and iOS `CFBundleShortVersionString`.
 */
export const ABOUT_APP = {
  /** Shown under the logo on the About screen. */
  appDisplayName: COMPANY_DISPLAY_NAME,
  appTagline: 'Employee attendance, leave, and workforce insights in one place.',
  /** Semantic version shown to users (e.g. 1.0.0). */
  appVersion: '1.0',
  /** Optional build / release label (e.g. 42). Leave empty to hide. */
  appBuildNumber: '',

  companyLegalName: 'OneSaaS India Pvt. Ltd.',
  companyBrandName: 'OneSaaS',
  companyWebsite: 'https://onesaas.in',
  productPortalUrl: APP_PORTAL_URL,
  contactEmail: 'support@onesaas.in',
  contactPhone: '+91 9826000001',

  address: {
    line1: '123 Business Park, Sector 62',
    line2: 'Noida',
    state: 'Uttar Pradesh',
    postalCode: '201301',
    country: 'India',
  },

  legal: {
    privacyPolicyUrl: 'https://attendance.onesaas.in/privacy',
    termsOfServiceUrl: 'https://attendance.onesaas.in/terms',
  },

  /** First year shown in the copyright line (e.g. 2024). */
  copyrightStartYear: 2024,
} as const;

export type AboutAppFeature = {
  icon: 'clock-check-outline' | 'calendar-check-outline' | 'chart-box-outline' | 'office-building-outline';
  titleKey: string;
  descriptionKey: string;
  accent: string;
  tint: string;
};

/** Highlight cards on the About screen — titles/descriptions come from i18n keys. */
export const ABOUT_APP_FEATURES: AboutAppFeature[] = [
  {
    icon: 'clock-check-outline',
    titleKey: 'settings.aboutScreen.features.punch.title',
    descriptionKey: 'settings.aboutScreen.features.punch.description',
    accent: '#0d9488',
    tint: '#ccfbf1',
  },
  {
    icon: 'calendar-check-outline',
    titleKey: 'settings.aboutScreen.features.leave.title',
    descriptionKey: 'settings.aboutScreen.features.leave.description',
    accent: '#2563eb',
    tint: '#dbeafe',
  },
  {
    icon: 'chart-box-outline',
    titleKey: 'settings.aboutScreen.features.reports.title',
    descriptionKey: 'settings.aboutScreen.features.reports.description',
    accent: '#7c3aed',
    tint: '#ede9fe',
  },
  {
    icon: 'office-building-outline',
    titleKey: 'settings.aboutScreen.features.multiCompany.title',
    descriptionKey: 'settings.aboutScreen.features.multiCompany.description',
    accent: '#ea580c',
    tint: '#ffedd5',
  },
];
