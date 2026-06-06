import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TFunction } from 'i18next';
import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
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
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { usePermissionPackages } from '@src/hooks/usePermissionPackages';
import { TAB_SCREEN_SAFE_AREA_EDGES } from '@src/constants/tabScreenLayout';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
    PermissionListItem,
    PermissionPackageFormData,
    PermissionPackageListItem,
} from '@src/types/permissionManagement';

type Props = NativeStackScreenProps<HomeStackParamList, 'PermissionManagement'>;

const SKELETON_ROWS = 6;
const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.92;

const EMPTY_FORM: PermissionPackageFormData = {
    package_name: '',
    group_code: '',
    description: '',
    permission_ids: [],
};

type ModalType = 'NONE' | 'CREATE' | 'EDIT' | 'VIEW';

function formatLabel(value: string): string {
  if (!value) {
    return '';
  }
  return value
    .split(/[\s_.]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

type CategoryPalette = {
  border: string;
  bg: string;
  header: string;
  accent: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

const CATEGORY_ICON_MAP: Record<
  string,
  React.ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
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
  'permission package': 'shield-key-outline',
  transaction: 'swap-horizontal',
  'invoice prefix': 'file-table-outline',
  other: 'shield-outline',
};

const CATEGORY_PALETTES_LIGHT: Omit<CategoryPalette, 'icon'>[] = [
  { border: '#bfdbfe', bg: '#f8fbff', header: '#eff6ff', accent: '#2563eb' },
  { border: '#fde68a', bg: '#fffdf5', header: '#fffbeb', accent: '#b45309' },
  { border: '#bbf7d0', bg: '#f7fef9', header: '#f0fdf4', accent: '#15803d' },
  { border: '#ddd6fe', bg: '#faf8ff', header: '#f5f3ff', accent: '#6d28d9' },
  { border: '#fecaca', bg: '#fffafa', header: '#fef2f2', accent: '#dc2626' },
  { border: '#a5f3fc', bg: '#f5feff', header: '#ecfeff', accent: '#0891b2' },
  { border: '#fbcfe8', bg: '#fffafd', header: '#fdf2f8', accent: '#be185d' },
  { border: '#d9f99d', bg: '#fafef5', header: '#f7fee7', accent: '#4d7c0f' },
];

function hashCategoryKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h + key.charCodeAt(i)) % CATEGORY_PALETTES_LIGHT.length;
  }
  return h;
}

function getCategoryPalette(
  category: string,
  scheme: 'light' | 'dark',
): CategoryPalette {
  const key = category.toLowerCase();
  const icon = CATEGORY_ICON_MAP[key] ?? CATEGORY_ICON_MAP.other!;
  const idx = hashCategoryKey(key);
  const base = CATEGORY_PALETTES_LIGHT[idx]!;
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
    border: darkBorders[idx] ?? darkBorders[0]!,
    bg: darkHeaders[idx] ?? darkHeaders[0]!,
    header: darkHeaders[idx] ?? darkHeaders[0]!,
    accent: base.accent,
    icon,
  };
}

function categorySelectionState(
  ids: number[],
  selected: number[],
): { all: boolean; partial: boolean; count: number } {
  const count = ids.filter(id => selected.includes(id)).length;
  return {
    count,
    all: ids.length > 0 && count === ids.length,
    partial: count > 0 && count < ids.length,
  };
}

