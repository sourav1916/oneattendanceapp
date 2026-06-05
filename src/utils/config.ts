import { Platform } from 'react-native';

export const API_ENDPOINT = 'https://api-attendance.onesaas.in';

/**
 * Truecaller OAuth (Android). Create a client ID at
 * https://developer.truecaller.com — package `in.onesaas.attendance`, SHA-1 in `context/SHA.md`.
 * Must match `TRUECALLER_ANDROID_CLIENT_ID` in `android/gradle.properties`.
 */
export const TRUECALLER_ANDROID_CLIENT_ID = 'nttf4gwxb5is457f2hzqoaqkahyokj1_21vsb7ul-i4';

/** iOS Truecaller (optional; SDK integration still maturing in the RN wrapper). */
export const TRUECALLER_IOS_APP_KEY = '';
export const TRUECALLER_IOS_APP_LINK = '';

export function isTruecallerConfigured(): boolean {
    if (Platform.OS === 'android') {
        return TRUECALLER_ANDROID_CLIENT_ID.trim().length > 0;
    }
    if (Platform.OS === 'ios') {
        return (
            TRUECALLER_IOS_APP_KEY.trim().length > 0 &&
            TRUECALLER_IOS_APP_LINK.trim().length > 0
        );
    }
    return false;
}

/** Product / marketing site (web app). */
export const APP_PORTAL_URL = 'https://attendance.onesaas.in';

/**
 * Zwitch PG access key (public) — same as web `Layer.checkout({ accesskey })`.
 * Dashboard → Developers → **PG API Keys** (not API Keys). Must match the environment
 * your server uses when creating `payment_token` (sandbox vs live).
 */
export const ZWITCH_OPEN_ACCESS_KEY = 'ebab5ff3-8ff5-423c-b1bf-4f5a0f99fec0';

/**
 * Must match web Layer script: sandbox → `sandbox-payments.open.money/layer`,
 * live → `payments.open.money/layer` (see test.html / Zwitch docs).
 */
export const ZWITCH_PAYMENT_ENVIRONMENT: 'sandbox' | 'live' = 'live';

/**
 * Shown on the Zwitch checkout screen (`setCompanyLogo`).
 * Keep in sync with `COMPANY_LOGO_URL` in `ZwitchPaymentModule.kt`.
 */
export const ZWITCH_COMPANY_LOGO_URL =
    'https://ooms.in/uploads/ooms/logo.png';

/** Shown in the main app top bar when no company is selected. */
export const COMPANY_DISPLAY_NAME = 'One Attendance';

export const SUPPORT = {
    "email": [
        // {
        //     "type": "sales",
        //     "email": "sales@onesaas.in"
        // },
        {
            "type": "support",
            "email": "support@onesaas.in"
        },
        {
            "type": "technical",
            "email": "technical@onesaas.in"
        }
    ],
    "call": [
        {
            "type": "sales",
            "call": "+91 9826000000"
        },
        {
            "type": "support",
            "call": "+91 9826000001"
        },
        // {
        //     "type": "technical",
        //     "call": "+91 9826000002"
        // }
    ],
    "whatsapp": [
        // {
        //     "type": "sales",
        //     "whatsapp": "+91 9826000000"
        // },
        {
            "type": "support",
            "whatsapp": "+91 9826000001"
        },
        // {
        //     "type": "technical",
        //     "whatsapp": "+91 9826000002"
        // }
    ]
}

/**
 * Google Cloud project (from OAuth client JSON: `project_id`).
 * Project number: 1099166791217
 */
export const GOOGLE_CLOUD_PROJECT_ID = 'project-28ae857c-dd8c-48c3-bc6';

/**
 * Android OAuth client ID (from downloaded `client_secret_*.json`, `"installed"` block).
 * Must be registered in GCP with package `in.onesaas.attendance` + debug SHA-1 (context/SHA.md).
 * Do not pass this to the SDK as `webClientId`.
 */
export const GOOGLE_ANDROID_CLIENT_ID =
    '1099166791217-gv208acpiqat45qg263n6jhuifu7vvji.apps.googleusercontent.com';

/**
 * Web OAuth client ID — required by `@react-native-google-signin` as `webClientId` (type: Web application).
 * Create in the same GCP project → Credentials → OAuth 2.0 → Create → Web application.
 * If empty, Google Sign-In returns DEVELOPER_ERROR even when Android client exists.
 */
export const GOOGLE_WEB_CLIENT_ID = '1099166791217-ejpnup928oqaitbkjlu7sa7gvuhq5om5.apps.googleusercontent.com';