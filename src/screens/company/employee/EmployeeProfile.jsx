import Clipboard from '@react-native-clipboard/clipboard';
import { HeaderBackButton } from '@react-navigation/elements';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authHttpClient } from '@src/api/authHttpClient';
import { salaryApi } from '@src/api/salaryApi';
import { AssignSalaryModal } from '@src/components/modals/AssignSalaryModal';
import { LeaveDetailModal } from '@src/components/modals/LeaveDetailModal';
import {
  StatusAlert,
  useStatusAlert,
} from '@src/components/modals/StatusAlert';
import { TAB_SCREEN_SAFE_AREA_EDGES } from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { API_ENDPOINT } from '@src/utils/config';
import {
  buildCalendarGrid,
  computeCalendarSummary,
  formatAttendanceMethod,
  formatCreatedByLabel,
  formatLogTypeLabel,
  formatMonthTitle,
  formatStatusLabel,
  getStatusStyle,
  hasCalendarDayDetails,
  shiftMonth,
} from '@src/utils/calendarHelpers';
import { readApiError } from '@src/utils/readApiError';

const INCLUDE_KEYS = [
  'basic',
  'permissions',
  'attendance',
  'salary',
  'payroll',
  'leaves',
  'shifts',
  'banks',
];

const TAB_THEMES = {
  basic: {
    icon: 'account-circle-outline',
    accent: '#2563eb',
    surface: '#eff6ff',
    border: '#bfdbfe',
  },
  permissions: {
    icon: 'shield-account-outline',
    accent: '#7c3aed',
    surface: '#f5f3ff',
    border: '#ddd6fe',
  },
  attendance: {
    icon: 'calendar-check-outline',
    accent: '#059669',
    surface: '#ecfdf5',
    border: '#a7f3d0',
  },
  salary: {
    icon: 'currency-inr',
    accent: '#d97706',
    surface: '#fffbeb',
    border: '#fde68a',
  },
  payroll: {
    icon: 'cash-multiple',
    accent: '#0891b2',
    surface: '#ecfeff',
    border: '#a5f3fc',
  },
  leaves: {
    icon: 'beach',
    accent: '#db2777',
    surface: '#fdf2f8',
    border: '#fbcfe8',
  },
  shifts: {
    icon: 'clock-outline',
    accent: '#4f46e5',
    surface: '#eef2ff',
    border: '#c7d2fe',
  },
  banks: {
    icon: 'bank-outline',
    accent: '#0d9488',
    surface: '#f0fdfa',
    border: '#99f6e4',
  },
};

const DATE_KEY_PATTERN =
  /(^date$|_date$|_at$|^from$|^to$|joining|birth|start|end|expiry|valid)/i;

const BASIC_FIELD_KEYS = [
  'phone',
  'designation',
  'employment_type',
  'salary_type',
  'joining_date',
  'status',
];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SUMMARY_KEYS = [
  { key: 'present', labelKey: 'present', status: 'present' },
  { key: 'absent', labelKey: 'absent', status: 'absent' },
  { key: 'leave', labelKey: 'leave', status: 'leave' },
  { key: 'holiday', labelKey: 'holiday', status: 'holiday' },
  { key: 'weekend', labelKey: 'weekend', status: 'weekend' },
  { key: 'half_day', labelKey: 'halfDay', status: 'half_day' },
  { key: 'upcoming', labelKey: 'upcoming', status: 'upcoming' },
  { key: 'not_joined', labelKey: 'notJoined', status: 'not_joined' },
];
const NON_CLICKABLE_STATUSES = ['not_joined', 'upcoming'];

const PERMISSION_CATEGORY_ICON_MAP = {
  profile: 'account-outline',
  attendance: 'clock-check-outline',
  leave: 'calendar-remove-outline',
  'leave config': 'calendar-cog-outline',
  'leave balance': 'scale-balance',
  employee: 'account-group-outline',
  invite: 'email-send-outline',
  'invite package': 'package-variant-closed',
  shift: 'calendar-clock-outline',
  salary: 'cash-multiple',
  'salary component': 'cash-plus',
  'salary package': 'wallet-outline',
  payroll: 'file-document-outline',
  'payroll adjustment': 'file-edit-outline',
  'bank account': 'bank-outline',
  'employee bank account': 'bank-transfer',
  holiday: 'beach',
  company: 'office-building-outline',
  'company settings': 'office-building-cog-outline',
  'permission package': 'shield-key-outline',
  transaction: 'swap-horizontal',
  'invoice prefix': 'file-table-outline',
  other: 'shield-outline',
};

const PERMISSION_CATEGORY_PALETTES = [
  { border: '#bfdbfe', bg: '#f8fbff', header: '#eff6ff', accent: '#2563eb' },
  { border: '#fde68a', bg: '#fffdf5', header: '#fffbeb', accent: '#b45309' },
  { border: '#bbf7d0', bg: '#f7fef9', header: '#f0fdf4', accent: '#15803d' },
  { border: '#ddd6fe', bg: '#faf8ff', header: '#f5f3ff', accent: '#6d28d9' },
  { border: '#fecaca', bg: '#fffafa', header: '#fef2f2', accent: '#dc2626' },
  { border: '#a5f3fc', bg: '#f5feff', header: '#ecfeff', accent: '#0891b2' },
  { border: '#fbcfe8', bg: '#fffafd', header: '#fdf2f8', accent: '#be185d' },
  { border: '#d9f99d', bg: '#fafef5', header: '#f7fee7', accent: '#4d7c0f' },
];

function formatDateDDMMYYYY(value) {
  if (value == null || value === '') {
    return null;
  }
  const s = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const [, y, mo, d] = iso;
    return `${d}/${mo}/${y}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return null;
}

function formatLeaveDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return String(iso);
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${dd}/${mm}/${yyyy}, ${h12}:${min} ${ampm}`;
}

function leaveStatusColors(status, scheme) {
  switch (status) {
    case 'pending':
      return scheme === 'dark'
        ? {
            bg: 'rgba(251,191,36,0.15)',
            text: '#fbbf24',
            border: 'rgba(251,191,36,0.4)',
          }
        : { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
    case 'approved':
      return scheme === 'dark'
        ? {
            bg: 'rgba(34,197,94,0.15)',
            text: '#4ade80',
            border: 'rgba(34,197,94,0.4)',
          }
        : { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };
    case 'rejected':
      return scheme === 'dark'
        ? {
            bg: 'rgba(239,68,68,0.15)',
            text: '#f87171',
            border: 'rgba(239,68,68,0.4)',
          }
        : { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
    case 'cancelled':
    default:
      return scheme === 'dark'
        ? {
            bg: 'rgba(148,163,184,0.15)',
            text: '#94a3b8',
            border: 'rgba(148,163,184,0.35)',
          }
        : { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
  }
}

function isLeaveApplicationRecord(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }
  return (
    typeof item.start_date === 'string' &&
    ['pending', 'approved', 'rejected', 'cancelled'].includes(item.status)
  );
}

function isLeaveBalanceRecord(item) {
  if (!item || typeof item !== 'object' || isLeaveApplicationRecord(item)) {
    return false;
  }
  const hasBalance =
    item.remaining != null ||
    item.used != null ||
    item.total_allocated != null ||
    item.total != null;
  const hasType =
    item.leave_config_id != null ||
    item.code != null ||
    item.leave_code != null;
  return hasBalance && hasType;
}

function resolveLeaveAttachmentUrl(fileUrl) {
  if (!fileUrl) {
    return '';
  }
  const s = String(fileUrl);
  if (/^https?:\/\//i.test(s)) {
    return s;
  }
  const base = String(API_ENDPOINT).replace(/\/$/, '');
  return `${base}/${s.replace(/^\//, '')}`;
}

function normalizeLeaveBalance(item) {
  const total = Number(item.total_allocated ?? item.total ?? 0) || 0;
  return {
    id: String(
      item.leave_config_id ?? item.code ?? item.leave_code ?? item.name ?? '',
    ),
    code: item.code ?? item.leave_code ?? '—',
    name:
      item.name ??
      item.leave_type ??
      item.leave_type_name ??
      humanizeKey(item.code ?? 'Leave'),
    is_paid: Boolean(item.is_paid),
    year: item.year,
    total,
    used: Number(item.used ?? 0) || 0,
    remaining: Number(item.remaining ?? 0) || 0,
  };
}

function normalizeLeaveApplication(item) {
  const status = ['pending', 'approved', 'rejected', 'cancelled'].includes(
    item.status,
  )
    ? item.status
    : 'pending';
  return {
    id: String(item.id),
    leave_type_id: String(
      item.leave_config_id ?? item.leave_type_id ?? item.leave_code ?? '',
    ),
    leave_type_name:
      item.leave_type ?? item.leave_type_name ?? item.name ?? '—',
    is_paid: Boolean(item.is_paid),
    start_date: item.start_date,
    end_date: item.end_date ?? item.start_date,
    total_days: Number(item.total_days ?? 0),
    is_half_day: Boolean(item.is_half_day),
    half_day_type: item.half_day_type ?? null,
    reason: item.reason ?? '',
    status,
    applied_at: item.applied_at ?? '',
    approval_remarks: item.approval_remarks ?? '',
    attachments: (Array.isArray(item.attachments) ? item.attachments : []).map(
      (att, index) => ({
        id: String(att.id ?? index),
        file_url: resolveLeaveAttachmentUrl(att.file_url),
        original_name:
          att.original_name ??
          String(att.file_url ?? '')
            .split('/')
            .pop() ??
          'file',
        file_type: att.file_type ?? 'file',
      }),
    ),
  };
}

function parseLeavesSectionData(sectionData) {
  const balances = [];
  const applications = [];
  const balanceKeys = new Set();
  const applicationIds = new Set();

  const addBalance = item => {
    const row = normalizeLeaveBalance(item);
    const key = row.id || row.code;
    if (balanceKeys.has(key)) {
      return;
    }
    balanceKeys.add(key);
    balances.push(row);
  };

  const addApplication = item => {
    const row = normalizeLeaveApplication(item);
    if (applicationIds.has(row.id)) {
      return;
    }
    applicationIds.add(row.id);
    applications.push(row);
  };

  const scanArray = (arr, keyHint = '') => {
    const hint = keyHint.toLowerCase();
    if (/balance/.test(hint)) {
      arr.forEach(item => {
        if (isLeaveBalanceRecord(item)) {
          addBalance(item);
        }
      });
      return;
    }
    if (
      /application|request|history|leave/.test(hint) &&
      !/balance/.test(hint)
    ) {
      arr.forEach(item => {
        if (isLeaveApplicationRecord(item)) {
          addApplication(item);
        } else if (isLeaveBalanceRecord(item)) {
          addBalance(item);
        }
      });
      return;
    }
    arr.forEach(item => {
      if (isLeaveApplicationRecord(item)) {
        addApplication(item);
      } else if (isLeaveBalanceRecord(item)) {
        addBalance(item);
      }
    });
  };

  if (Array.isArray(sectionData)) {
    scanArray(sectionData);
  } else if (sectionData && typeof sectionData === 'object') {
    if (Array.isArray(sectionData.section)) {
      scanArray(sectionData.section, 'section');
    }
    for (const [key, value] of Object.entries(sectionData)) {
      if (key === 'section' && Array.isArray(value)) {
        continue;
      }
      if (Array.isArray(value)) {
        scanArray(value, key);
      }
    }
    if (balances.length === 0 && applications.length === 0) {
      if (isLeaveApplicationRecord(sectionData)) {
        addApplication(sectionData);
      } else if (isLeaveBalanceRecord(sectionData)) {
        addBalance(sectionData);
      }
    }
  }

  applications.sort((a, b) => {
    const ta = Date.parse(a.applied_at) || 0;
    const tb = Date.parse(b.applied_at) || 0;
    return tb - ta;
  });

  return { balances, applications };
}

function isDateField(key, value) {
  if (DATE_KEY_PATTERN.test(key)) {
    return true;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return true;
  }
  return false;
}

function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function hashCategoryKey(key) {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h + key.charCodeAt(i)) % PERMISSION_CATEGORY_PALETTES.length;
  }
  return h;
}