function groupPermissionsByCategory<T extends { category?: string }>(
  permissions: T[],
): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const p of permissions) {
    const cat = p.category || 'other';
    const list = map.get(cat) ?? [];
    list.push(p);
    map.set(cat, list);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function buildFormFromPackage(
    pkg: PermissionPackageListItem,
): PermissionPackageFormData {
    return {
        package_name: pkg.package_name,
        group_code: pkg.group_code ?? '',
        description: pkg.description ?? '',
        permission_ids: (pkg.permissions ?? []).map(p => p.id),
    };
}

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
        headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        createBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: colors.primary,
        },
        createBtnPressed: { opacity: 0.88 },
        createBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
        listContent: {
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 32,
        },
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
        cardIcon: {
            width: 44,
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
                scheme === 'dark' ? 'rgba(96,165,250,0.15)' : '#eff6ff',
            borderWidth: 1,
            borderColor: scheme === 'dark' ? 'rgba(96,165,250,0.35)' : '#bfdbfe',
        },
        cardMain: { flex: 1, minWidth: 0 },
        cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
        cardSub: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
        cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
        cardActions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
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
            borderColor: scheme === 'dark' ? 'rgba(248,113,113,0.35)' : '#fecaca',
            backgroundColor:
                scheme === 'dark' ? 'rgba(248,113,113,0.12)' : '#fef2f2',
        },
        actionBtnText: { fontSize: 12, fontWeight: '600', color: colors.text },
        actionBtnTextDanger: { color: colors.danger },
        footerBox: { paddingVertical: 16, alignItems: 'center' },
        skCard: {
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
        },
        skBar: {
            height: 12,
            borderRadius: 6,
            backgroundColor: scheme === 'dark' ? '#334155' : colors.border,
        },
        skBarWide: { width: '70%', marginBottom: 8 },
        skBarShort: { width: '45%' },
        modalSafe: { flex: 1, backgroundColor: colors.overlay },
        modalBackdrop: { ...StyleSheet.absoluteFill },
        sheetWrap: { flex: 1, justifyContent: 'flex-end' },
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
        sheetForm: { height: SHEET_MAX_HEIGHT },
        sheetScroll: { flex: 1, minHeight: 0 },
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
        sheetFooter: {
            flexDirection: 'row',
            gap: 10,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 8 : 16,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        cancelBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            backgroundColor: colors.secondaryButton,
            borderWidth: 1,
            borderColor: colors.border,
        },
        cancelBtnText: { color: colors.text, fontWeight: '600', fontSize: 16 },
        saveBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            backgroundColor: colors.primary,
        },
        saveBtnDisabled: { opacity: 0.5 },
        saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
        formGroup: { marginBottom: 14 },
        formLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 6,
        },
        formInput: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: Platform.OS === 'ios' ? 12 : 10,
            fontSize: 16,
            color: colors.text,
            backgroundColor: colors.background,
        },
        remarksInput: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            color: colors.text,
            backgroundColor: colors.background,
            minHeight: 80,
            textAlignVertical: 'top',
        },
        formError: {
            fontSize: 13,
            color: colors.danger,
            marginTop: 4,
            fontWeight: '500',
        },
    permSearch: { marginBottom: 10 },
    permSectionCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.35)' : '#bfdbfe',
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.08)' : '#f8fbff',
      padding: 12,
      marginTop: 4,
    },
    permSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      gap: 8,
    },
    permSectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    permSectionIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.2)' : '#eff6ff',
    },
    permCountBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    permCountBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#fff',
    },
    permSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      marginBottom: 10,
    },
    permSearchIcon: { marginRight: 8 },
    permSearchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      fontSize: 15,
      color: colors.text,
    },
    permGlobalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.45)' : '#93c5fd',
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.15)' : '#eff6ff',
    },
    permGlobalLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    permGlobalSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    permCategoryCard: {
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 10,
      overflow: 'hidden',
    },
    permCategoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    permCategoryHeaderMain: { flex: 1, minWidth: 0 },
    permCategoryTitle: {
      fontSize: 14,
      fontWeight: '700',
    },
    permCategoryMeta: {
      fontSize: 11,
      marginTop: 2,
      fontWeight: '500',
    },
    permCategoryIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        scheme === 'dark' ? 'rgba(255,255,255,0.08)' : '#fff',
    },
    permGroupSelectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      backgroundColor:
        scheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
    },
    permGroupSelectLabel: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
    },
    permList: {},
    permRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface,
    },
    permRowSelected: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.1)' : '#f0f9ff',
    },
    permRowLast: { borderBottomWidth: 0 },
    permRowMain: { flex: 1, minWidth: 0 },
    permRowName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    permRowNameSelected: { color: colors.primary },
    permRowCode: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    permActionBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      maxWidth: 88,
      backgroundColor:
        scheme === 'dark' ? 'rgba(255,255,255,0.1)' : '#fff',
      borderWidth: 1,
    },
    permActionBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    permEmptyFilter: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    permEmptyFilterText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    categoryTitle: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.primary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginTop: 8,
            marginBottom: 8,
        },
        chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        chipWrapTop: { marginTop: 8 },
        chip: {
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        chipActive: {
            borderColor: colors.primary,
            backgroundColor:
                scheme === 'dark' ? 'rgba(96,165,250,0.15)' : '#eff6ff',
        },
        chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
        chipTextActive: { color: colors.primary },
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
        viewHeroName: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        viewHeroCode: { fontSize: 14, color: colors.textMuted },
        viewSection: {
            borderRadius: 14,
            padding: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
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
        chipPermission: {
            backgroundColor:
                scheme === 'dark' ? 'rgba(96,165,250,0.15)' : '#eff6ff',
            borderColor: scheme === 'dark' ? 'rgba(96,165,250,0.4)' : '#bfdbfe',
        },
        chipPermissionText: { color: colors.primary },
    });
}

function PackageListSkeleton({
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
                    <View style={[styles.skBar, styles.skBarWide]} />
                    <View style={[styles.skBar, styles.skBarShort]} />
                </View>
            ))}
        </Animated.View>
    );
}

type PackageRowProps = {
    item: PermissionPackageListItem;
    styles: ReturnType<typeof buildStyles>;
    colors: AppThemeColors;
    t: TFunction;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
};

