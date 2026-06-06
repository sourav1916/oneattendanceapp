import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TFunction } from 'i18next';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import {
  StatusAlert,
  useStatusAlert,
} from '@src/components/modals/StatusAlert';
import { formatTime12h } from '@src/components/modals/TimePicker';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useCompanyInvites } from '@src/hooks/useCompanyInvites';
import { TAB_SCREEN_SAFE_AREA_EDGES } from '@src/constants/tabScreenLayout';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
  CompanyInviteAttendanceMethod,
  CompanyInviteDisplayStatus,
  CompanyInviteItem,
  CompanyInvitePermission,
  CompanyInviteWeekend,
} from '@src/types/companyInvite';
import { API_ENDPOINT } from '@src/utils/config';
import { OnboardEmployeeModal } from '@src/components/modals/OnboardEmployeeModal';

type Props = NativeStackScreenProps<HomeStackParamList, 'CompanyInvites'>;

const SKELETON_ROWS = 6;
const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.92;

function resolveDisplayStatus(
  invite: CompanyInviteItem,
): CompanyInviteDisplayStatus {
  if (new Date(invite.expires_at) < new Date()) {
    return 'expired';
  }
  return invite.status;
}

function resolveProfilePictureUrl(path: string | null): string | null {
  if (path == null || path.trim() === '') {
    return null;
  }
  const p = path.trim();
  if (p.startsWith('http://') || p.startsWith('https://')) {
    return p;
  }
  return `${API_ENDPOINT}${p.startsWith('/') ? '' : '/'}${p}`;
}