function getPermissionCategoryPalette(category, scheme) {
  const key = String(category || 'other').toLowerCase();
  const idx = hashCategoryKey(key);
  const base = PERMISSION_CATEGORY_PALETTES[idx];
  const icon =
    PERMISSION_CATEGORY_ICON_MAP[key] ?? PERMISSION_CATEGORY_ICON_MAP.other;
  if (scheme === 'light') {
    return { ...base, icon };
  }
  const darkBorders = [
    'rgba(96,165,250,0.4)',
    'rgba(251,191,36,0.4)',
    'rgba(74,222,128,0.4)',
    'rgba(167,139,250,0.4)',
    'rgba(248,113,113,0.4)',
    'rgba(34,211,238,0.4)',
    'rgba(244,114,182,0.4)',
    'rgba(163,230,53,0.4)',
  ];
  const darkHeaders = [
    'rgba(96,165,250,0.12)',
    'rgba(251,191,36,0.1)',
    'rgba(34,197,94,0.1)',
    'rgba(139,92,246,0.12)',
    'rgba(248,113,113,0.1)',
    'rgba(34,211,238,0.1)',
    'rgba(244,114,182,0.1)',
    'rgba(163,230,53,0.1)',
  ];
  return {
    border: darkBorders[idx] ?? darkBorders[0],
    bg: darkHeaders[idx] ?? darkHeaders[0],
    header: darkHeaders[idx] ?? darkHeaders[0],
    accent: base.accent,
    icon,
  };
}

function normalizePermissionRecord(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const id = value.id ?? value.permission_id ?? value.code ?? value.name;
  const name = value.name ?? value.permission_name ?? value.code;
  const code = value.code ?? value.permission_code ?? '';
  const category = value.category ?? value.group ?? value.module ?? 'other';
  const action = value.action ?? value.permission_action ?? '';
  if (!name && !code) {
    return null;
  }
  return {
    id: String(id ?? `${category}-${name}-${code}`),
    name: String(name ?? ''),
    code: String(code ?? ''),
    category: String(category ?? 'other'),
    action: String(action ?? ''),
  };
}

function inferPermissionCategory(permission) {
  const code = String(permission?.code || '').toLowerCase();
  if (code.startsWith('att_')) {
    return 'attendance';
  }
  if (code.startsWith('cmp_bank_') || code.startsWith('emp_bnk_')) {
    return 'bank account';
  }
  if (code.startsWith('company_')) {
    return 'company settings';
  }
  if (code.startsWith('employee_')) {
    return 'employee';
  }
  if (code.startsWith('holiday_')) {
    return 'holiday';
  }
  if (code.startsWith('invite_package_')) {
    return 'invite package';
  }
  if (code.startsWith('invite_')) {
    return 'invite';
  }
  if (code.startsWith('invoice_prefix_')) {
    return 'invoice prefix';
  }
  if (code.startsWith('leave_balance_')) {
    return 'leave balance';
  }
  if (code.startsWith('leave_')) {
    return 'leave';
  }
  if (code.startsWith('payroll_')) {
    return 'payroll';
  }
  if (
    code.startsWith('permission_package_') ||
    code.startsWith('permission_')
  ) {
    return 'permission package';
  }
  if (code.startsWith('salary_')) {
    return 'salary';
  }
  if (code.startsWith('shift_')) {
    return 'shift';
  }
  return 'other';
}