const PackageRow = React.memo(function PackageRow({
    item,
    styles,
    colors,
    t,
    onView,
    onEdit,
    onDelete,
}: PackageRowProps) {
    const permCount = item.permissions?.length ?? 0;
    const usedCount = item.total_used ?? 0;
    return (
        <View style={styles.card}>
            <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                    <MaterialCommunityIcons
                        name="shield-key-outline"
                        size={22}
                        color={colors.primary}
                    />
                </View>
                <View style={styles.cardMain}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.package_name}
                    </Text>
                    {item.group_code ? (
                        <Text style={styles.cardSub} numberOfLines={1}>
                            {item.group_code}
                        </Text>
                    ) : null}
                    <Text style={styles.cardMeta}>
                        {t('home.permissionManagement.packageMeta', {
                            permissions: permCount,
                            used: usedCount,
                        })}
                    </Text>
                </View>
            </View>
            <View style={styles.cardActions}>
                <Pressable
                    style={styles.actionBtn}
                    onPress={onView}
                    accessibilityRole="button">
                    <MaterialCommunityIcons name="eye-outline" size={14} color={colors.text} />
                    <Text style={styles.actionBtnText}>
                        {t('home.permissionManagement.actions.view')}
                    </Text>
                </Pressable>
                <Pressable
                    style={styles.actionBtn}
                    onPress={onEdit}
                    accessibilityRole="button">
                    <MaterialCommunityIcons name="pencil-outline" size={14} color={colors.text} />
                    <Text style={styles.actionBtnText}>
                        {t('home.permissionManagement.actions.edit')}
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.actionBtn, styles.actionBtnDanger]}
                    onPress={onDelete}
                    accessibilityRole="button">
                    <MaterialCommunityIcons name="delete-outline" size={14} color={colors.danger} />
                    <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>
                        {t('home.permissionManagement.actions.delete')}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
});

type PackageFormModalProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  pkg: PermissionPackageListItem | null;
  allPermissions: PermissionListItem[];
  permissionsLoading: boolean;
  saving: boolean;
  onSave: (form: PermissionPackageFormData) => void;
  onDismiss: () => void;
  styles: ReturnType<typeof buildStyles>;
  colors: AppThemeColors;
  t: TFunction;
};

type PermissionCheckboxProps = {
  checked: boolean;
  partial?: boolean;
  color: string;
  size?: number;
};

function PermissionCheckbox({
  checked,
  partial = false,
  color,
  size = 22,
}: PermissionCheckboxProps) {
  const iconName = checked
    ? 'checkbox-marked'
    : partial
      ? 'minus-box'
      : 'checkbox-blank-outline';
  return (
    <MaterialCommunityIcons name={iconName} size={size} color={color} />
  );
}