function formatLabel(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (
    typeof value === 'object' &&
    'label' in (value as Record<string, unknown>)
  ) {
    const label = (value as { label?: string }).label;
    if (label) {
      return label;
    }
  }
  const str = typeof value === 'string' ? value : String(value);
  if (!str) {
    return '';
  }
  return str
    .split(/[\s_]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatDuration(totalMinutes: number | string | null): string {
  if (totalMinutes == null) {
    return 'â€”';
  }
  const mins =
    typeof totalMinutes === 'string'
      ? parseInt(totalMinutes, 10)
      : totalMinutes;
  if (!Number.isFinite(mins)) {
    return 'â€”';
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[parts.length - 1]?.[0];
    if (a && b) {
      return `${a}${b}`.toUpperCase();
    }
  }
  const ch = name.trim()[0];
  return ch ? ch.toUpperCase() : '?';
}

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) {
    return iso.trim();
  }
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y!.slice(2)}`;
}

function formatShiftSpan(
  start: string | null,
  end: string | null,
): string | null {
  if (!start || !end) {
    return null;
  }
  return `${formatTime12h(start)} â€“ ${formatTime12h(end)}`;
}

function getStatusBadgeColors(
  status: CompanyInviteDisplayStatus,
  scheme: 'light' | 'dark',
  colors: AppThemeColors,
): { bg: string; text: string } {
  switch (status) {
    case 'pending':
      return {
        bg: scheme === 'dark' ? 'rgba(251,191,36,0.12)' : '#fffbeb',
        text: scheme === 'dark' ? '#fbbf24' : '#b45309',
      };
    case 'accepted':
      return {
        bg: scheme === 'dark' ? 'rgba(34,197,94,0.14)' : '#f0fdf4',
        text: scheme === 'dark' ? '#4ade80' : '#15803d',
      };
    case 'rejected':
    case 'cancelled':
      return {
        bg: colors.secondaryButton,
        text: colors.textMuted,
      };
    case 'expired':
      return {
        bg: scheme === 'dark' ? 'rgba(248,113,113,0.12)' : '#fef2f2',
        text: colors.danger,
      };
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    fill: { flex: 1 },
    stackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingRight: 12,
      minHeight: 52,
      maxHeight: 52,
    },
    stackHeaderTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    createBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 32,
    },

    // Search
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      marginBottom: 14,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
      fontSize: 16,
      color: colors.text,
    },
    clearBtn: { padding: 6 },

    // Center states
    centerBox: {
      paddingVertical: 40,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    muted: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 12,
    },
    error: {
      fontSize: 15,
      color: colors.danger,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 12,
    },
    retryBtn: {
      marginTop: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryLabel: { color: '#fff', fontWeight: '600', fontSize: 16 },

    // List card
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: scheme === 'dark' ? 0.2 : 0.06,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.secondaryButton,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarInitials: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    cardMain: { flex: 1, minWidth: 0 },
    name: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    subline: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
    sublineMuted: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 10,
      alignItems: 'center',
    },
    metaLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
    metaMuted: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
    shiftLine: { marginTop: 8, fontSize: 13, color: colors.textMuted },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 10,
      gap: 6,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionBtnDanger: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      borderColor:
        scheme === 'dark' ? 'rgba(248,113,113,0.3)' : '#fecaca',
    },
    actionBtnText: { fontSize: 12, fontWeight: '600', color: colors.text },
    actionBtnTextDanger: { color: colors.danger },

    // Footer
    footerBox: { paddingVertical: 16, alignItems: 'center' },

    // Skeleton
    skCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    skRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    skCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        scheme === 'dark' ? '#334155' : colors.secondaryButton,
    },
    skBar: {
      height: 14,
      borderRadius: 7,
      backgroundColor:
        scheme === 'dark' ? '#334155' : colors.secondaryButton,
      marginBottom: 8,
    },
    skBarShort: {
      height: 12,
      borderRadius: 6,
      width: '55%',
      backgroundColor: scheme === 'dark' ? '#1e293b' : colors.border,
    },
    skMeta: {
      marginTop: 12,
      height: 12,
      borderRadius: 6,
      width: '70%',
      backgroundColor:
        scheme === 'dark' ? '#334155' : colors.secondaryButton,
    },
    skBarWide: {
      width: '62%',
    },

    // Bottom sheet modal
    modalSafe: { flex: 1, backgroundColor: colors.overlay },
    modalBackdrop: { ...StyleSheet.absoluteFill },
    sheetWrap: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: SHEET_MAX_HEIGHT,
      flexDirection: 'column',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: { elevation: 12 },
      }),
    },
    sheetForm: {
      height: SHEET_MAX_HEIGHT,
    },
    sheetScroll: {
      flex: 1,
      minHeight: 0,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 8,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    sheetCloseBtn: { padding: 6 },
    sheetBody: { paddingHorizontal: 20, paddingVertical: 16 },

    // View modal sections
    viewHero: {
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.35)' : '#bfdbfe',
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.12)' : '#eff6ff',
    },
    viewHeroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    viewHeroMain: { flex: 1, minWidth: 0 },
    viewHeroName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 26,
    },
    viewHeroEmail: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 4,
    },
    viewHeroMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 6,
    },
    viewSectionCard: {
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    viewSectionCardSchedule: {
      borderColor:
        scheme === 'dark' ? 'rgba(251,191,36,0.35)' : '#fde68a',
      backgroundColor:
        scheme === 'dark' ? 'rgba(251,191,36,0.08)' : '#fffbeb',
    },
    viewSectionCardPermissions: {
      borderColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.35)' : '#bfdbfe',
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.1)' : '#eff6ff',
    },
    viewSectionCardAttendance: {
      borderColor:
        scheme === 'dark' ? 'rgba(74,222,128,0.35)' : '#bbf7d0',
      backgroundColor:
        scheme === 'dark' ? 'rgba(34,197,94,0.08)' : '#f0fdf4',
    },
    viewSectionCardWeekends: {
      borderColor:
        scheme === 'dark' ? 'rgba(167,139,250,0.35)' : '#ddd6fe',
      backgroundColor:
        scheme === 'dark' ? 'rgba(139,92,246,0.1)' : '#f5f3ff',
    },
    viewSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    viewSectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    viewSectionTitleSchedule: {
      color: scheme === 'dark' ? '#fbbf24' : '#b45309',
    },
    viewSectionTitlePermissions: {
      color: colors.primary,
    },
    viewSectionTitleAttendance: {
      color: scheme === 'dark' ? '#4ade80' : '#15803d',
    },
    viewSectionTitleWeekends: {
      color: scheme === 'dark' ? '#a78bfa' : '#6d28d9',
    },
    viewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      gap: 12,
    },
    viewLabel: { fontSize: 14, color: colors.textMuted, flex: 1 },
    viewValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    viewStatusWrap: {
      alignSelf: 'flex-end',
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: colors.secondaryButton,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipPermission: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.15)' : '#eff6ff',
      borderColor: scheme === 'dark' ? 'rgba(96,165,250,0.4)' : '#bfdbfe',
    },
    chipPermissionText: {
      color: colors.primary,
    },
    chipSchedule: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(251,191,36,0.12)' : '#fffbeb',
      borderColor: scheme === 'dark' ? 'rgba(251,191,36,0.35)' : '#fde68a',
    },
    chipScheduleText: {
      color: scheme === 'dark' ? '#fbbf24' : '#b45309',
    },
    chipWeekend: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(139,92,246,0.12)' : '#f5f3ff',
      borderColor: scheme === 'dark' ? 'rgba(167,139,250,0.35)' : '#ddd6fe',
    },
    chipWeekendText: {
      color: scheme === 'dark' ? '#a78bfa' : '#6d28d9',
    },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    chipAuto: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginLeft: 4,
    },
    chipAutoText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#fff',
    },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusBadgeMarginTop: {
      marginTop: 6,
    },
    chipWrapMarginTop: {
      marginTop: 8,
    },
    metaDot: {
      fontSize: 13,
      color: colors.textMuted,
      marginHorizontal: 6,
    },
  });
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function InviteListSkeleton({
  styles,
  count = SKELETON_ROWS,
}: {
  styles: ReturnType<typeof buildStyles>;
  count?: number;
}) {
  const pulse = useRef(new Animated.Value(0.38)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.92,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.skCard}>
          <View style={styles.skRow}>
            <View style={styles.skCircle} />
            <View style={styles.fill}>
              <View style={[styles.skBar, styles.skBarWide]} />
              <View style={[styles.skBar, styles.skBarShort]} />
            </View>
          </View>
          <View style={styles.skMeta} />
        </View>
      ))}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// AvatarView
// ---------------------------------------------------------------------------
function AvatarView({
  uri,
  name,
  size,
  styles,
}: {
  uri: string | null;
  name: string;
  size: number;
  styles: ReturnType<typeof buildStyles>;
}) {
  const avatarStyle = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
    }),
    [size],
  );
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, avatarStyle]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.avatar, styles.avatarPlaceholder, avatarStyle]}>
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------
function StatusBadge({
  status,
  scheme,
  colors,
  styles,
  t,
}: {
  status: CompanyInviteDisplayStatus;
  scheme: 'light' | 'dark';
  colors: AppThemeColors;
  styles: ReturnType<typeof buildStyles>;
  t: TFunction;
}) {
  const badgeColors = getStatusBadgeColors(status, scheme, colors);
  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: badgeColors.bg, borderColor: badgeColors.bg },
      ]}>
      <Text style={[styles.statusBadgeText, { color: badgeColors.text }]}>
        {t(`home.companyInvites.status.${status}`)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// InviteListRow (memoized)
// ---------------------------------------------------------------------------
type InviteListRowProps = {
  invite: CompanyInviteItem;
  scheme: 'light' | 'dark';
  colors: AppThemeColors;
  styles: ReturnType<typeof buildStyles>;
  t: TFunction;
  onView: (invite: CompanyInviteItem) => void;
  onCancel: (invite: CompanyInviteItem) => void;
  onResend: (invite: CompanyInviteItem) => void;
};

const InviteListRow = React.memo(function InviteListRow({
  invite,
  scheme,
  colors,
  styles,
  t,
  onView,
  onCancel,
  onResend,
}: InviteListRowProps) {
  const displayStatus = resolveDisplayStatus(invite);
  const uri = resolveProfilePictureUrl(invite.user.profile_picture);
  const shift = formatShiftSpan(invite.shift_start, invite.shift_end);
  const isPending = invite.status === 'pending';
  const isExpired = displayStatus === 'expired';

  const dateLabel = isExpired
    ? t('home.companyInvites.expired', { date: formatDate(invite.expires_at) })
    : isPending
      ? t('home.companyInvites.expires', { date: formatDate(invite.expires_at) })
      : t('home.companyInvites.sent', { date: formatDate(invite.created_at) });

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <AvatarView
          uri={uri}
          name={invite.user.name}
          size={48}
          styles={styles}
        />
        <View style={styles.cardMain}>
          <Text style={styles.name} numberOfLines={1}>
            {invite.user.name}
          </Text>
          <Text style={styles.subline} numberOfLines={1}>
            {invite.user.email || 'â€”'}
          </Text>
          <View style={styles.metaRow}>
            {invite.designation ? (
              <Text style={styles.metaMuted} numberOfLines={1}>
                {formatLabel(invite.designation)}
              </Text>
            ) : null}
            {invite.designation && invite.employment_type ? (
              <Text style={styles.metaDot}>Â·</Text>
            ) : null}
            {invite.employment_type ? (
              <Text style={styles.metaMuted} numberOfLines={1}>
                {formatLabel(invite.employment_type)}
              </Text>
            ) : null}
            {(invite.designation || invite.employment_type) &&
              invite.salary_type ? (
              <Text style={styles.metaDot}>Â·</Text>
            ) : null}
            {invite.salary_type ? (
              <Text style={styles.metaMuted} numberOfLines={1}>
                {formatLabel(invite.salary_type)}
              </Text>
            ) : null}
          </View>
          {shift ? (
            <Text style={styles.shiftLine}>{shift}</Text>
          ) : null}
        </View>
        <StatusBadge
          status={displayStatus}
          scheme={scheme}
          colors={colors}
          styles={styles}
          t={t}
        />
      </View>
      <Text style={styles.sublineMuted}>{dateLabel}</Text>
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => onView(invite)}
          accessibilityRole="button">
          <MaterialCommunityIcons
            name="eye-outline"
            size={14}
            color={colors.text}
          />
          <Text style={styles.actionBtnText}>
            {t('home.companyInvites.actions.view')}
          </Text>
        </Pressable>
        {isPending && !isExpired ? (
          <Pressable
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => onCancel(invite)}
            accessibilityRole="button">
            <MaterialCommunityIcons
              name="cancel"
              size={14}
              color={colors.danger}
            />
            <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>
              {t('home.companyInvites.actions.cancel')}
            </Text>
          </Pressable>
        ) : null}
        {isPending ? (
          <Pressable
            style={styles.actionBtn}
            onPress={() => onResend(invite)}
            accessibilityRole="button">
            <MaterialCommunityIcons
              name="send"
              size={14}
              color={colors.text}
            />
            <Text style={styles.actionBtnText}>
              {t('home.companyInvites.actions.resend')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});


// ---------------------------------------------------------------------------
// ViewDetailsModal
// ---------------------------------------------------------------------------
type ViewDetailsModalProps = {
  visible: boolean;
  invite: CompanyInviteItem | null;
  onDismiss: () => void;
  scheme: 'light' | 'dark';
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
  t: TFunction;
};

function ViewDetailsModal({
  visible,
  invite,
  onDismiss,
  scheme,
  styles,
  colors,
  t,
}: ViewDetailsModalProps) {
  if (!invite) {
    return null;
  }

  const uri = resolveProfilePictureUrl(invite.user.profile_picture);
  const displayStatus = resolveDisplayStatus(invite);
  const shiftSpan = formatShiftSpan(invite.shift_start, invite.shift_end);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView
        style={styles.modalSafe}
        edges={TAB_SCREEN_SAFE_AREA_EDGES}>
        <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={[styles.sheet, styles.sheetForm]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {t('home.companyInvites.viewModal.title')}
              </Text>
              <Pressable
                style={styles.sheetCloseBtn}
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel={t('home.companyInvites.viewModal.close')}>
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetBody}
              bounces={false}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled>
              <View style={styles.viewHero}>
                <View style={styles.viewHeroTop}>
                  <AvatarView
                    uri={uri}
                    name={invite.user.name}
                    size={64}
                    styles={styles}
                  />
                  <View style={styles.viewHeroMain}>
                    <Text style={styles.viewHeroName} numberOfLines={2}>
                      {invite.user.name}
                    </Text>
                    <Text style={styles.viewHeroEmail} numberOfLines={2}>
                      {invite.user.email || 'â€”'}
                    </Text>
                    {shiftSpan ? (
                      <Text style={styles.viewHeroMeta} numberOfLines={1}>
                        {shiftSpan}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.viewStatusWrap}>
                    <StatusBadge
                      status={displayStatus}
                      scheme={scheme}
                      colors={colors}
                      styles={styles}
                      t={t}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.viewSectionCard}>
                <View style={styles.viewSectionHeader}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.viewSectionTitle}>
                    {t('home.companyInvites.viewModal.infoSection')}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.designation')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatLabel(invite.designation) || 'â€”'}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.employmentType')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatLabel(invite.employment_type) || 'â€”'}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.salaryType')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatLabel(invite.salary_type) || 'â€”'}
                  </Text>
                </View>
                {invite.permission_package ? (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.companyInvites.viewModal.permissionPackage')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {invite.permission_package.name}
                    </Text>
                  </View>
                ) : null}
                {invite.invited_by ? (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.companyInvites.viewModal.invitedBy')}
                    </Text>
                    <Text style={styles.viewValue}>
                      {invite.invited_by.name}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.sentDate')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatDate(invite.created_at)}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.expiresAt')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatDate(invite.expires_at)}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.viewSectionCard,
                  styles.viewSectionCardSchedule,
                ]}>
                <View style={styles.viewSectionHeader}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={18}
                    color={scheme === 'dark' ? '#fbbf24' : '#b45309'}
                  />
                  <Text
                    style={[
                      styles.viewSectionTitle,
                      styles.viewSectionTitleSchedule,
                    ]}>
                    {t('home.companyInvites.viewModal.scheduleSection')}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.shiftStart')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {invite.shift_start
                      ? formatTime12h(invite.shift_start)
                      : 'â€”'}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.shiftEnd')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {invite.shift_end
                      ? formatTime12h(invite.shift_end)
                      : 'â€”'}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.breakMinutes')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatDuration(invite.break_minutes)}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.graceMinutes')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {formatDuration(invite.grace_minutes)}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.viewSectionCard,
                  styles.viewSectionCardPermissions,
                ]}>
                <View style={styles.viewSectionHeader}>
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.viewSectionTitle,
                      styles.viewSectionTitlePermissions,
                    ]}>
                    {t('home.companyInvites.viewModal.permissionsSection')}
                  </Text>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.permissionCount', {
                      count: invite.permissions.length,
                    })}
                  </Text>
                </View>
                {invite.permissions.length > 0 ? (
                  <View style={styles.chipWrap}>
                    {invite.permissions.map((perm: CompanyInvitePermission) => (
                      <View
                        key={perm.id}
                        style={[styles.chip, styles.chipPermission]}>
                        <Text
                          style={[styles.chipText, styles.chipPermissionText]}>
                          {perm.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.muted}>
                    {t('home.companyInvites.viewModal.na')}
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.viewSectionCard,
                  styles.viewSectionCardAttendance,
                ]}>
                <View style={styles.viewSectionHeader}>
                  <MaterialCommunityIcons
                    name="fingerprint"
                    size={18}
                    color={scheme === 'dark' ? '#4ade80' : '#15803d'}
                  />
                  <Text
                    style={[
                      styles.viewSectionTitle,
                      styles.viewSectionTitleAttendance,
                    ]}>
                    {t('home.companyInvites.viewModal.attendanceSection')}
                  </Text>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.methodCount', {
                      count: invite.attendance_methods.length,
                    })}
                  </Text>
                </View>
                {invite.attendance_methods.length > 0 ? (
                  <View style={styles.chipWrap}>
                    {invite.attendance_methods.map(
                      (m: CompanyInviteAttendanceMethod, idx: number) => (
                        <View
                          key={idx}
                          style={[styles.chip, styles.chipSchedule]}>
                          <View style={styles.chipRow}>
                            <Text style={styles.chipScheduleText}>
                              {formatLabel(m.method)}
                            </Text>
                            {m.is_auto ? (
                              <View style={styles.chipAuto}>
                                <Text style={styles.chipAutoText}>
                                  {t('home.companyInvites.viewModal.auto')}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      ),
                    )}
                  </View>
                ) : (
                  <Text style={styles.muted}>
                    {t('home.companyInvites.viewModal.na')}
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.viewSectionCard,
                  styles.viewSectionCardWeekends,
                ]}>
                <View style={styles.viewSectionHeader}>
                  <MaterialCommunityIcons
                    name="calendar-weekend"
                    size={18}
                    color={scheme === 'dark' ? '#a78bfa' : '#6d28d9'}
                  />
                  <Text
                    style={[
                      styles.viewSectionTitle,
                      styles.viewSectionTitleWeekends,
                    ]}>
                    {t('home.companyInvites.viewModal.weekendsSection')}
                  </Text>
                  <Text style={styles.viewLabel}>
                    {t('home.companyInvites.viewModal.weekendCount', {
                      count: invite.weekends.length,
                    })}
                  </Text>
                </View>
                {invite.weekends.length > 0 ? (
                  <View style={styles.chipWrap}>
                    {invite.weekends.map(
                      (w: CompanyInviteWeekend, idx: number) => (
                        <View
                          key={idx}
                          style={[styles.chip, styles.chipWeekend]}>
                          <Text style={styles.chipWeekendText}>
                            {formatLabel(w.day)}
                            {' Â· '}
                            {w.type === 'full'
                              ? t('home.companyInvites.viewModal.full')
                              : w.type === 'half'
                                ? t('home.companyInvites.viewModal.half')
                                : t('home.companyInvites.viewModal.na')}
                          </Text>
                        </View>
                      ),
                    )}
                  </View>
                ) : (
                  <Text style={styles.muted}>
                    {t('home.companyInvites.viewModal.na')}
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// CompanyInvitesScreen
// ---------------------------------------------------------------------------
export function CompanyInvitesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;

  const {
    props: statusProps,
    presentError,
    presentSuccess,
  } = useStatusAlert();
  const { props: confirmProps, present: presentConfirm } = useConfirmAlert();

  const [viewInvite, setViewInvite] = useState<CompanyInviteItem | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [onboardModalVisible, setOnboardModalVisible] = useState(false);

  const onError = useCallback(
    (msg: string) => {
      presentError({ title: t('home.companyInvites.apiError'), message: msg });
    },
    [presentError, t],
  );
  const onSuccess = useCallback(
    (msg: string) => {
      presentSuccess({ title: t('home.companyInvites.title'), message: msg });
    },
    [presentSuccess, t],
  );

  const {
    invites,
    loading,
    loadingMore,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    loadMore,
    retry,
    cancelInvite,
    resendInvite,
  } = useCompanyInvites({ companyId, onError, onSuccess });

  const handleView = useCallback((invite: CompanyInviteItem) => {
    setViewInvite(invite);
    setViewModalVisible(true);
  }, []);

  const handleCancel = useCallback(
    (invite: CompanyInviteItem) => {
      presentConfirm({
        title: t('home.companyInvites.cancelModal.title'),
        message: t('home.companyInvites.cancelModal.message', {
          name: invite.user.name,
        }),
        buttons: [
          {
            key: 'dismiss',
            text: t('home.companyInvites.cancelModal.cancel'),
            variant: 'secondary',
          },
          {
            key: 'confirm',
            text: t('home.companyInvites.cancelModal.confirm'),
            variant: 'danger',
            onPress: () => {
              cancelInvite(invite.token).catch(() => { });
            },
          },
        ],
      });
    },
    [presentConfirm, t, cancelInvite],
  );

  const handleResend = useCallback(
    (invite: CompanyInviteItem) => {
      resendInvite(invite.invite_id).catch(() => { });
    },
    [resendInvite],
  );

  const handleDismissViewModal = useCallback(() => {
    setViewModalVisible(false);
    setViewInvite(null);
  }, []);

  const handleOpenOnboard = useCallback(() => {
    if (companyId == null) {
      presentError({
        title: t('home.companyInvites.title'),
        message: t('home.companyInvites.onboardModal.noCompany'),
      });
      return;
    }
    setOnboardModalVisible(true);
  }, [companyId, presentError, t]);

  const handleDismissOnboard = useCallback(() => {
    setOnboardModalVisible(false);
  }, []);

  const handleInviteSent = useCallback(() => {
    setOnboardModalVisible(false);
    refresh();
    presentSuccess({
      title: t('home.companyInvites.onboardModal.title'),
      message: t('home.companyInvites.onboardModal.sendSuccess'),
    });
  }, [presentSuccess, refresh, t]);

  const keyExtractor = useCallback(
    (item: CompanyInviteItem) => String(item.invite_id),
    [],
  );

  const renderListItem = useCallback(
    ({ item }: { item: CompanyInviteItem }) => (
      <InviteListRow
        invite={item}
        scheme={resolvedScheme}
        colors={colors}
        styles={styles}
        t={t}
        onView={handleView}
        onCancel={handleCancel}
        onResend={handleResend}
      />
    ),
    [resolvedScheme, colors, styles, t, handleView, handleCancel, handleResend],
  );

  const listHeader = useMemo(
    () => (
      <View>
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t('home.companyInvites.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 ? (
            <Pressable
              style={styles.clearBtn}
              onPress={() => setSearch('')}
              accessibilityRole="button">
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
        {loading ? <InviteListSkeleton styles={styles} /> : null}
      </View>
    ),
    [colors.textMuted, loading, search, setSearch, styles, t],
  );

  const ListEmptyComponent = useMemo(() => {
    if (companyId == null) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons
            name="office-building-outline"
            size={40}
            color={colors.textMuted}
          />
          <Text style={styles.muted}>
            {t('home.companyInvites.noCompany')}
          </Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={40}
            color={colors.danger}
          />
          <Text style={styles.error}>{error}</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={retry}
            accessibilityRole="button">
            <Text style={styles.retryLabel}>
              {t('home.companyInvites.retry')}
            </Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.centerBox}>
        <MaterialCommunityIcons
          name="email-outline"
          size={40}
          color={colors.textMuted}
        />
        <Text style={styles.muted}>{t('home.companyInvites.empty')}</Text>
      </View>
    );
  }, [companyId, error, styles, colors, t, retry]);

  const ListFooterComponent = useMemo(() => {
    if (!loadingMore) {
      return null;
    }
    return (
      <View style={styles.footerBox}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }, [loadingMore, styles, colors]);

  return (
    <SafeAreaView
      style={styles.safe}
      edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      {/* Header */}
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
        />
        <Text style={styles.stackHeaderTitle}>
          {t('home.companyInvites.title')}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [
              styles.createBtn,
              pressed && { opacity: 0.88 },
            ]}
            onPress={handleOpenOnboard}
            accessibilityRole="button"
            accessibilityLabel={t('home.companyInvites.onboardBtn')}>
            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
            <Text style={styles.createBtnText}>
              {t('home.companyInvites.onboardBtn')}
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={loading ? [] : invites}
        keyExtractor={keyExtractor}
        renderItem={renderListItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
      />

      <OnboardEmployeeModal
        visible={onboardModalVisible}
        companyId={companyId}
        onDismiss={handleDismissOnboard}
        onInviteSent={handleInviteSent}
      />

      {/* View Details Modal */}
      <ViewDetailsModal
        visible={viewModalVisible}
        invite={viewInvite}
        onDismiss={handleDismissViewModal}
        scheme={resolvedScheme}
        styles={styles}
        colors={colors}
        t={t}
      />

      {/* Alert Modals */}
      <StatusAlert {...statusProps} />
      <ConfirmAlert {...confirmProps} />
    </SafeAreaView>
  );
}