function collectPermissionRecordsFromSection(sectionData) {
  if (!Array.isArray(sectionData)) {
    return [];
  }
  const seen = new Set();
  return sectionData
    .map(normalizePermissionRecord)
    .filter(Boolean)
    .map(item => ({
      ...item,
      category: inferPermissionCategory(item),
    }))
    .filter(item => {
      const key = `${item.id}-${item.code}-${item.name}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function groupPermissionsByCategory(permissions) {
  const map = new Map();
  permissions.forEach(permission => {
    const category = permission.category || 'other';
    const list = map.get(category) ?? [];
    list.push(permission);
    map.set(category, list);
  });
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function resolveProfilePictureUrl(path) {
  if (path == null || String(path).trim() === '') {
    return null;
  }
  const p = String(path).trim();
  if (p.startsWith('http://') || p.startsWith('https://')) {
    return p;
  }
  return `${API_ENDPOINT}${p.startsWith('/') ? '' : '/'}${p}`;
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0] ? parts[0][0].toUpperCase() : '?';
}

function getStatusColors(status, scheme) {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'active' || normalized === '1' || normalized === 'true') {
    return {
      bg: scheme === 'dark' ? 'rgba(16,185,129,0.2)' : '#dcfce7',
      text: scheme === 'dark' ? '#6ee7b7' : '#15803d',
      border: scheme === 'dark' ? 'rgba(52,211,153,0.35)' : '#86efac',
    };
  }
  if (
    normalized === 'inactive' ||
    normalized === '0' ||
    normalized === 'false'
  ) {
    return {
      bg: scheme === 'dark' ? 'rgba(148,163,184,0.2)' : '#f1f5f9',
      text: scheme === 'dark' ? '#cbd5e1' : '#475569',
      border: scheme === 'dark' ? 'rgba(148,163,184,0.35)' : '#cbd5e1',
    };
  }
  return {
    bg: scheme === 'dark' ? 'rgba(96,165,250,0.15)' : '#eff6ff',
    text: scheme === 'dark' ? '#93c5fd' : '#1d4ed8',
    border: scheme === 'dark' ? 'rgba(96,165,250,0.35)' : '#bfdbfe',
  };
}

function buildStyles(colors, scheme, theme) {
  const dark = scheme === 'dark';
  const tabBorder = theme.border;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
      paddingRight: 12,
    },
    headerTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    fixedBlock: {
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 8,
    },
    profileCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: tabBorder,
      backgroundColor: dark ? 'rgba(30,41,59,0.55)' : theme.surface,
      padding: 14,
      marginBottom: 10,
    },
    nestedCard: { marginTop: 8 },
    profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.secondaryButton,
      borderWidth: 2,
      borderColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarText: { color: theme.accent, fontWeight: '700', fontSize: 18 },
    profileMain: { flex: 1, minWidth: 0 },
    profileName: { fontSize: 18, fontWeight: '700', color: colors.text },
    profileCode: {
      alignSelf: 'flex-start',
      marginTop: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: dark ? 'rgba(59,130,246,0.2)' : theme.surface,
      color: theme.accent,
      fontSize: 11,
      fontWeight: '700',
      overflow: 'hidden',
    },
    profileEmail: { marginTop: 10, fontSize: 13, color: colors.textMuted },
    tabScroll: { flexGrow: 0 },
    tabRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: theme.accent,
      backgroundColor: dark ? 'rgba(96,165,250,0.18)' : theme.surface,
    },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    chipTextActive: { color: theme.accent },
    pagerFlex: { flex: 1 },
    pager: { flex: 1 },
    pagerPage: { flex: 1 },
    pagerPageScroll: { flex: 1 },
    pagerPageBody: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 32,
    },
    body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 32 },
    loadingWrap: { paddingVertical: 28, alignItems: 'center', gap: 10 },
    muted: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
    error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
    retryBtn: {
      marginTop: 10,
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    retryText: { color: '#fff', fontWeight: '700' },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    sectionIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: dark ? 'rgba(96,165,250,0.15)' : theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: theme.accent,
    },
    createBtnPressed: { opacity: 0.88 },
    createBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tabBorder,
      backgroundColor: colors.surface,
      padding: 14,
      marginBottom: 12,
      overflow: 'hidden',
    },
    cardAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: theme.accent,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      paddingLeft: 6,
    },
    fieldGrid: { gap: 10, paddingLeft: 6 },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: dark ? 'rgba(15,23,42,0.35)' : colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fieldIcon: { marginTop: 1 },
    fieldBody: { flex: 1, minWidth: 0 },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 3,
    },
    fieldValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      flexWrap: 'wrap',
    },
    statusPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },
    statusPillText: { fontSize: 12, fontWeight: '700' },
    copyCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: dark ? 'rgba(30,41,59,0.55)' : theme.surface,
      padding: 14,
      marginTop: 4,
    },
    chipActiveThemed: {
      borderColor: theme.accent,
      backgroundColor: dark ? 'rgba(96,165,250,0.18)' : theme.surface,
    },
    copyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 8,
    },
    copyTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
    copyHint: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 18,
      marginBottom: 10,
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: theme.accent,
    },
    copyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    jsonPreview: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: dark ? 'rgba(15,23,42,0.5)' : '#f8fafc',
      padding: 10,
      maxHeight: 120,
      overflow: 'hidden',
    },
    jsonText: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
    permissionCategoryCard: {
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 10,
      overflow: 'hidden',
    },
    permissionCategoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    permissionCategoryIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#fff',
    },
    permissionCategoryHeaderMain: { flex: 1, minWidth: 0 },
    permissionCategoryTitle: {
      fontSize: 14,
      fontWeight: '700',
    },
    permissionCategoryMeta: {
      fontSize: 11,
      marginTop: 2,
      fontWeight: '500',
      color: colors.textMuted,
    },
    permissionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface,
    },
    permissionRowLast: { borderBottomWidth: 0 },
    permissionRowMain: { flex: 1, minWidth: 0 },
    permissionRowName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    permissionRowCode: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    permissionActionBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      maxWidth: 90,
      backgroundColor: dark ? 'rgba(255,255,255,0.1)' : '#fff',
      borderWidth: 1,
    },
    permissionActionBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    attendanceCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: colors.surface,
      padding: 12,
      marginBottom: 12,
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    monthNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.secondaryButton,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthNavTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    weekdayCol: {
      flex: 1,
      alignItems: 'center',
    },
    weekdayLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    gridWeekRow: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    gridWeekRowLast: {
      marginBottom: 0,
    },
    gridCell: {
      flex: 1,
      minHeight: 44,
      padding: 2,
      maxWidth: '14.2857%',
    },
    dayCell: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 2,
      paddingHorizontal: 1,
    },
    dayCellMuted: {
      opacity: 0.72,
    },
    dayNumber: {
      fontSize: 13,
      fontWeight: '700',
    },
    dayStatus: {
      fontSize: 8,
      fontWeight: '600',
      marginTop: 1,
      textTransform: 'capitalize',
    },
    legendWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    legendSwatch: {
      width: 10,
      height: 10,
      borderRadius: 3,
      borderWidth: 1,
    },
    legendText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    summaryCard: {
      width: '48%',
      flexGrow: 1,
      minWidth: '46%',
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    summaryCount: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    modalBackdropFill: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    modalSheetWrap: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingTop: 48,
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      maxHeight: '88%',
      overflow: 'hidden',
    },
    modalHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 10,
    },
    modalHeader: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    modalStatusPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginTop: 8,
    },
    modalStatusText: {
      fontSize: 14,
      fontWeight: '600',
    },
    modalBody: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 20,
      gap: 10,
    },
    modalSection: {
      gap: 8,
    },
    modalSectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    modalEntry: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: dark ? 'rgba(15,23,42,0.35)' : colors.background,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    modalEntryTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 2,
    },
    detailLabel: {
      fontSize: 13,
      color: colors.textMuted,
      flex: 1,
    },
    detailValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    modalCloseBtn: {
      marginHorizontal: 20,
      marginBottom: 16,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    modalCloseText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    leaveStatsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    leaveStatCard: {
      flex: 1,
      minWidth: '45%',
      borderRadius: 10,
      borderWidth: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      alignItems: 'center',
    },
    leaveStatLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
    },
    leaveStatValue: {
      fontSize: 16,
      fontWeight: '800',
      marginTop: 2,
    },
    leaveSubsectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      marginTop: 4,
    },
    leaveBalanceScroll: { marginBottom: 12 },
    leaveBalanceCard: {
      width: 200,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginRight: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: dark ? 0.2 : 0.05,
          shadowRadius: 3,
        },
        android: { elevation: 1 },
      }),
    },
    leaveBalanceTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    leaveBalanceCode: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.accent,
      marginBottom: 6,
    },
    leaveBalanceBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 5,
      backgroundColor: dark ? 'rgba(255,255,255,0.08)' : colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    leaveBalanceBadgeText: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.textMuted,
    },
    leaveBalanceRemaining: {
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 4,
    },
    leaveBalanceRemainingLow: { color: '#dc2626' },
    leaveBalanceRemainingOk: { color: theme.accent },
    leaveProgressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: dark ? 'rgba(255,255,255,0.1)' : colors.secondaryButton,
      overflow: 'hidden',
      marginBottom: 4,
    },
    leaveProgressFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: theme.accent,
    },
    leaveBalanceFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    leaveBalanceFooterText: {
      fontSize: 10,
      color: colors.textMuted,
    },
    leaveApplicationCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: dark ? 0.15 : 0.04,
          shadowRadius: 2,
        },
        android: { elevation: 1 },
      }),
    },
    leaveApplicationCardPressed: { opacity: 0.92 },
    leaveCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    leaveTypeName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    leaveStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    leaveStatusText: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    leaveCardMid: { marginBottom: 4 },
    leaveDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 4,
      marginBottom: 2,
    },
    leaveDateText: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '500',
    },
    leaveMetaText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    leaveCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    leaveViewDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    leaveViewDetailsText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.accent,
    },
    skBone: { borderRadius: 6 },
    skSectionIcon: { width: 36, height: 36, borderRadius: 18 },
    skSectionTitle: { height: 16, width: '52%', borderRadius: 6 },
    skCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
      marginBottom: 12,
    },
    skFieldRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    skFieldLabel: { height: 10, width: '32%', borderRadius: 4 },
    skFieldValue: { height: 12, width: '38%', borderRadius: 4 },
    skCategoryBlock: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      overflow: 'hidden',
    },
    skCategoryHeader: {
      height: 48,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    skPermissionRow: { height: 44, marginHorizontal: 12, marginVertical: 6 },
    skMonthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    skNavBtn: { width: 40, height: 40, borderRadius: 12 },
    skMonthTitle: { height: 18, width: '42%', borderRadius: 6 },
    skWeekdayRow: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    skWeekdayCol: { flex: 1, alignItems: 'center' },
    skWeekdayLabel: { height: 10, width: 22, borderRadius: 4 },
    skGridWeekRow: { flexDirection: 'row', marginBottom: 4 },
    skDayCell: {
      flex: 1,
      aspectRatio: 1,
      margin: 2,
      borderRadius: 8,
    },
    skSummaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    skSummaryCard: {
      width: '47%',
      height: 52,
      borderRadius: 10,
    },
    skBalanceScroll: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    skBalanceCard: { width: 180, height: 128, borderRadius: 12 },
    skLeaveCard: { height: 96, borderRadius: 12, marginBottom: 8 },
    skStatRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    skStatCard: {
      flex: 1,
      minWidth: '45%',
      height: 52,
      borderRadius: 10,
    },
    skFieldValueWide: { width: '85%', marginTop: 4 },
    skFieldRowSpaced: { marginTop: 10 },
    skCardLast: { marginBottom: 0 },
    skSectionTitleSpaced: { marginBottom: 10 },
    skSectionTitleSpacedLg: { marginBottom: 12 },
    skSectionTitleNarrow: { width: '40%' },
    skJsonBlock: { width: '100%', height: 64, marginTop: 10, borderRadius: 10 },
  });
}

function useProfileSkeletonPulse() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return useMemo(
    () => ({
      opacity: pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.38, 0.78],
      }),
    }),
    [pulse],
  );
}

function EmployeeProfileTabSkeleton({ tabKey, styles, scheme }) {
  const pulseStyle = useProfileSkeletonPulse();
  const barBg =
    scheme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.07)';

  const bone = useCallback(
    extra => {
      const flat = Array.isArray(extra)
        ? extra.reduce((acc, part) => ({ ...acc, ...part }), {})
        : extra;
      return [styles.skBone, { backgroundColor: barBg }, flat, pulseStyle];
    },
    [barBg, pulseStyle, styles.skBone],
  );

  const sectionHeader = (
    <View style={styles.sectionHeader}>
      <Animated.View style={bone(styles.skSectionIcon)} />
      <Animated.View style={bone(styles.skSectionTitle)} />
    </View>
  );

  if (tabKey === 'basic') {
    return (
      <>
        {sectionHeader}
        <View style={styles.skCard}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={styles.skFieldRow}>
              <Animated.View style={bone(styles.skFieldLabel)} />
              <Animated.View style={bone(styles.skFieldValue)} />
            </View>
          ))}
        </View>
      </>
    );
  }

  if (tabKey === 'permissions') {
    return (
      <>
        {sectionHeader}
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={styles.skCategoryBlock}>
            <Animated.View style={bone(styles.skCategoryHeader)} />
            <Animated.View style={bone(styles.skPermissionRow)} />
            <Animated.View style={bone(styles.skPermissionRow)} />
          </View>
        ))}
      </>
    );
  }

  if (tabKey === 'attendance') {
    return (
      <>
        {sectionHeader}
        <View style={styles.skCard}>
          <View style={styles.skMonthNav}>
            <Animated.View style={bone(styles.skNavBtn)} />
            <Animated.View style={bone(styles.skMonthTitle)} />
            <Animated.View style={bone(styles.skNavBtn)} />
          </View>
          <View style={styles.skWeekdayRow}>
            {WEEKDAY_LABELS.map(label => (
              <View key={label} style={styles.skWeekdayCol}>
                <Animated.View style={bone(styles.skWeekdayLabel)} />
              </View>
            ))}
          </View>
          {Array.from({ length: 5 }).map((_, weekIndex) => (
            <View key={weekIndex} style={styles.skGridWeekRow}>
              {Array.from({ length: 7 }).map((__, dayIndex) => (
                <Animated.View
                  key={dayIndex}
                  style={bone(styles.skDayCell)}
                />
              ))}
            </View>
          ))}
        </View>
        <View style={styles.skCard}>
          <Animated.View
            style={bone([styles.skSectionTitle, styles.skSectionTitleSpaced])}
          />
          <View style={styles.skSummaryGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Animated.View key={i} style={bone(styles.skSummaryCard)} />
            ))}
          </View>
        </View>
      </>
    );
  }

  if (tabKey === 'leaves') {
    return (
      <>
        {sectionHeader}
        <View style={styles.skStatRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Animated.View key={i} style={bone(styles.skStatCard)} />
          ))}
        </View>
        <View style={styles.skBalanceScroll}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Animated.View key={i} style={bone(styles.skBalanceCard)} />
          ))}
        </View>
        {Array.from({ length: 3 }).map((_, i) => (
          <Animated.View key={i} style={bone(styles.skLeaveCard)} />
        ))}
      </>
    );
  }

  return (
    <>
      {sectionHeader}
      {Array.from({ length: 2 }).map((_, i) => (
        <View key={i} style={styles.skCard}>
          <Animated.View
            style={bone([
              styles.skSectionTitle,
              styles.skSectionTitleSpacedLg,
            ])}
          />
          <Animated.View
            style={bone([styles.skFieldValue, { width: '100%' }])}
          />
          <View style={[styles.skFieldRow, styles.skFieldRowSpaced]}>
            <Animated.View style={bone(styles.skFieldLabel)} />
            <Animated.View style={bone(styles.skFieldValue)} />
          </View>
          <View style={styles.skFieldRow}>
            <Animated.View style={bone(styles.skFieldLabel)} />
            <Animated.View style={bone(styles.skFieldValue)} />
          </View>
          <Animated.View
            style={bone([styles.skFieldValue, styles.skFieldValueWide])}
          />
        </View>
      ))}
      <View style={[styles.skCard, styles.skCardLast]}>
        <Animated.View
          style={bone([styles.skSectionTitle, styles.skSectionTitleNarrow])}
        />
        <Animated.View
          style={bone([styles.skFieldValue, styles.skJsonBlock])}
        />
      </View>
    </>
  );
}

function chunkCalendarWeeks(grid) {
  const weeks = [];
  for (let i = 0; i < grid.length; i += 7) {
    const week = grid.slice(i, i + 7);
    while (week.length < 7) {
      week.push({ day: null, dateKey: null, dayInfo: null });
    }
    weeks.push(week);
  }
  return weeks;
}

function formatDisplayDate(dateKey) {
  const [y, m, d] = String(dateKey).split('-');
  if (!y || !m || !d) {
    return String(dateKey);
  }
  return `${d}/${m}/${y}`;
}

function isCalendarDayPressable(status, dayInfo) {
  if (status == null) {
    return false;
  }
  if (!NON_CLICKABLE_STATUSES.includes(status)) {
    return true;
  }
  return hasCalendarDayDetails(dayInfo);
}

function AttendanceDetailRow({ styles, label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function EmployeeAttendanceDayModal({
  visible,
  dateKey,
  dayInfo,
  onClose,
  styles,
  t,
}) {
  const statusStyle = getStatusStyle(dayInfo?.day_status);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdropFill}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheetWrap}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {dateKey ? formatDisplayDate(dateKey) : '—'}
              </Text>
              {dayInfo?.day_status ? (
                <View
                  style={[
                    styles.modalStatusPill,
                    {
                      backgroundColor: statusStyle.backgroundColor,
                      borderColor: statusStyle.borderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalStatusText,
                      { color: statusStyle.textColor },
                    ]}
                  >
                    {formatStatusLabel(dayInfo.day_status)}
                  </Text>
                </View>
              ) : null}
            </View>
            <ScrollView
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {dayInfo ? (
                <>
                  {dayInfo.activities?.length ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>
                        {t('home.myCalendar.modal.activities')}
                      </Text>
                      {dayInfo.activities.map((item, index) => (
                        <View key={`a-${index}`} style={styles.modalEntry}>
                          <Text style={styles.modalEntryTitle}>
                            {item.type === 'PUNCH_IN'
                              ? t('home.myCalendar.modal.punchIn')
                              : t('home.myCalendar.modal.punchOut')}
                          </Text>
                          <AttendanceDetailRow
                            styles={styles}
                            label="Time"
                            value={item.time || '—'}
                          />
                          {item.attendance_method ? (
                            <AttendanceDetailRow
                              styles={styles}
                              label="Method"
                              value={formatAttendanceMethod(
                                item.attendance_method,
                              )}
                            />
                          ) : null}
                          {item.created_by ? (
                            <AttendanceDetailRow
                              styles={styles}
                              label={t('home.myCalendar.modal.createdBy')}
                              value={formatCreatedByLabel(
                                item.created_by.name,
                                item.created_by.role,
                              )}
                            />
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {dayInfo.breaks?.length ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>
                        {t('home.myCalendar.modal.breaks')}
                      </Text>
                      {dayInfo.breaks.map((item, index) => (
                        <View key={`b-${index}`} style={styles.modalEntry}>
                          <Text style={styles.modalEntryTitle}>
                            {item.type === 'BREAK_START'
                              ? t('home.myCalendar.modal.breakStart')
                              : t('home.myCalendar.modal.breakEnd')}
                          </Text>
                          <AttendanceDetailRow
                            styles={styles}
                            label="Time"
                            value={item.time || '—'}
                          />
                          {item.attendance_method ? (
                            <AttendanceDetailRow
                              styles={styles}
                              label="Method"
                              value={formatAttendanceMethod(
                                item.attendance_method,
                              )}
                            />
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {dayInfo.logs?.length ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>
                        {t('home.myCalendar.modal.logs')}
                      </Text>
                      {dayInfo.logs.map((item, index) => (
                        <View key={`l-${index}`} style={styles.modalEntry}>
                          <Text style={styles.modalEntryTitle}>
                            {item.log_type === 'day_status' && item.day_status
                              ? formatStatusLabel(item.day_status)
                              : formatLogTypeLabel(item.log_type)}
                          </Text>
                          <AttendanceDetailRow
                            styles={styles}
                            label="Time"
                            value={item.time || '—'}
                          />
                          {item.attendance_method ? (
                            <AttendanceDetailRow
                              styles={styles}
                              label="Method"
                              value={formatAttendanceMethod(
                                item.attendance_method,
                              )}
                            />
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.muted}>
                  {t('home.myCalendar.modal.noData')}
                </Text>
              )}
            </ScrollView>
            <Pressable style={styles.modalCloseBtn} onPress={onClose}>
              <Text style={styles.modalCloseText}>
                {t('home.myCalendar.modal.close')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function formatDisplayValue(key, value, t) {
  if (value == null || value === '') {
    return t('home.employeeProfile.na');
  }
  if (typeof value === 'boolean') {
    return value ? t('home.employeeProfile.yes') : t('home.employeeProfile.no');
  }
  if (isDateField(key, value)) {
    return formatDateDDMMYYYY(value) ?? String(value);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function fieldIconName(key) {
  if (/email/i.test(key)) {
    return 'email-outline';
  }
  if (/phone|mobile/i.test(key)) {
    return 'phone-outline';
  }
  if (/date|joining|birth/i.test(key)) {
    return 'calendar-outline';
  }
  if (/status/i.test(key)) {
    return 'checkbox-marked-circle-outline';
  }
  if (/salary|amount|pay/i.test(key)) {
    return 'currency-inr';
  }
  if (/bank|account|ifsc/i.test(key)) {
    return 'bank-outline';
  }
  if (/shift|time/i.test(key)) {
    return 'clock-outline';
  }
  return 'information-outline';
}

function DetailField({ styles, label, fieldKey, value, theme, scheme, t }) {
  const isStatus = fieldKey === 'status';
  const statusColors = isStatus ? getStatusColors(value, scheme) : null;
  const display = formatDisplayValue(fieldKey, value, t);

  return (
    <View style={styles.fieldRow}>
      <MaterialCommunityIcons
        name={fieldIconName(fieldKey)}
        size={18}
        color={theme.accent}
        style={styles.fieldIcon}
      />
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {isStatus ? (
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: statusColors.bg,
                borderColor: statusColors.border,
              },
            ]}
          >
            <Text style={[styles.statusPillText, { color: statusColors.text }]}>
              {display}
            </Text>
          </View>
        ) : (
          <Text style={styles.fieldValue}>{display}</Text>
        )}
      </View>
    </View>
  );
}

function renderObjectFields(styles, source, theme, scheme, t, labelForKey) {
  const entries = Object.entries(source || {}).filter(
    ([, v]) => v != null && v !== '' && typeof v !== 'object',
  );
  if (entries.length === 0) {
    return null;
  }
  return (
    <View style={styles.fieldGrid}>
      {entries.map(([key, value]) => (
        <DetailField
          key={key}
          styles={styles}
          label={labelForKey(key)}
          fieldKey={key}
          value={value}
          theme={theme}
          scheme={scheme}
          t={t}
        />
      ))}
    </View>
  );
}

function renderNestedBlocks(
  styles,
  source,
  theme,
  scheme,
  t,
  labelForKey,
  depth = 0,
) {
  if (!source || typeof source !== 'object') {
    return null;
  }
  const primitives = renderObjectFields(
    styles,
    source,
    theme,
    scheme,
    t,
    labelForKey,
  );
  const nested = Object.entries(source).filter(
    ([, v]) => v != null && typeof v === 'object',
  );

  return (
    <>
      {primitives}
      {nested.map(([key, value]) => {
        if (Array.isArray(value)) {
          return value.map((item, index) => (
            <View
              key={`${key}-${index}`}
              style={[styles.card, styles.nestedCard]}
            >
              <View style={styles.cardAccent} />
              <Text style={styles.cardTitle}>
                {humanizeKey(key)} #{index + 1}
              </Text>
              {typeof item === 'object' && item != null ? (
                renderObjectFields(styles, item, theme, scheme, t, labelForKey)
              ) : (
                <DetailField
                  styles={styles}
                  label={humanizeKey(key)}
                  fieldKey={key}
                  value={item}
                  theme={theme}
                  scheme={scheme}
                  t={t}
                />
              )}
            </View>
          ));
        }
        if (depth > 2) {
          return null;
        }
        return (
          <View key={key} style={[styles.card, styles.nestedCard]}>
            <View style={styles.cardAccent} />
            <Text style={styles.cardTitle}>{labelForKey(key)}</Text>
            {renderNestedBlocks(
              styles,
              value,
              theme,
              scheme,
              t,
              labelForKey,
              depth + 1,
            )}
          </View>
        );
      })}
    </>
  );
}

function renderLeavesSection({
  styles,
  sectionData,
  scheme,
  theme,
  t,
  onLeavePress,
}) {
  const { balances, applications } = parseLeavesSectionData(sectionData);
  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  if (balances.length === 0 && applications.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>
          {t('home.leaveRequest.emptyApplications')}
        </Text>
      </View>
    );
  }

  const statItems = [
    { key: 'total', val: stats.total, color: theme.accent },
    {
      key: 'pending',
      val: stats.pending,
      color: scheme === 'dark' ? '#fbbf24' : '#b45309',
    },
    {
      key: 'approved',
      val: stats.approved,
      color: scheme === 'dark' ? '#4ade80' : '#15803d',
    },
    { key: 'rejected', val: stats.rejected, color: '#dc2626' },
  ];

  return (
    <>
      {applications.length > 0 ? (
        <View style={styles.leaveStatsRow}>
          {statItems.map(({ key, val, color }) => (
            <View
              key={key}
              style={[
                styles.leaveStatCard,
                {
                  borderColor: `${color}33`,
                  backgroundColor: `${color}0d`,
                },
              ]}
            >
              <Text style={styles.leaveStatLabel}>
                {t(`home.leaveRequest.stats.${key}`)}
              </Text>
              <Text style={[styles.leaveStatValue, { color }]}>{val}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {balances.length > 0 ? (
        <>
          <Text style={styles.leaveSubsectionTitle}>
            {t('home.leaveRequest.balanceTitle')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.leaveBalanceScroll}
          >
            {balances.map(bal => {
              const usedPct =
                bal.total > 0
                  ? Math.min(100, Math.round((bal.used / bal.total) * 100))
                  : 0;
              return (
                <View key={bal.id || bal.code} style={styles.leaveBalanceCard}>
                  <Text style={styles.leaveBalanceTitle} numberOfLines={1}>
                    {bal.name}
                  </Text>
                  <Text style={styles.leaveBalanceCode}>{bal.code}</Text>
                  <View style={styles.leaveBalanceBadge}>
                    <Text style={styles.leaveBalanceBadgeText}>
                      {bal.is_paid
                        ? t('home.leaveRequest.paid')
                        : t('home.leaveRequest.unpaid')}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.leaveBalanceRemaining,
                      bal.remaining <= 0
                        ? styles.leaveBalanceRemainingLow
                        : styles.leaveBalanceRemainingOk,
                    ]}
                  >
                    {bal.remaining}
                  </Text>
                  {bal.total > 0 ? (
                    <View style={styles.leaveProgressTrack}>
                      <View
                        style={[
                          styles.leaveProgressFill,
                          { width: `${usedPct}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                  <View style={styles.leaveBalanceFooter}>
                    <Text style={styles.leaveBalanceFooterText}>
                      {t('home.leaveRequest.used')}: {bal.used}
                    </Text>
                    <Text style={styles.leaveBalanceFooterText}>
                      {t('home.leaveRequest.total')}: {bal.total}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {applications.length > 0 ? (
        <>
          <Text style={styles.leaveSubsectionTitle}>
            {t('home.leaveRequest.applicationsTitle')}
          </Text>
          {applications.map(item => {
            const sc = leaveStatusColors(item.status, scheme);
            const startLabel =
              formatDateDDMMYYYY(item.start_date) ?? item.start_date;
            const endLabel = formatDateDDMMYYYY(item.end_date) ?? item.end_date;
            const dateRange =
              startLabel === endLabel
                ? startLabel
                : `${startLabel} — ${endLabel}`;
            const halfLabel = item.is_half_day
              ? item.half_day_type === 'first_half'
                ? t('home.leaveRequest.detailModal.firstHalf')
                : item.half_day_type === 'second_half'
                ? t('home.leaveRequest.detailModal.secondHalf')
                : t('home.leaveRequest.halfDay')
              : null;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => onLeavePress(item)}
                style={({ pressed }) => [
                  styles.leaveApplicationCard,
                  pressed && styles.leaveApplicationCardPressed,
                ]}
              >
                <View style={styles.leaveCardTop}>
                  <Text style={styles.leaveTypeName} numberOfLines={1}>
                    {item.leave_type_name}
                  </Text>
                  <View
                    style={[
                      styles.leaveStatusBadge,
                      { backgroundColor: sc.bg, borderColor: sc.border },
                    ]}
                  >
                    <Text style={[styles.leaveStatusText, { color: sc.text }]}>
                      {t(`home.leaveRequest.status.${item.status}`)}
                    </Text>
                  </View>
                </View>
                <View style={styles.leaveCardMid}>
                  <View style={styles.leaveDateRow}>
                    <MaterialCommunityIcons
                      name="calendar-range"
                      size={13}
                      color={styles.leaveMetaText.color}
                    />
                    <Text style={styles.leaveDateText}>{dateRange}</Text>
                    <Text style={styles.leaveMetaText}>
                      ·{' '}
                      {t('home.leaveRequest.days', { count: item.total_days })}
                      {halfLabel ? ` · ${halfLabel}` : ''}
                    </Text>
                  </View>
                  {item.reason ? (
                    <Text style={styles.leaveMetaText} numberOfLines={2}>
                      {item.reason}
                    </Text>
                  ) : null}
                  {item.applied_at ? (
                    <Text style={styles.leaveMetaText}>
                      {t('home.leaveRequest.appliedOn', {
                        date: formatLeaveDateTime(item.applied_at),
                      })}
                    </Text>
                  ) : null}
                  {item.approval_remarks ? (
                    <Text style={styles.leaveMetaText} numberOfLines={2}>
                      {t('home.leaveRequest.detailModal.remarks')}:{' '}
                      {item.approval_remarks}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.leaveCardFooter}>
                  <Text style={styles.leaveMetaText}>
                    {item.attachments.length > 0
                      ? `${item.attachments.length} attachment(s)`
                      : t('home.leaveRequest.noAttachments')}
                  </Text>
                  <View style={styles.leaveViewDetails}>
                    <MaterialCommunityIcons
                      name="eye-outline"
                      size={14}
                      color={theme.accent}
                    />
                    <Text style={styles.leaveViewDetailsText}>
                      {t('home.leaveRequest.viewDetails')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </>
      ) : null}
    </>
  );
}

function renderSectionContent({
  styles,
  include,
  sectionData,
  basicData,
  theme,
  scheme,
  t,
  labelForKey,
  includeLabel,
  expandedPermissionCategories,
  togglePermissionCategory,
  attendanceYear,
  attendanceMonth,
  onAttendancePrevMonth,
  onAttendanceNextMonth,
  onAttendanceDayPress,
  onLeavePress,
}) {
  if (include === 'attendance') {
    const days = sectionData?.days;
    if (!days || typeof days !== 'object') {
      return (
        <View style={styles.card}>
          <Text style={styles.muted}>
            {t('home.employeeProfile.noRecords', {
              section: includeLabel.toLowerCase(),
            })}
          </Text>
        </View>
      );
    }
    const grid = buildCalendarGrid(attendanceYear, attendanceMonth, days);
    const calendarWeeks = chunkCalendarWeeks(grid);
    const summary = computeCalendarSummary(days);
    return (
      <>
        <View style={styles.attendanceCard}>
          <View style={styles.monthNav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.myCalendar.prevMonth')}
              onPress={onAttendancePrevMonth}
              style={styles.monthNavBtn}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={24}
                color={theme.accent}
              />
            </Pressable>
            <Text style={styles.monthNavTitle}>
              {formatMonthTitle(attendanceYear, attendanceMonth)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.myCalendar.nextMonth')}
              onPress={onAttendanceNextMonth}
              style={styles.monthNavBtn}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={theme.accent}
              />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map(label => (
              <View key={label} style={styles.weekdayCol}>
                <Text style={styles.weekdayLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {calendarWeeks.map((week, weekIndex) => (
            <View
              key={`week-${weekIndex}`}
              style={[
                styles.gridWeekRow,
                weekIndex === calendarWeeks.length - 1 &&
                  styles.gridWeekRowLast,
              ]}
            >
              {week.map((cell, dayIndex) => {
                if (cell.day == null || cell.dateKey == null) {
                  return (
                    <View
                      key={`empty-${weekIndex}-${dayIndex}`}
                      style={styles.gridCell}
                    />
                  );
                }
                const status = cell.dayInfo?.day_status ?? 'upcoming';
                const visual = getStatusStyle(status);
                const pressable = isCalendarDayPressable(status, cell.dayInfo);
                const shortStatus =
                  status === 'half_day'
                    ? '1/2'
                    : status.charAt(0).toUpperCase();
                const content = (
                  <View
                    style={[
                      styles.dayCell,
                      visual.muted && styles.dayCellMuted,
                      {
                        backgroundColor: visual.backgroundColor,
                        borderColor: visual.borderColor,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.dayNumber, { color: visual.textColor }]}
                    >
                      {cell.day}
                    </Text>
                    <Text
                      style={[styles.dayStatus, { color: visual.textColor }]}
                      numberOfLines={1}
                    >
                      {shortStatus}
                    </Text>
                  </View>
                );
                if (!pressable) {
                  return (
                    <View key={cell.dateKey} style={styles.gridCell}>
                      {content}
                    </View>
                  );
                }
                return (
                  <Pressable
                    key={cell.dateKey}
                    style={styles.gridCell}
                    accessibilityRole="button"
                    accessibilityLabel={`${cell.day}, ${formatStatusLabel(
                      status,
                    )}`}
                    onPress={() =>
                      onAttendanceDayPress(cell.dateKey, cell.dayInfo)
                    }
                  >
                    {content}
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={styles.legendWrap}>
            {SUMMARY_KEYS.map(item => {
              const visual = getStatusStyle(item.status);
              return (
                <View key={item.key} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendSwatch,
                      {
                        backgroundColor: visual.backgroundColor,
                        borderColor: visual.borderColor,
                      },
                    ]}
                  />
                  <Text style={styles.legendText}>
                    {formatStatusLabel(item.status)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.attendanceCard}>
          <Text style={styles.cardTitle}>
            {t('home.myCalendar.summaryTitle')}
          </Text>
          <View style={styles.summaryGrid}>
            {SUMMARY_KEYS.map(item => {
              const count = summary[item.key];
              const visual = getStatusStyle(item.status);
              return (
                <View
                  key={item.key}
                  style={[
                    styles.summaryCard,
                    {
                      borderColor: visual.borderColor,
                      backgroundColor: visual.backgroundColor,
                    },
                  ]}
                >
                  <Text
                    style={[styles.summaryCount, { color: visual.textColor }]}
                  >
                    {count}
                  </Text>
                  <Text style={styles.summaryLabel}>
                    {t(`home.myCalendar.summary.${item.labelKey}`)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </>
    );
  }

  if (include === 'leaves') {
    return renderLeavesSection({
      styles,
      sectionData,
      scheme,
      theme,
      t,
      onLeavePress,
    });
  }

  if (include === 'permissions') {
    const permissionRecords = collectPermissionRecordsFromSection(sectionData);
    const groupedPermissions = groupPermissionsByCategory(permissionRecords);
    if (groupedPermissions.length === 0) {
      return (
        <View style={styles.card}>
          <Text style={styles.muted}>
            {t('home.employeeProfile.noRecords', {
              section: includeLabel.toLowerCase(),
            })}
          </Text>
        </View>
      );
    }
    return groupedPermissions.map(([category, permissions]) => {
      const palette = getPermissionCategoryPalette(category, scheme);
      return (
        <View
          key={category}
          style={[
            styles.permissionCategoryCard,
            {
              borderColor: palette.border,
              backgroundColor: palette.bg,
            },
          ]}
        >
          <Pressable
            style={[
              styles.permissionCategoryHeader,
              {
                backgroundColor: palette.header,
                borderBottomColor: palette.border,
              },
            ]}
            onPress={() => togglePermissionCategory(category)}
            accessibilityRole="button"
            accessibilityState={{
              expanded: expandedPermissionCategories.includes(category),
            }}
          >
            <View style={styles.permissionCategoryIconWrap}>
              <MaterialCommunityIcons
                name={palette.icon}
                size={18}
                color={palette.accent}
              />
            </View>
            <View style={styles.permissionCategoryHeaderMain}>
              <Text
                style={[
                  styles.permissionCategoryTitle,
                  { color: palette.accent },
                ]}
              >
                {humanizeKey(category)}
              </Text>
              <Text style={styles.permissionCategoryMeta}>
                {permissions.length} permissions
              </Text>
            </View>
            <MaterialCommunityIcons
              name={
                expandedPermissionCategories.includes(category)
                  ? 'chevron-up'
                  : 'chevron-down'
              }
              size={20}
              color={palette.accent}
            />
          </Pressable>
          {expandedPermissionCategories.includes(category)
            ? permissions.map((permission, index) => {
                const isLast = index === permissions.length - 1;
                return (
                  <View
                    key={permission.id}
                    style={[
                      styles.permissionRow,
                      isLast && styles.permissionRowLast,
                      { borderBottomColor: palette.border },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="shield-check-outline"
                      size={18}
                      color={palette.accent}
                    />
                    <View style={styles.permissionRowMain}>
                      <Text style={styles.permissionRowName} numberOfLines={2}>
                        {permission.name}
                      </Text>
                      {permission.code ? (
                        <Text
                          style={styles.permissionRowCode}
                          numberOfLines={1}
                        >
                          {permission.code}
                        </Text>
                      ) : null}
                    </View>
                    {permission.action ? (
                      <View
                        style={[
                          styles.permissionActionBadge,
                          { borderColor: palette.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.permissionActionBadgeText,
                            { color: palette.accent },
                          ]}
                          numberOfLines={1}
                        >
                          {humanizeKey(permission.action)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            : null}
        </View>
      );
    });
  }

  if (include === 'basic') {
    const rows = {};
    for (const key of BASIC_FIELD_KEYS) {
      if (basicData?.[key] != null && basicData[key] !== '') {
        rows[key] = basicData[key];
      }
    }
    return (
      <View style={styles.card}>
        <View style={styles.cardAccent} />
        <Text style={styles.cardTitle}>
          {t('home.employeeProfile.snapshot')}
        </Text>
        {renderObjectFields(styles, rows, theme, scheme, t, labelForKey)}
      </View>
    );
  }

  if (Array.isArray(sectionData)) {
    if (sectionData.length === 0) {
      return (
        <View style={styles.card}>
          <Text style={styles.muted}>
            {t('home.employeeProfile.noRecords', {
              section: includeLabel.toLowerCase(),
            })}
          </Text>
        </View>
      );
    }
    return sectionData.map((item, index) => (
      <View key={`${include}-${index}`} style={styles.card}>
        <View style={styles.cardAccent} />
        <Text style={styles.cardTitle}>
          {t('home.employeeProfile.record', {
            section: includeLabel,
            index: index + 1,
          })}
        </Text>
        {typeof item === 'object' && item != null ? (
          renderNestedBlocks(styles, item, theme, scheme, t, labelForKey)
        ) : (
          <DetailField
            styles={styles}
            label={includeLabel}
            fieldKey={include}
            value={item}
            theme={theme}
            scheme={scheme}
            t={t}
          />
        )}
      </View>
    ));
  }

  if (typeof sectionData === 'object' && sectionData != null) {
    return (
      <View style={styles.card}>
        <View style={styles.cardAccent} />
        <Text style={styles.cardTitle}>{includeLabel}</Text>
        {renderNestedBlocks(styles, sectionData, theme, scheme, t, labelForKey)}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <DetailField
        styles={styles}
        label={includeLabel}
        fieldKey={include}
        value={sectionData}
        theme={theme}
        scheme={scheme}
        t={t}
      />
    </View>
  );
}

export function EmployeeProfileScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { selectedCompany } = useAuth();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const {
    props: statusAlertProps,
    presentSuccess,
    presentError,
  } = useStatusAlert();

  const employeeId = route?.params?.employeeId;
  const [tabIndex, setTabIndex] = useState(0);
  const include = INCLUDE_KEYS[tabIndex] ?? INCLUDE_KEYS[0];
  const [tabCache, setTabCache] = useState({});
  const [loadingKey, setLoadingKey] = useState(null);
  const [profileBasic, setProfileBasic] = useState(null);
  const [pageWidth, setPageWidth] = useState(0);
  const pagerRef = useRef(null);
  const tabBarRef = useRef(null);
  const [expandedPermissionCategories, setExpandedPermissionCategories] =
    useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [attendanceYear, setAttendanceYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [attendanceMonth, setAttendanceMonth] = useState(
    () => new Date().getMonth() + 1,
  );
  const [attendanceDetailOpen, setAttendanceDetailOpen] = useState(false);
  const [attendanceSelectedDateKey, setAttendanceSelectedDateKey] =
    useState(null);
  const [attendanceSelectedDayInfo, setAttendanceSelectedDayInfo] =
    useState(null);
  const [assignSalaryVisible, setAssignSalaryVisible] = useState(false);
  const [assignSalarySubmitting, setAssignSalarySubmitting] = useState(false);
  const [assignSalaryApiError, setAssignSalaryApiError] = useState('');
  const [assignSalaryOverlapHint, setAssignSalaryOverlapHint] = useState(false);

  const theme = TAB_THEMES[include] ?? TAB_THEMES.basic;
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme, theme),
    [colors, resolvedScheme, theme],
  );

  const labelForKey = useCallback(
    key => {
      const fieldKey = `home.employeeProfile.fields.${key}`;
      const translated = t(fieldKey);
      if (translated !== fieldKey) {
        return translated;
      }
      const viewKey = `home.employeeList.viewModal.${key}`;
      const viewTranslated = t(viewKey);
      if (viewTranslated !== viewKey) {
        return viewTranslated;
      }
      return humanizeKey(key);
    },
    [t],
  );

  const loadTab = useCallback(
    async tabKey => {
      if (!employeeId || !selectedCompany?.id) {
        setTabCache(prev => ({
          ...prev,
          [tabKey]: {
            basicData: null,
            sectionData: null,
            apiSnapshot: null,
            error: t('home.employeeProfile.missingContext'),
          },
        }));
        setLoadingKey(null);
        return;
      }
      setLoadingKey(tabKey);
      try {
        const basicReq = authHttpClient.get(`/employees/${employeeId}`, {
          headers: { company: String(selectedCompany.id) },
        });

        if (tabKey === 'basic') {
          const { data } = await basicReq;
          if (!data?.success) {
            const msg =
              data?.message?.trim() || t('home.employeeProfile.fetchFailed');
            setTabCache(prev => ({
              ...prev,
              [tabKey]: {
                basicData: null,
                sectionData: null,
                apiSnapshot: null,
                error: msg,
              },
            }));
          } else {
            const basic = data.data?.basic ?? null;
            if (basic) {
              setProfileBasic(basic);
            }
            setTabCache(prev => ({
              ...prev,
              [tabKey]: {
                basicData: basic,
                sectionData: basic,
                apiSnapshot: {
                  employeeId,
                  include: tabKey,
                  basic,
                  section: basic,
                },
                error: '',
              },
            }));
          }
        } else if (tabKey === 'attendance') {
          const attendanceReq = authHttpClient.get('/shifts/my-calendar', {
            headers: { company: String(selectedCompany.id) },
            params: {
              year: attendanceYear,
              month: attendanceMonth,
              employee_id: employeeId,
            },
          });
          const [basicRes, attendanceRes] = await Promise.all([
            basicReq,
            attendanceReq,
          ]);

          if (!basicRes.data?.success || !attendanceRes.data?.success) {
            const msg =
              attendanceRes.data?.message?.trim() ||
              basicRes.data?.message?.trim() ||
              t('home.employeeProfile.fetchFailed');
            setTabCache(prev => ({
              ...prev,
              [tabKey]: {
                basicData: null,
                sectionData: null,
                apiSnapshot: null,
                error: msg,
              },
            }));
          } else {
            const basic = basicRes.data.data?.basic ?? null;
            const section = attendanceRes.data.data ?? null;
            if (basic) {
              setProfileBasic(basic);
            }
            setTabCache(prev => ({
              ...prev,
              [tabKey]: {
                basicData: basic,
                sectionData: section,
                apiSnapshot: {
                  employeeId,
                  include: tabKey,
                  basic,
                  section,
                },
                error: '',
              },
            }));
          }
        } else {
          const includeReq = authHttpClient.get(`/employees/${employeeId}`, {
            headers: { company: String(selectedCompany.id) },
            params: { include: tabKey },
          });
          const [basicRes, includeRes] = await Promise.all([
            basicReq,
            includeReq,
          ]);

          if (!basicRes.data?.success || !includeRes.data?.success) {
            const msg =
              includeRes.data?.message?.trim() ||
              basicRes.data?.message?.trim() ||
              t('home.employeeProfile.fetchFailed');
            setTabCache(prev => ({
              ...prev,
              [tabKey]: {
                basicData: null,
                sectionData: null,
                apiSnapshot: null,
                error: msg,
              },
            }));
          } else {
            const basic = basicRes.data.data?.basic ?? null;
            const section =
              includeRes.data.data?.[tabKey] ?? includeRes.data.data ?? null;
            if (basic) {
              setProfileBasic(basic);
            }
            setTabCache(prev => ({
              ...prev,
              [tabKey]: {
                basicData: basic,
                sectionData: section,
                apiSnapshot: {
                  employeeId,
                  include: tabKey,
                  basic,
                  section,
                },
                error: '',
              },
            }));
          }
        }
      } catch (e) {
        setTabCache(prev => ({
          ...prev,
          [tabKey]: {
            basicData: null,
            sectionData: null,
            apiSnapshot: null,
            error: readApiError(e),
          },
        }));
      } finally {
        setLoadingKey(null);
      }
    },
    [
      attendanceMonth,
      attendanceYear,
      employeeId,
      selectedCompany?.id,
      t,
    ],
  );

  useEffect(() => {
    setTabCache({});
    setTabIndex(0);
    setProfileBasic(null);
    setPageWidth(0);
    pagerRef.current?.scrollTo({ x: 0, animated: false });
  }, [employeeId]);

  const markTabLoadingIfNeeded = useCallback(
    tabKey => {
      const cached = tabCache[tabKey];
      if (cached?.sectionData == null && !cached?.error) {
        setLoadingKey(tabKey);
      }
    },
    [tabCache],
  );

  useEffect(() => {
    markTabLoadingIfNeeded(include);
    loadTab(include).catch(() => {});
  }, [include, loadTab, markTabLoadingIfNeeded]);

  useEffect(() => {
    if (include === 'permissions') {
      setExpandedPermissionCategories([]);
    }
    if (include !== 'leaves') {
      setSelectedLeave(null);
    }
  }, [include, tabCache]);

  const includeOptions = useMemo(
    () =>
      INCLUDE_KEYS.map(key => ({
        key,
        label: t(`home.employeeProfile.tabs.${key}`),
      })),
    [t],
  );

  const profileImageUrl = resolveProfilePictureUrl(
    typeof profileBasic?.profile_picture === 'string'
      ? profileBasic.profile_picture
      : null,
  );
  const hasProfileImage = Boolean(profileImageUrl);

  const selectTab = useCallback(
    index => {
      if (index < 0 || index >= INCLUDE_KEYS.length || index === tabIndex) {
        return;
      }
      const nextKey = INCLUDE_KEYS[index];
      setTabIndex(index);
      markTabLoadingIfNeeded(nextKey);
      if (pageWidth > 0) {
        pagerRef.current?.scrollTo({ x: index * pageWidth, animated: true });
      }
      const offset = Math.max(0, index * 88 - 48);
      tabBarRef.current?.scrollTo({ x: offset, animated: true });
    },
    [markTabLoadingIfNeeded, pageWidth, tabIndex],
  );

  const handlePagerMomentumEnd = useCallback(
    event => {
      if (pageWidth <= 0) {
        return;
      }
      const nextIndex = Math.round(
        event.nativeEvent.contentOffset.x / pageWidth,
      );
      if (
        nextIndex >= 0 &&
        nextIndex < INCLUDE_KEYS.length &&
        nextIndex !== tabIndex
      ) {
        const nextKey = INCLUDE_KEYS[nextIndex];
        setTabIndex(nextIndex);
        markTabLoadingIfNeeded(nextKey);
        const offset = Math.max(0, nextIndex * 88 - 48);
        tabBarRef.current?.scrollTo({ x: offset, animated: true });
      }
    },
    [markTabLoadingIfNeeded, pageWidth, tabIndex],
  );

  const handlePagerLayout = useCallback(
    event => {
      const width = event.nativeEvent.layout.width;
      if (width > 0 && width !== pageWidth) {
        setPageWidth(width);
        pagerRef.current?.scrollTo({
          x: tabIndex * width,
          animated: false,
        });
      }
    },
    [pageWidth, tabIndex],
  );

  const buildJsonPreview = useCallback(entry => {
    const payload =
      entry?.apiSnapshot ?? { section: entry?.sectionData ?? null };
    const text = JSON.stringify(payload, null, 2);
    if (text.length > 400) {
      return `${text.slice(0, 400)}…`;
    }
    return text;
  }, []);

  const handleCopyJsonForTab = useCallback(
    tabKey => {
      const entry = tabCache[tabKey];
      const payload = entry?.apiSnapshot ?? {
        employeeId,
        include: tabKey,
        basic: entry?.basicData ?? profileBasic,
        section: entry?.sectionData,
      };
      try {
        Clipboard.setString(JSON.stringify(payload, null, 2));
        presentSuccess({
          title: t('home.employeeProfile.copySuccessTitle'),
          message: t('home.employeeProfile.copySuccessMessage'),
        });
      } catch {
        presentError({
          title: t('home.employeeProfile.copyFailedTitle'),
          message: t('home.employeeProfile.copyFailedMessage'),
        });
      }
    },
    [employeeId, presentError, presentSuccess, profileBasic, t, tabCache],
  );

  const togglePermissionCategory = useCallback(category => {
    setExpandedPermissionCategories(prev =>
      prev.includes(category)
        ? prev.filter(item => item !== category)
        : [...prev, category],
    );
  }, []);

  const onAttendancePrevMonth = useCallback(() => {
    const next = shiftMonth(attendanceYear, attendanceMonth, -1);
    setAttendanceYear(next.year);
    setAttendanceMonth(next.month);
  }, [attendanceMonth, attendanceYear]);

  const onAttendanceNextMonth = useCallback(() => {
    const next = shiftMonth(attendanceYear, attendanceMonth, 1);
    setAttendanceYear(next.year);
    setAttendanceMonth(next.month);
  }, [attendanceMonth, attendanceYear]);

  const onAttendanceDayPress = useCallback((dateKey, dayInfo) => {
    setAttendanceSelectedDateKey(dateKey);
    setAttendanceSelectedDayInfo(dayInfo ?? null);
    setAttendanceDetailOpen(true);
  }, []);

  const closeAttendanceDetail = useCallback(() => {
    setAttendanceDetailOpen(false);
  }, []);

  const onLeavePress = useCallback(leave => {
    setSelectedLeave(leave);
  }, []);

  const closeLeaveDetail = useCallback(() => {
    setSelectedLeave(null);
  }, []);

  const openAssignSalary = useCallback(() => {
    setAssignSalaryApiError('');
    setAssignSalaryOverlapHint(false);
    setAssignSalaryVisible(true);
  }, []);

  const closeAssignSalary = useCallback(() => {
    if (assignSalarySubmitting) {
      return;
    }
    setAssignSalaryVisible(false);
    setAssignSalaryApiError('');
    setAssignSalaryOverlapHint(false);
  }, [assignSalarySubmitting]);

  const handleAssignSalarySubmit = useCallback(
    async payload => {
      if (!selectedCompany?.id) {
        return;
      }
      setAssignSalarySubmitting(true);
      setAssignSalaryApiError('');
      setAssignSalaryOverlapHint(false);
      try {
        const res = await salaryApi.assignSalary(selectedCompany.id, payload);
        if (!res.success) {
          const msg =
            res.message?.trim() ||
            t('home.employeeProfile.salary.assignModal.errors.submitFailed');
          setAssignSalaryApiError(msg);
          if (/overlap|already exists|selected period/i.test(msg)) {
            setAssignSalaryOverlapHint(true);
          }
          return;
        }
        setAssignSalaryVisible(false);
        setAssignSalaryApiError('');
        setAssignSalaryOverlapHint(false);
        presentSuccess(
          t('home.employeeProfile.salary.assignModal.successTitle'),
          res.message?.trim() ||
            t('home.employeeProfile.salary.assignModal.successMessage'),
        );
        setTabCache(prev => {
          const next = { ...prev };
          delete next.salary;
          return next;
        });
        loadTab('salary').catch(() => {});
      } catch (e) {
        const msg = readApiError(e);
        setAssignSalaryApiError(msg);
        if (/overlap|already exists|selected period/i.test(msg)) {
          setAssignSalaryOverlapHint(true);
        }
      } finally {
        setAssignSalarySubmitting(false);
      }
    },
    [loadTab, presentSuccess, selectedCompany?.id, t],
  );

  const assignSalaryEmployee = useMemo(() => {
    if (!employeeId) {
      return null;
    }
    return {
      id: Number(employeeId),
      name: profileBasic?.name?.trim() || t('home.employeeProfile.na'),
      employeeCode:
        profileBasic?.employee_code?.trim() || t('home.employeeProfile.na'),
    };
  }, [employeeId, profileBasic, t]);

  const renderTabPageBody = useCallback(
    tabKey => {
      const pageTheme = TAB_THEMES[tabKey] ?? TAB_THEMES.basic;
      const entry = tabCache[tabKey];
      const pageLabel =
        includeOptions.find(item => item.key === tabKey)?.label ?? tabKey;
      const sectionData = entry?.sectionData;
      const basicData = entry?.basicData ?? profileBasic;
      const pageError = entry?.error ?? '';
      const loadSettled = entry != null && loadingKey !== tabKey;
      const showSkeleton =
        !pageError &&
        sectionData == null &&
        (loadingKey === tabKey || tabKey === include || !loadSettled);
      const showNoDetails =
        !pageError && sectionData == null && loadSettled;

      if (showSkeleton) {
        return (
          <EmployeeProfileTabSkeleton
            tabKey={tabKey}
            styles={styles}
            scheme={resolvedScheme}
          />
        );
      }
      if (pageError) {
        return (
          <View style={styles.loadingWrap}>
            <Text style={styles.error}>{pageError}</Text>
            <Pressable
              onPress={() => {
                loadTab(tabKey).catch(() => {});
              }}
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>
                {t('home.employeeProfile.retry')}
              </Text>
            </Pressable>
          </View>
        );
      }
      if (showNoDetails) {
        return (
          <View style={styles.loadingWrap}>
            <Text style={styles.muted}>
              {t('home.employeeProfile.noDetails')}
            </Text>
          </View>
        );
      }

      return (
        <>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <MaterialCommunityIcons
                name={pageTheme.icon}
                size={20}
                color={pageTheme.accent}
              />
            </View>
            <Text style={styles.sectionTitle}>
              {t('home.employeeProfile.sectionDetails', {
                section: pageLabel,
              })}
            </Text>
            {tabKey === 'salary' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.employeeProfile.salary.createBtn')}
                onPress={openAssignSalary}
                style={({ pressed }) => [
                  styles.createBtn,
                  pressed && styles.createBtnPressed,
                ]}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                <Text style={styles.createBtnText}>
                  {t('home.employeeProfile.salary.createBtn')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {renderSectionContent({
            styles,
            include: tabKey,
            sectionData,
            basicData,
            theme: pageTheme,
            scheme: resolvedScheme,
            t,
            labelForKey,
            includeLabel: pageLabel,
            expandedPermissionCategories,
            togglePermissionCategory,
            attendanceYear,
            attendanceMonth,
            onAttendancePrevMonth,
            onAttendanceNextMonth,
            onAttendanceDayPress,
            onLeavePress,
          })}

          <View style={styles.copyCard}>
            <View style={styles.copyHeader}>
              <Text style={styles.copyTitle}>
                {t('home.employeeProfile.copyJson')}
              </Text>
              <Pressable
                onPress={() => handleCopyJsonForTab(tabKey)}
                style={styles.copyBtn}
                accessibilityRole="button"
                accessibilityLabel={t('home.employeeProfile.copyJson')}
              >
                <MaterialCommunityIcons
                  name="content-copy"
                  size={14}
                  color="#fff"
                />
                <Text style={styles.copyBtnText}>
                  {t('home.employeeProfile.copyJson')}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.copyHint}>
              {t('home.employeeProfile.rawJsonHint')}
            </Text>
            <View style={styles.jsonPreview}>
              <Text style={styles.jsonText} selectable>
                {buildJsonPreview(entry)}
              </Text>
            </View>
          </View>
        </>
      );
    },
    [
      attendanceMonth,
      attendanceYear,
      buildJsonPreview,
      expandedPermissionCategories,
      handleCopyJsonForTab,
      include,
      includeOptions,
      labelForKey,
      loadTab,
      loadingKey,
      onAttendanceDayPress,
      onAttendanceNextMonth,
      onAttendancePrevMonth,
      onLeavePress,
      openAssignSalary,
      profileBasic,
      resolvedScheme,
      styles,
      t,
      tabCache,
      togglePermissionCategory,
    ],
  );

  return (
    <SafeAreaView
      style={styles.safe}
      edges={TAB_SCREEN_SAFE_AREA_EDGES}
    >
      <View style={styles.header}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
        />
        <Text style={styles.headerTitle}>
          {t('home.employeeProfile.title')}
        </Text>
      </View>

      <View style={styles.fixedBlock}>
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            {hasProfileImage ? (
              <Image source={{ uri: profileImageUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(profileBasic?.name)}
                </Text>
              </View>
            )}
            <View style={styles.profileMain}>
              <Text style={styles.profileName} numberOfLines={2}>
                {profileBasic?.name?.trim() || t('home.employeeProfile.na')}
              </Text>
              <Text style={styles.profileCode}>
                {profileBasic?.employee_code?.trim() ||
                  t('home.employeeProfile.na')}
              </Text>
            </View>
          </View>
          <Text style={styles.profileEmail} numberOfLines={2}>
            {profileBasic?.email?.trim() || t('home.employeeProfile.na')}
          </Text>
        </View>

        <ScrollView
          ref={tabBarRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabRow}
        >
          {includeOptions.map((option, index) => {
            const active = tabIndex === index;
            const tabTheme = TAB_THEMES[option.key] ?? TAB_THEMES.basic;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => selectTab(index)}
                style={[
                  styles.chip,
                  active && styles.chipActive,
                  active && styles.chipActiveThemed,
                  active && { borderColor: tabTheme.accent },
                ]}
              >
                <MaterialCommunityIcons
                  name={tabTheme.icon}
                  size={14}
                  color={active ? tabTheme.accent : colors.textMuted}
                />
                <Text
                  style={[
                    styles.chipText,
                    active && styles.chipTextActive,
                    active && { color: tabTheme.accent },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.pagerFlex} onLayout={handlePagerLayout}>
        {pageWidth > 0 ? (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            style={styles.pager}
            scrollEventThrottle={16}
            onMomentumScrollEnd={handlePagerMomentumEnd}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {INCLUDE_KEYS.map(tabKey => (
              <View
                key={tabKey}
                style={[styles.pagerPage, { width: pageWidth }]}
              >
                <ScrollView
                  style={styles.pagerPageScroll}
                  contentContainerStyle={styles.pagerPageBody}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {renderTabPageBody(tabKey)}
                </ScrollView>
              </View>
            ))}
          </ScrollView>
        ) : (
          <EmployeeProfileTabSkeleton
            tabKey={include}
            styles={styles}
            scheme={resolvedScheme}
          />
        )}
      </View>
      <EmployeeAttendanceDayModal
        visible={attendanceDetailOpen}
        dateKey={attendanceSelectedDateKey}
        dayInfo={attendanceSelectedDayInfo}
        onClose={closeAttendanceDetail}
        styles={styles}
        t={t}
      />
      <LeaveDetailModal
        visible={selectedLeave != null}
        leave={selectedLeave}
        onDismiss={closeLeaveDetail}
      />
      <AssignSalaryModal
        visible={assignSalaryVisible}
        companyId={selectedCompany?.id ?? null}
        employee={assignSalaryEmployee}
        submitting={assignSalarySubmitting}
        apiError={assignSalaryApiError}
        showOverlapHint={assignSalaryOverlapHint}
        onDismiss={closeAssignSalary}
        onSubmit={payload => {
          handleAssignSalarySubmit(payload).catch(() => {});
        }}
      />
      <StatusAlert {...statusAlertProps} />
    </SafeAreaView>
  );
}