function PackageFormModal({
    visible,
    mode,
    pkg,
    allPermissions,
    permissionsLoading,
    saving,
    onSave,
    onDismiss,
    styles,
  colors,
  t,
}: PackageFormModalProps) {
  const { resolvedScheme } = useAppTheme();
  const [form, setForm] = useState<PermissionPackageFormData | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
    const [permFilter, setPermFilter] = useState('');
    const [errors, setErrors] = useState<{
        package_name?: string;
        permissions?: string;
    }>({});

    useLayoutEffect(() => {
        if (visible) {
            setForm(
                mode === 'edit' && pkg ? buildFormFromPackage(pkg) : { ...EMPTY_FORM },
            );
            setPermFilter('');
            setErrors({});
        } else {
            setForm(null);
        }
    }, [visible, mode, pkg]);

    const groupedPermissions = useMemo(() => {
        const q = permFilter.trim().toLowerCase();
        const filtered = q
            ? allPermissions.filter(
                p =>
                    p.name.toLowerCase().includes(q) ||
                    p.code.toLowerCase().includes(q) ||
                    p.category.toLowerCase().includes(q),
            )
            : allPermissions;
        return groupPermissionsByCategory(filtered);
  }, [allPermissions, permFilter]);

  const visiblePermissionIds = useMemo(
    () => groupedPermissions.flatMap(([, perms]) => perms.map(p => p.id)),
    [groupedPermissions],
  );

  const globalSelection = useMemo(
    () => categorySelectionState(visiblePermissionIds, form?.permission_ids ?? []),
    [visiblePermissionIds, form?.permission_ids],
  );

  const setPermissionIds = useCallback((ids: number[]) => {
    setForm(f => (f ? { ...f, permission_ids: ids } : f));
    setErrors(e => ({ ...e, permissions: undefined }));
  }, []);

  const togglePermission = useCallback((id: number) => {
    setForm(f => {
      if (!f) {
        return f;
      }
      const ids = f.permission_ids.includes(id)
        ? f.permission_ids.filter(x => x !== id)
        : [...f.permission_ids, id];
      return { ...f, permission_ids: ids };
    });
    setErrors(e => ({ ...e, permissions: undefined }));
  }, []);

  const toggleAllVisible = useCallback(() => {
    if (!form) {
      return;
    }
    if (globalSelection.all) {
      const visibleSet = new Set(visiblePermissionIds);
      setPermissionIds(
        form.permission_ids.filter(id => !visibleSet.has(id)),
      );
      return;
    }
    const merged = new Set([...form.permission_ids, ...visiblePermissionIds]);
    setPermissionIds(Array.from(merged));
  }, [form, globalSelection.all, setPermissionIds, visiblePermissionIds]);

  const toggleGroup = useCallback(
    (permIds: number[]) => {
      if (!form) {
        return;
      }
      const state = categorySelectionState(permIds, form.permission_ids);
      if (state.all) {
        const removeSet = new Set(permIds);
        setPermissionIds(form.permission_ids.filter(id => !removeSet.has(id)));
        return;
      }
      const merged = new Set([...form.permission_ids, ...permIds]);
      setPermissionIds(Array.from(merged));
    },
    [form, setPermissionIds],
  );

  const isCategoryExpanded = useCallback(
    (category: string) => expandedCategories.includes(category),
    [expandedCategories],
  );

  const toggleCategoryExpanded = useCallback((category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category],
    );
  }, []);

  const validate = useCallback((): boolean => {
        if (!form) {
            return false;
        }
        const next: { package_name?: string; permissions?: string } = {};
        if (!form.package_name.trim()) {
            next.package_name = t(
                'home.permissionManagement.formModal.errors.nameRequired',
            );
        }
        if (form.permission_ids.length === 0) {
            next.permissions = t(
                'home.permissionManagement.formModal.errors.permissionsRequired',
            );
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    }, [form, t]);

    const handleSave = useCallback(() => {
        if (!form || !validate()) {
            return;
        }
        onSave(form);
    }, [form, onSave, validate]);

    if (!form) {
        return null;
    }

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
                                {mode === 'create'
                                    ? t('home.permissionManagement.formModal.createTitle')
                                    : t('home.permissionManagement.formModal.editTitle')}
                            </Text>
                            <Pressable
                                style={styles.sheetCloseBtn}
                                onPress={onDismiss}
                                accessibilityRole="button">
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
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}>
                            {permissionsLoading ? (
                                <View style={styles.centerBox}>
                                    <ActivityIndicator color={colors.primary} />
                                    <Text style={styles.muted}>
                                        {t('home.permissionManagement.formModal.loadingPermissions')}
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>
                                            {t('home.permissionManagement.formModal.packageName')}
                                        </Text>
                                        <TextInput
                                            style={styles.formInput}
                                            value={form.package_name}
                                            onChangeText={v => {
                                                setForm(f => (f ? { ...f, package_name: v } : f));
                                                if (errors.package_name) {
                                                    setErrors(e => ({ ...e, package_name: undefined }));
                                                }
                                            }}
                                            placeholder={t(
                                                'home.permissionManagement.formModal.packageNamePlaceholder',
                                            )}
                                            placeholderTextColor={colors.textMuted}
                                        />
                                        {errors.package_name ? (
                                            <Text style={styles.formError}>{errors.package_name}</Text>
                                        ) : null}
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>
                                            {t('home.permissionManagement.formModal.groupCode')}
                                        </Text>
                                        <TextInput
                                            style={styles.formInput}
                                            value={form.group_code}
                                            onChangeText={v =>
                                                setForm(f => (f ? { ...f, group_code: v } : f))
                                            }
                                            placeholder={t(
                                                'home.permissionManagement.formModal.groupCodePlaceholder',
                                            )}
                                            placeholderTextColor={colors.textMuted}
                                            autoCapitalize="characters"
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>
                                            {t('home.permissionManagement.formModal.description')}
                                        </Text>
                                        <TextInput
                                            style={styles.remarksInput}
                                            value={form.description}
                                            onChangeText={v =>
                                                setForm(f => (f ? { ...f, description: v } : f))
                                            }
                                            placeholder={t(
                                                'home.permissionManagement.formModal.descriptionPlaceholder',
                                            )}
                                            placeholderTextColor={colors.textMuted}
                                            multiline
                                        />
                                    </View>
                  <View style={styles.formGroup}>
                    <View style={styles.permSectionCard}>
                      <View style={styles.permSectionHeader}>
                        <View style={styles.permSectionTitleRow}>
                          <View style={styles.permSectionIcon}>
                            <MaterialCommunityIcons
                              name="shield-check-outline"
                              size={18}
                              color={colors.primary}
                            />
                          </View>
                          <Text style={styles.formLabel}>
                            {t('home.permissionManagement.formModal.permissions')}
                          </Text>
                        </View>
                        <View style={styles.permCountBadge}>
                          <Text style={styles.permCountBadgeText}>
                            {form.permission_ids.length}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.permSearchRow}>
                        <MaterialCommunityIcons
                          name="magnify"
                          size={20}
                          color={colors.textMuted}
                          style={styles.permSearchIcon}
                        />
                        <TextInput
                          style={styles.permSearchInput}
                          value={permFilter}
                          onChangeText={setPermFilter}
                          placeholder={t(
                            'home.permissionManagement.formModal.searchPermissions',
                          )}
                          placeholderTextColor={colors.textMuted}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        {permFilter.length > 0 ? (
                          <Pressable
                            onPress={() => setPermFilter('')}
                            accessibilityRole="button">
                            <MaterialCommunityIcons
                              name="close-circle"
                              size={18}
                              color={colors.textMuted}
                            />
                          </Pressable>
                        ) : null}
                      </View>

                      {errors.permissions ? (
                        <Text style={styles.formError}>{errors.permissions}</Text>
                      ) : null}

                      {visiblePermissionIds.length > 0 ? (
                        <Pressable
                          style={styles.permGlobalRow}
                          onPress={toggleAllVisible}
                          accessibilityRole="checkbox"
                          accessibilityState={{
                            checked: globalSelection.all,
                          }}>
                          <PermissionCheckbox
                            checked={globalSelection.all}
                            partial={globalSelection.partial}
                            color={colors.primary}
                          />
                          <View style={styles.permRowMain}>
                            <Text style={styles.permGlobalLabel}>
                              {t(
                                'home.permissionManagement.formModal.selectAll',
                              )}
                            </Text>
                            <Text style={styles.permGlobalSub}>
                              {t(
                                'home.permissionManagement.formModal.selectAllHint',
                                {
                                  selected: globalSelection.count,
                                  total: visiblePermissionIds.length,
                                },
                              )}
                            </Text>
                          </View>
                        </Pressable>
                      ) : null}

                      {groupedPermissions.length === 0 ? (
                        <View style={styles.permEmptyFilter}>
                          <Text style={styles.permEmptyFilterText}>
                            {t(
                              'home.permissionManagement.formModal.noPermissionsMatch',
                            )}
                          </Text>
                        </View>
                      ) : (
                        groupedPermissions.map(([category, perms]) => {
                          const palette = getCategoryPalette(
                            category,
                            resolvedScheme,
                          );
                          const groupIds = perms.map(p => p.id);
                          const groupState = categorySelectionState(
                            groupIds,
                            form.permission_ids,
                          );
                          const expanded = isCategoryExpanded(category);
                          return (
                            <View
                              key={category}
                              style={[
                                styles.permCategoryCard,
                                {
                                  borderColor: palette.border,
                                  backgroundColor: palette.bg,
                                },
                              ]}>
                              <Pressable
                                style={[
                                  styles.permCategoryHeader,
                                  {
                                    backgroundColor: palette.header,
                                    borderBottomColor: palette.border,
                                  },
                                ]}
                                onPress={() => toggleCategoryExpanded(category)}
                                accessibilityRole="button"
                                accessibilityState={{ expanded }}>
                                <View style={styles.permCategoryIconWrap}>
                                  <MaterialCommunityIcons
                                    name={palette.icon}
                                    size={18}
                                    color={palette.accent}
                                  />
                                </View>
                                <View style={styles.permCategoryHeaderMain}>
                                  <Text
                                    style={[
                                      styles.permCategoryTitle,
                                      { color: palette.accent },
                                    ]}>
                                    {formatLabel(category)}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.permCategoryMeta,
                                      { color: colors.textMuted },
                                    ]}>
                                    {t(
                                      'home.permissionManagement.formModal.groupSelected',
                                      {
                                        selected: groupState.count,
                                        total: perms.length,
                                      },
                                    )}
                                  </Text>
                                </View>
                                <MaterialCommunityIcons
                                  name={expanded ? 'chevron-up' : 'chevron-down'}
                                  size={20}
                                  color={palette.accent}
                                />
                              </Pressable>

                              {expanded ? (
                                <>
                                  <Pressable
                                    style={styles.permGroupSelectRow}
                                    onPress={() => toggleGroup(groupIds)}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{
                                      checked: groupState.all,
                                    }}>
                                    <PermissionCheckbox
                                      checked={groupState.all}
                                      partial={groupState.partial}
                                      color={palette.accent}
                                      size={20}
                                    />
                                    <Text
                                      style={[
                                        styles.permGroupSelectLabel,
                                        { color: palette.accent },
                                      ]}>
                                      {t(
                                        'home.permissionManagement.formModal.selectAllGroup',
                                      )}
                                    </Text>
                                  </Pressable>

                                  <View style={styles.permList}>
                                    {perms.map((p, index) => {
                                      const selected =
                                        form.permission_ids.includes(p.id);
                                      const isLast = index === perms.length - 1;
                                      return (
                                        <Pressable
                                          key={p.id}
                                          style={[
                                            styles.permRow,
                                            selected &&
                                              styles.permRowSelected,
                                            isLast && styles.permRowLast,
                                            {
                                              borderBottomColor:
                                                palette.border,
                                            },
                                          ]}
                                          onPress={() => togglePermission(p.id)}
                                          accessibilityRole="checkbox"
                                          accessibilityState={{
                                            checked: selected,
                                          }}>
                                          <PermissionCheckbox
                                            checked={selected}
                                            color={palette.accent}
                                            size={20}
                                          />
                                          <View style={styles.permRowMain}>
                                            <Text
                                              style={[
                                                styles.permRowName,
                                                selected &&
                                                  styles.permRowNameSelected,
                                              ]}
                                              numberOfLines={2}>
                                              {p.name}
                                            </Text>
                                            <Text
                                              style={styles.permRowCode}
                                              numberOfLines={1}>
                                              {p.code}
                                            </Text>
                                          </View>
                                          {p.action ? (
                                            <View
                                              style={[
                                                styles.permActionBadge,
                                                { borderColor: palette.border },
                                              ]}>
                                              <Text
                                                style={[
                                                  styles.permActionBadgeText,
                                                  { color: palette.accent },
                                                ]}
                                                numberOfLines={1}>
                                                {formatLabel(p.action)}
                                              </Text>
                                            </View>
                                          ) : null}
                                        </Pressable>
                                      );
                                    })}
                                  </View>
                                </>
                              ) : null}
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                                </>
                            )}
                        </ScrollView>
                        <View style={styles.sheetFooter}>
                            <Pressable
                                style={styles.cancelBtn}
                                onPress={onDismiss}
                                disabled={saving}
                                accessibilityRole="button">
                                <Text style={styles.cancelBtnText}>
                                    {t('home.permissionManagement.formModal.cancel')}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                                onPress={handleSave}
                                disabled={saving || permissionsLoading}
                                accessibilityRole="button">
                                <Text style={styles.saveBtnText}>
                                    {saving
                                        ? t('home.permissionManagement.formModal.saving')
                                        : mode === 'create'
                                            ? t('home.permissionManagement.formModal.create')
                                            : t('home.permissionManagement.formModal.save')}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

type ViewPackageModalProps = {
    visible: boolean;
    pkg: PermissionPackageListItem | null;
    onDismiss: () => void;
    styles: ReturnType<typeof buildStyles>;
    colors: AppThemeColors;
    t: TFunction;
};

function ViewPackageModal({
  visible,
  pkg,
  onDismiss,
  styles,
  colors,
  t,
}: ViewPackageModalProps) {
  const { resolvedScheme } = useAppTheme();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const groupedPermissions = useMemo(
    () => groupPermissionsByCategory(pkg?.permissions ?? []),
    [pkg?.permissions],
  );

  useEffect(() => {
    if (visible) {
      setExpandedCategories([]);
    }
  }, [visible, pkg?.id]);

  const toggleCategoryExpanded = useCallback((category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category],
    );
  }, []);

  const isCategoryExpanded = useCallback(
    (category: string) => expandedCategories.includes(category),
    [expandedCategories],
  );

  if (!pkg) {
    return null;
  }

  const palette = getCategoryPalette('permission package', resolvedScheme);

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
                {t('home.permissionManagement.viewModal.title')}
              </Text>
              <Pressable
                style={styles.sheetCloseBtn}
                onPress={onDismiss}
                accessibilityRole="button">
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
              showsVerticalScrollIndicator={false}>
              <View
                style={[
                  styles.viewHero,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.bg,
                  },
                ]}>
                <Text style={styles.viewHeroName}>{pkg.package_name}</Text>
                {pkg.group_code ? (
                  <Text style={styles.viewHeroCode}>{pkg.group_code}</Text>
                ) : null}
              </View>

              <View style={styles.viewSection}>
                {pkg.description ? (
                  <View style={styles.viewRow}>
                    <Text style={styles.viewLabel}>
                      {t('home.permissionManagement.viewModal.description')}
                    </Text>
                    <Text style={styles.viewValue}>{pkg.description}</Text>
                  </View>
                ) : null}
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.permissionManagement.viewModal.permissionCount')}
                  </Text>
                  <Text style={styles.viewValue}>
                    {pkg.permissions?.length ?? 0}
                  </Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewLabel}>
                    {t('home.permissionManagement.viewModal.usedCount')}
                  </Text>
                  <Text style={styles.viewValue}>{pkg.total_used ?? 0}</Text>
                </View>
              </View>

              <View style={styles.viewSection}>
                <View style={styles.permSectionHeader}>
                  <View style={styles.permSectionTitleRow}>
                    <View style={styles.permSectionIcon}>
                      <MaterialCommunityIcons
                        name="shield-check-outline"
                        size={18}
                        color={palette.accent}
                      />
                    </View>
                    <Text style={styles.formLabel}>
                      {t('home.permissionManagement.viewModal.permissions')}
                    </Text>
                  </View>
                  <View style={styles.permCountBadge}>
                    <Text style={styles.permCountBadgeText}>
                      {pkg.permissions?.length ?? 0}
                    </Text>
                  </View>
                </View>

                <View style={[styles.permList, styles.chipWrapTop]}>
                  {groupedPermissions.length === 0 ? (
                    <Text style={styles.muted}>
                      {t('home.permissionManagement.viewModal.noPermissions')}
                    </Text>
                  ) : (
                    groupedPermissions.map(([category, perms]) => {
                      const categoryPalette = getCategoryPalette(
                        category,
                        resolvedScheme,
                      );
                      const expanded = isCategoryExpanded(category);
                      return (
                        <View
                          key={category}
                          style={[
                            styles.permCategoryCard,
                            {
                              borderColor: categoryPalette.border,
                              backgroundColor: categoryPalette.bg,
                            },
                          ]}>
                          <Pressable
                            style={[
                              styles.permCategoryHeader,
                              {
                                backgroundColor: categoryPalette.header,
                                borderBottomColor: categoryPalette.border,
                              },
                            ]}
                            onPress={() => toggleCategoryExpanded(category)}
                            accessibilityRole="button"
                            accessibilityState={{ expanded }}>
                            <View style={styles.permCategoryIconWrap}>
                              <MaterialCommunityIcons
                                name={categoryPalette.icon}
                                size={18}
                                color={categoryPalette.accent}
                              />
                            </View>
                            <View style={styles.permCategoryHeaderMain}>
                              <Text
                                style={[
                                  styles.permCategoryTitle,
                                  { color: categoryPalette.accent },
                                ]}>
                                {formatLabel(category)}
                              </Text>
                              <Text
                                style={[
                                  styles.permCategoryMeta,
                                  { color: colors.textMuted },
                                ]}>
                                {t(
                                  'home.permissionManagement.viewModal.groupCount',
                                  { count: perms.length },
                                )}
                              </Text>
                            </View>
                            <MaterialCommunityIcons
                              name={expanded ? 'chevron-up' : 'chevron-down'}
                              size={20}
                              color={categoryPalette.accent}
                            />
                          </Pressable>

                          {expanded ? (
                            <View style={styles.permList}>
                              {perms.map((p, index) => {
                                const isLast = index === perms.length - 1;
                                return (
                                  <View
                                    key={p.id}
                                    style={[
                                      styles.permRow,
                                      styles.permRowSelected,
                                      isLast && styles.permRowLast,
                                      {
                                        borderBottomColor: categoryPalette.border,
                                      },
                                    ]}>
                                    <MaterialCommunityIcons
                                      name="check-circle"
                                      size={20}
                                      color={categoryPalette.accent}
                                    />
                                    <View style={styles.permRowMain}>
                                      <Text
                                        style={[
                                          styles.permRowName,
                                          styles.permRowNameSelected,
                                        ]}
                                        numberOfLines={2}>
                                        {p.name}
                                      </Text>
                                      <Text
                                        style={styles.permRowCode}
                                        numberOfLines={1}>
                                        {p.code}
                                      </Text>
                                    </View>
                                    {p.action ? (
                                      <View
                                        style={[
                                          styles.permActionBadge,
                                          {
                                            borderColor: categoryPalette.border,
                                          },
                                        ]}>
                                        <Text
                                          style={[
                                            styles.permActionBadgeText,
                                            { color: categoryPalette.accent },
                                          ]}
                                          numberOfLines={1}>
                                          {formatLabel(p.action)}
                                        </Text>
                                      </View>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function PermissionManagementScreen({ navigation }: Props) {
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
    const {
        props: confirmProps,
        present: presentConfirm,
        dismiss: dismissConfirm,
    } = useConfirmAlert();

    const [modalType, setModalType] = useState<ModalType>('NONE');
    const [selectedPackage, setSelectedPackage] =
        useState<PermissionPackageListItem | null>(null);

    const onError = useCallback(
        (msg: string) => {
            presentError({
                title: t('home.permissionManagement.apiError'),
                message: msg,
            });
        },
        [presentError, t],
    );
    const onSuccess = useCallback(
        (msg: string) => {
            presentSuccess({
                title: t('home.permissionManagement.title'),
                message: msg,
            });
        },
        [presentSuccess, t],
    );

    const {
        packages,
        allPermissions,
        permissionsLoading,
        loadPermissions,
        loading,
        loadingMore,
        refreshing,
        error,
        search,
        setSearch,
        refresh,
        loadMore,
        retry,
        createPackage,
        updatePackage,
        deletePackage,
        mutating,
    } = usePermissionPackages({ companyId, onError, onSuccess });

    useEffect(() => {
        if (modalType === 'CREATE' || modalType === 'EDIT') {
            loadPermissions().catch(() => { });
        }
    }, [modalType, loadPermissions]);

    const openCreate = useCallback(() => {
        setSelectedPackage(null);
        setModalType('CREATE');
    }, []);

    const openEdit = useCallback((pkg: PermissionPackageListItem) => {
        setSelectedPackage(pkg);
        setModalType('EDIT');
    }, []);

    const openView = useCallback((pkg: PermissionPackageListItem) => {
        setSelectedPackage(pkg);
        setModalType('VIEW');
    }, []);

    const openDelete = useCallback(
        (pkg: PermissionPackageListItem) => {
            presentConfirm({
                title: t('home.permissionManagement.deleteModal.title'),
                message: t('home.permissionManagement.deleteModal.message', {
                    name: pkg.package_name,
                }),
                buttons: [
                    {
                        key: 'dismiss',
                        text: t('home.permissionManagement.deleteModal.cancel'),
                        variant: 'secondary',
                    },
                    {
                        key: 'confirm',
                        text: t('home.permissionManagement.deleteModal.confirm'),
                        variant: 'danger',
                        onPress: () => {
                            deletePackage(pkg.id)
                                .then(ok => {
                                    dismissConfirm();
                                    if (ok) {
                                        setModalType('NONE');
                                        setSelectedPackage(null);
                                    }
                                })
                                .catch(() => {
                                    dismissConfirm();
                                });
                        },
                    },
                ],
            });
        },
        [deletePackage, dismissConfirm, presentConfirm, t],
    );

    const closeModal = useCallback(() => {
        setModalType('NONE');
        setSelectedPackage(null);
    }, []);

    const handleFormSave = useCallback(
        (form: PermissionPackageFormData) => {
            const payloadBase = {
                package_name: form.package_name.trim(),
                ...(form.group_code.trim()
                    ? { group_code: form.group_code.trim() }
                    : {}),
                ...(form.description.trim()
                    ? { description: form.description.trim() }
                    : {}),
                permissions: form.permission_ids,
            };
            if (modalType === 'CREATE') {
                createPackage(payloadBase)
                    .then(ok => {
                        if (ok) {
                            closeModal();
                        }
                    })
                    .catch(() => { });
                return;
            }
            if (modalType === 'EDIT' && selectedPackage) {
                updatePackage({ id: selectedPackage.id, ...payloadBase })
                    .then(ok => {
                        if (ok) {
                            closeModal();
                        }
                    })
                    .catch(() => { });
            }
        },
        [modalType, selectedPackage, createPackage, updatePackage, closeModal],
    );

    const renderItem = useCallback(
        ({ item }: { item: PermissionPackageListItem }) => (
            <PackageRow
                item={item}
                styles={styles}
                colors={colors}
                t={t}
                onView={() => openView(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => openDelete(item)}
            />
        ),
        [styles, colors, t, openView, openEdit, openDelete],
    );

    const listHeader = useMemo(
        () => (
            <View>
                <View style={styles.searchWrap}>
                    <MaterialCommunityIcons
                        name="magnify"
                        size={22}
                        color={colors.textMuted}
                        style={styles.searchIcon}
                    />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder={t('home.permissionManagement.searchPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.searchInput}
                        returnKeyType="search"
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
                {loading ? <PackageListSkeleton styles={styles} /> : null}
            </View>
        ),
        [colors.textMuted, loading, search, setSearch, styles, t],
    );

    const listEmpty = useMemo(() => {
        if (loading) {
            return null;
        }
        if (companyId == null) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.muted}>
                        {t('home.permissionManagement.noCompany')}
                    </Text>
                </View>
            );
        }
        if (error) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.error}>{error}</Text>
                    <Pressable style={styles.retryBtn} onPress={retry} accessibilityRole="button">
                        <Text style={styles.retryLabel}>
                            {t('home.permissionManagement.retry')}
                        </Text>
                    </Pressable>
                </View>
            );
        }
        return (
            <View style={styles.centerBox}>
                <Text style={styles.muted}>{t('home.permissionManagement.empty')}</Text>
            </View>
        );
    }, [loading, companyId, error, styles, t, retry]);

    const listFooter = useMemo(() => {
        if (!loadingMore) {
            return null;
        }
        return (
            <View style={styles.footerBox}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }, [loadingMore, styles, colors]);

    if (companyId == null) {
        return (
            <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
                <View style={styles.stackHeader}>
                    <HeaderBackButton
                        onPress={() => navigation.goBack()}
                        tintColor={colors.primary}
                        displayMode="minimal"
                    />
                    <Text style={styles.stackHeaderTitle}>
                        {t('home.permissionManagement.title')}
                    </Text>
                </View>
                <View style={[styles.centerBox, styles.fill]}>
                    <Text style={styles.muted}>{t('home.permissionManagement.noCompany')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
            <View style={styles.stackHeader}>
                <HeaderBackButton
                    onPress={() => navigation.goBack()}
                    tintColor={colors.primary}
                    displayMode="minimal"
                    accessibilityLabel={t('home.permissionManagement.back')}
                />
                <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                    {t('home.permissionManagement.title')}
                </Text>
                <View style={styles.headerActions}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.createBtn,
                            pressed && styles.createBtnPressed,
                        ]}
                        onPress={openCreate}
                        accessibilityRole="button"
                        accessibilityLabel={t('home.permissionManagement.createBtn')}>
                        <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                        <Text style={styles.createBtnText}>
                            {t('home.permissionManagement.createBtn')}
                        </Text>
                    </Pressable>
                </View>
            </View>

            <FlatList
                data={loading ? [] : packages}
                keyExtractor={item => String(item.id)}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={listEmpty}
                ListFooterComponent={listFooter}
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

            <PackageFormModal
                visible={modalType === 'CREATE' || modalType === 'EDIT'}
                mode={modalType === 'EDIT' ? 'edit' : 'create'}
                pkg={selectedPackage}
                allPermissions={allPermissions}
                permissionsLoading={permissionsLoading}
                saving={mutating}
                onSave={handleFormSave}
                onDismiss={closeModal}
                styles={styles}
                colors={colors}
                t={t}
            />

            <ViewPackageModal
                visible={modalType === 'VIEW'}
                pkg={selectedPackage}
                onDismiss={closeModal}
                styles={styles}
                colors={colors}
                t={t}
            />

            <StatusAlert {...statusProps} />
            <ConfirmAlert {...confirmProps} />
        </SafeAreaView>
    );
}
