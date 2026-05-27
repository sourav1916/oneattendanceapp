import type { TFunction } from 'i18next';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { companyInviteApi } from '@src/api/invitePackageApi';
import { userAvailabilityApi } from '@src/api/userAvailabilityApi';
import { CountryCodePicker } from '@src/components/modals/CountryCodePicker';
import {
  formatTime12h,
  TimePicker,
  useTimePicker,
} from '@src/components/modals/TimePicker';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useOnboardInviteFormData } from '@src/hooks/useOnboardInviteFormData';
import type { AppThemeColors } from '@src/theme/palettes';
import type { InvitePackageItem } from '@src/types/invitePackage';
import type { AvailableUser } from '@src/types/userAvailability';
import type { OnboardInviteFormData } from '@src/types/onboardInvite';
import {
  buildCompanyInviteSendPayload,
  formatInviteSendError,
  readInviteSendFailure,
} from '@src/utils/companyInviteSendPayload';
import {
  DEFAULT_LOGIN_COUNTRY,
  type LoginCountry,
} from '@src/utils/loginCountries';
import {
  isValidEmail,
  isValidNationalMobile,
} from '@src/utils/loginIdentifier';
import {
  buildOnboardFormFromPackage,
  EMPTY_ONBOARD_INVITE_FORM,
  validateOnboardInviteForm,
  type OnboardInviteFormErrors,
} from '@src/utils/onboardInviteForm';
import { readApiError } from '@src/utils/readApiError';

const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.92;

const ALL_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type OnboardStep = 'lookup' | 'invite';
type OnboardIdentifierType = 'email' | 'mobile';

export type OnboardEmployeeModalProps = {
  visible: boolean;
  companyId: number | null;
  onDismiss: () => void;
  onInviteSent: () => void;
};

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) {
    return iso.trim();
  }
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y!.slice(2)}`;
}

function formatMemberSince(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return formatDate(iso);
  }
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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

function formatLabel(value: string): string {
  if (!value) {
    return '';
  }
  return value
    .split(/[\s_]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    modalSafe: { flex: 1, backgroundColor: colors.overlay },
    modalBackdrop: { ...StyleSheet.absoluteFillObject },
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
    sheetFooterBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.secondaryButton,
    },
    sheetFooterBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sheetFooterBtnDisabled: { opacity: 0.7 },
    sheetFooterBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    sheetFooterBtnTextPrimary: { color: '#fff' },
    centerBox: {
      paddingVertical: 32,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    muted: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    onboardSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 16,
    },
    onboardSegmentRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    onboardSegmentBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    onboardSegmentBtnActive: {
      borderColor: colors.primary,
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.15)' : '#eff6ff',
    },
    onboardSegmentText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    onboardSegmentTextActive: { color: colors.primary },
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
    phoneRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
    countryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    countryDial: { fontSize: 15, fontWeight: '600', color: colors.text },
    phoneInput: { flex: 1 },
    onboardErrorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor:
        scheme === 'dark' ? 'rgba(248,113,113,0.35)' : '#fecaca',
      backgroundColor:
        scheme === 'dark' ? 'rgba(248,113,113,0.12)' : '#fef2f2',
    },
    onboardErrorText: {
      flex: 1,
      fontSize: 14,
      color: colors.danger,
      lineHeight: 20,
    },
    onboardSuccessBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor:
        scheme === 'dark' ? 'rgba(74,222,128,0.35)' : '#bbf7d0',
      backgroundColor:
        scheme === 'dark' ? 'rgba(34,197,94,0.1)' : '#f0fdf4',
    },
    onboardSuccessText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: scheme === 'dark' ? '#4ade80' : '#15803d',
    },
    onboardUserCard: {
      borderRadius: 14,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.35)' : '#bfdbfe',
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.12)' : '#eff6ff',
    },
    onboardUserHint: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
      marginBottom: 14,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.secondaryButton,
    },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    avatarInitials: { fontSize: 16, fontWeight: '700', color: colors.primary },
    heroMain: { flex: 1, minWidth: 0 },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    heroName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 24,
    },
    heroEmail: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
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
    dropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      backgroundColor: colors.background,
    },
    dropdownText: { fontSize: 15, color: colors.text, flex: 1 },
    dropdownPlaceholder: { color: colors.textMuted },
    formError: {
      fontSize: 13,
      color: colors.danger,
      marginTop: 4,
      fontWeight: '500',
    },
    methodChipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    methodChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    methodChipActive: {
      borderColor: colors.primary,
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.15)' : '#eff6ff',
    },
    methodChipDisabled: { opacity: 0.45 },
    methodChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    methodChipTextActive: { color: colors.primary },
    methodChipTextDisabled: { color: colors.textMuted },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    switchLabel: { fontSize: 15, color: colors.text, fontWeight: '500' },
    timeRow: { flexDirection: 'row', gap: 10 },
    timeField: { flex: 1 },
    timeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    timeBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
    durationInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
    },
    dropdownModalSafe: { flex: 1, backgroundColor: colors.overlay },
    dropdownSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '60%',
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
    dropdownOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dropdownOptionActive: {
      backgroundColor:
        scheme === 'dark' ? 'rgba(96,165,250,0.12)' : '#eff6ff',
    },
    dropdownOptionText: { fontSize: 16, color: colors.text, flex: 1 },
    dropdownOptionTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    dropdownCheck: { marginLeft: 8 },
    compactUserBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    compactUserName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
  });
}

type Styles = ReturnType<typeof buildStyles>;

function AvatarView({
  name,
  size,
  styles,
}: {
  name: string;
  size: number;
  styles: Styles;
}) {
  const avatarStyle = useMemo(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
    }),
    [size],
  );
  return (
    <View style={[styles.avatar, styles.avatarPlaceholder, avatarStyle]}>
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
    </View>
  );
}

type DropdownPickerProps = {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  onDismiss: () => void;
  styles: Styles;
  colors: AppThemeColors;
};

function DropdownPicker({
  visible,
  title,
  options,
  selected,
  onSelect,
  onDismiss,
  styles,
  colors,
}: DropdownPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView
        style={styles.dropdownModalSafe}
        edges={['top', 'left', 'right', 'bottom']}>
        <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.dropdownSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
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
            <FlatList
              data={options}
              keyExtractor={item => item.value}
              bounces={false}
              renderItem={({ item }) => {
                const active = item.value === selected;
                return (
                  <Pressable
                    style={[
                      styles.dropdownOption,
                      active && styles.dropdownOptionActive,
                    ]}
                    onPress={() => {
                      onSelect(item.value);
                      onDismiss();
                    }}>
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        active && styles.dropdownOptionTextActive,
                      ]}>
                      {item.label}
                    </Text>
                    {active ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={20}
                        color={colors.primary}
                        style={styles.dropdownCheck}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

type InviteFormStepProps = {
  foundUser: AvailableUser;
  form: OnboardInviteFormData;
  setForm: React.Dispatch<React.SetStateAction<OnboardInviteFormData>>;
  formErrors: OnboardInviteFormErrors;
  constants: NonNullable<ReturnType<typeof useOnboardInviteFormData>['constants']>;
  invitePackages: InvitePackageItem[];
  permissionPackages: ReturnType<typeof useOnboardInviteFormData>['permissionPackages'];
  formOptionsLoading: boolean;
  sendError: string | null;
  styles: Styles;
  colors: AppThemeColors;
  t: TFunction;
};

function InviteFormStep({
  foundUser,
  form,
  setForm,
  formErrors,
  constants,
  invitePackages,
  permissionPackages,
  formOptionsLoading,
  sendError,
  styles,
  colors,
  t,
}: InviteFormStepProps) {
  const [dropdownField, setDropdownField] = useState<string | null>(null);
  const [invitePackageField, setInvitePackageField] = useState(false);

  const shiftStartPicker = useTimePicker({
    initialValue: form.shift_start,
    onConfirm: (time: string) =>
      setForm(f => ({ ...f, shift_start: time })),
  });
  const shiftEndPicker = useTimePicker({
    initialValue: form.shift_end,
    onConfirm: (time: string) => setForm(f => ({ ...f, shift_end: time })),
  });

  useLayoutEffect(() => {
    shiftStartPicker.setValue(form.shift_start);
    shiftEndPicker.setValue(form.shift_end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.shift_start, form.shift_end]);

  const toggleMethod = useCallback((method: string) => {
    setForm(f => {
      const methods = Array.isArray(f.attendance_methods)
        ? f.attendance_methods
        : [];
      return {
        ...f,
        attendance_methods: methods.includes(method)
          ? methods.filter(m => m !== method)
          : [...methods, method],
      };
    });
  }, [setForm]);

  const toggleWeekend = useCallback((day: string) => {
    setForm(f => {
      const weekends = Array.isArray(f.weekends) ? f.weekends : [];
      return {
        ...f,
        weekends: weekends.includes(day)
          ? weekends.filter(d => d !== day)
          : [...weekends, day],
      };
    });
  }, [setForm]);

  const handleDropdownSelect = useCallback(
    (value: string) => {
      setForm(f => {
        switch (dropdownField) {
          case 'designation':
            return { ...f, designation: value };
          case 'employment_type':
            return { ...f, employment_type: value };
          case 'salary_type':
            return { ...f, salary_type: value };
          case 'permission_package':
            return {
              ...f,
              permission_package_id: parseInt(value, 10) || null,
            };
          default:
            return f;
        }
      });
    },
    [dropdownField, setForm],
  );

  const handleInvitePackageSelect = useCallback(
    (value: string) => {
      if (!value) {
        return;
      }
      const pkg = invitePackages.find(p => String(p.id) === value);
      if (pkg) {
        const next = buildOnboardFormFromPackage(pkg);
        setForm(next);
        shiftStartPicker.setValue(next.shift_start);
        shiftEndPicker.setValue(next.shift_end);
      }
    },
    [invitePackages, setForm, shiftEndPicker, shiftStartPicker],
  );

  const getDropdownDisplayText = useCallback(
    (field: string): string => {
      let options: { value: string; label: string }[] = [];
      let currentVal = '';
      switch (field) {
        case 'designation':
          options = constants.designations;
          currentVal = form.designation;
          break;
        case 'employment_type':
          options = constants.employment_types;
          currentVal = form.employment_type;
          break;
        case 'salary_type':
          options = constants.salary_types;
          currentVal = form.salary_type;
          break;
        case 'permission_package':
          options = permissionPackages.map(p => ({
            value: String(p.id),
            label: p.name,
          }));
          currentVal =
            form.permission_package_id != null
              ? String(form.permission_package_id)
              : '';
          break;
        default:
          return '';
      }
      const found = options.find(o => o.value === currentVal);
      return found?.label ?? (currentVal ? formatLabel(currentVal) : '');
    },
    [constants, form, permissionPackages],
  );

  const dropdownOptions = useMemo((): { value: string; label: string }[] => {
    if (!dropdownField) {
      return [];
    }
    switch (dropdownField) {
      case 'designation':
        return constants.designations;
      case 'employment_type':
        return constants.employment_types;
      case 'salary_type':
        return constants.salary_types;
      case 'permission_package':
        return permissionPackages.map(p => ({
          value: String(p.id),
          label: p.name,
        }));
      default:
        return [];
    }
  }, [constants, dropdownField, permissionPackages]);

  const invitePackageOptions = useMemo(
    () =>
      invitePackages.map(p => ({
        value: String(p.id),
        label: `${p.name} (${p.code})`,
      })),
    [invitePackages],
  );

  const dropdownTitle = useMemo((): string => {
    switch (dropdownField) {
      case 'designation':
        return t('home.invitePackages.formModal.designation');
      case 'employment_type':
        return t('home.invitePackages.formModal.employmentType');
      case 'salary_type':
        return t('home.invitePackages.formModal.salaryType');
      case 'permission_package':
        return t('home.invitePackages.formModal.permissionPackage');
      default:
        return '';
    }
  }, [dropdownField, t]);

  const dropdownSelected = useMemo((): string => {
    switch (dropdownField) {
      case 'designation':
        return form.designation;
      case 'employment_type':
        return form.employment_type;
      case 'salary_type':
        return form.salary_type;
      case 'permission_package':
        return form.permission_package_id != null
          ? String(form.permission_package_id)
          : '';
      default:
        return '';
    }
  }, [dropdownField, form]);

  const attendanceMethods = constants.attendance_methods;

  if (formOptionsLoading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.muted}>
          {t('home.companyInvites.onboardModal.loadingForm')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.compactUserBar}>
        <AvatarView name={foundUser.name} size={40} styles={styles} />
        <Text style={styles.compactUserName} numberOfLines={1}>
          {foundUser.name}
        </Text>
      </View>

      {sendError ? (
        <View style={styles.onboardErrorBanner}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={20}
            color={colors.danger}
          />
          <Text style={styles.onboardErrorText}>{sendError}</Text>
        </View>
      ) : null}

      {invitePackages.length > 0 ? (
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>
            {t('home.companyInvites.onboardModal.selectInvitePackage')}
          </Text>
          <Pressable
            style={styles.dropdown}
            onPress={() => setInvitePackageField(true)}>
            <Text style={[styles.dropdownText, styles.dropdownPlaceholder]}>
              {t(
                'home.companyInvites.onboardModal.selectInvitePackagePlaceholder',
              )}
            </Text>
            <MaterialCommunityIcons
              name="chevron-down"
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>
          {t('home.invitePackages.formModal.designation')}
        </Text>
        <Pressable
          style={styles.dropdown}
          onPress={() => setDropdownField('designation')}>
          <Text
            style={[
              styles.dropdownText,
              !getDropdownDisplayText('designation') && styles.dropdownPlaceholder,
            ]}>
            {getDropdownDisplayText('designation') ||
              t('home.invitePackages.formModal.selectDesignation')}
          </Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
        {formErrors.designation ? (
          <Text style={styles.formError}>{formErrors.designation}</Text>
        ) : null}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>
          {t('home.invitePackages.formModal.employmentType')}
        </Text>
        <Pressable
          style={styles.dropdown}
          onPress={() => setDropdownField('employment_type')}>
          <Text
            style={[
              styles.dropdownText,
              !getDropdownDisplayText('employment_type') &&
                styles.dropdownPlaceholder,
            ]}>
            {getDropdownDisplayText('employment_type') ||
              t('home.invitePackages.formModal.selectEmploymentType')}
          </Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
        {formErrors.employment_type ? (
          <Text style={styles.formError}>{formErrors.employment_type}</Text>
        ) : null}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>
          {t('home.invitePackages.formModal.salaryType')}
        </Text>
        <Pressable
          style={styles.dropdown}
          onPress={() => setDropdownField('salary_type')}>
          <Text
            style={[
              styles.dropdownText,
              !getDropdownDisplayText('salary_type') &&
                styles.dropdownPlaceholder,
            ]}>
            {getDropdownDisplayText('salary_type') ||
              t('home.invitePackages.formModal.selectSalaryType')}
          </Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
        {formErrors.salary_type ? (
          <Text style={styles.formError}>{formErrors.salary_type}</Text>
        ) : null}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>
          {t('home.invitePackages.formModal.permissionPackage')}
        </Text>
        <Pressable
          style={styles.dropdown}
          onPress={() => setDropdownField('permission_package')}>
          <Text
            style={[
              styles.dropdownText,
              !getDropdownDisplayText('permission_package') &&
                styles.dropdownPlaceholder,
            ]}>
            {getDropdownDisplayText('permission_package') ||
              t('home.invitePackages.formModal.selectPackage')}
          </Text>
          <MaterialCommunityIcons
            name="chevron-down"
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
        {formErrors.permission_package_id ? (
          <Text style={styles.formError}>
            {formErrors.permission_package_id}
          </Text>
        ) : null}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>
          {t('home.invitePackages.formModal.attendanceMethods')}
        </Text>
        <View style={styles.methodChipWrap}>
          {attendanceMethods.map(method => {
            const methods = Array.isArray(form.attendance_methods)
              ? form.attendance_methods
              : [];
            const active = methods.includes(method.id);
            const disabled = !method.available;
            return (
              <Pressable
                key={method.id}
                style={[
                  styles.methodChip,
                  active && styles.methodChipActive,
                  disabled && styles.methodChipDisabled,
                ]}
                onPress={() => {
                  if (!disabled) {
                    toggleMethod(method.id);
                  }
                }}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}>
                <Text
                  style={[
                    styles.methodChipText,
                    active && styles.methodChipTextActive,
                    disabled && styles.methodChipTextDisabled,
                  ]}>
                  {method.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {formErrors.attendance_methods ? (
          <Text style={styles.formError}>{formErrors.attendance_methods}</Text>
        ) : null}
      </View>

      <View style={[styles.formGroup, styles.switchRow]}>
        <Text style={styles.switchLabel}>
          {t('home.invitePackages.formModal.autoApprove')}
        </Text>
        <Switch
          value={form.auto_approve}
          onValueChange={v => setForm(f => ({ ...f, auto_approve: v }))}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.formGroup}>
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.formLabel}>
              {t('home.invitePackages.formModal.shiftStart')}
            </Text>
            <Pressable
              style={styles.timeBtn}
              onPress={shiftStartPicker.present}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.timeBtnText}>
                {formatTime12h(form.shift_start)}
              </Text>
            </Pressable>
            {formErrors.shift_start ? (
              <Text style={styles.formError}>{formErrors.shift_start}</Text>
            ) : null}
          </View>
          <View style={styles.timeField}>
            <Text style={styles.formLabel}>
              {t('home.invitePackages.formModal.shiftEnd')}
            </Text>
            <Pressable style={styles.timeBtn} onPress={shiftEndPicker.present}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.timeBtnText}>
                {formatTime12h(form.shift_end)}
              </Text>
            </Pressable>
            {formErrors.shift_end ? (
              <Text style={styles.formError}>{formErrors.shift_end}</Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.formGroup}>
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.formLabel}>
              {t('home.invitePackages.formModal.breakMinutes')}
            </Text>
            <TextInput
              style={styles.durationInput}
              value={form.break_minutes}
              onChangeText={v => setForm(f => ({ ...f, break_minutes: v }))}
              placeholder="00:30"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.formLabel}>
              {t('home.invitePackages.formModal.graceMinutes')}
            </Text>
            <TextInput
              style={styles.durationInput}
              value={form.grace_minutes}
              onChangeText={v => setForm(f => ({ ...f, grace_minutes: v }))}
              placeholder="00:15"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>
          {t('home.invitePackages.formModal.weekends')}
        </Text>
        <View style={styles.methodChipWrap}>
          {ALL_WEEKDAYS.map(day => {
            const weekends = Array.isArray(form.weekends) ? form.weekends : [];
            const active = weekends.includes(day);
            return (
              <Pressable
                key={day}
                style={[styles.methodChip, active && styles.methodChipActive]}
                onPress={() => toggleWeekend(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}>
                <Text
                  style={[
                    styles.methodChipText,
                    active && styles.methodChipTextActive,
                  ]}>
                  {t(`home.invitePackages.days.${day}` as never)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TimePicker {...shiftStartPicker.pickerProps} />
      <TimePicker {...shiftEndPicker.pickerProps} />

      <DropdownPicker
        visible={dropdownField != null}
        title={dropdownTitle}
        options={dropdownOptions}
        selected={dropdownSelected}
        onSelect={handleDropdownSelect}
        onDismiss={() => setDropdownField(null)}
        styles={styles}
        colors={colors}
      />

      <DropdownPicker
        visible={invitePackageField}
        title={t('home.companyInvites.onboardModal.selectInvitePackage')}
        options={invitePackageOptions}
        selected=""
        onSelect={handleInvitePackageSelect}
        onDismiss={() => setInvitePackageField(false)}
        styles={styles}
        colors={colors}
      />
    </>
  );
}

export function OnboardEmployeeModal({
  visible,
  companyId,
  onDismiss,
  onInviteSent,
}: OnboardEmployeeModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const [step, setStep] = useState<OnboardStep>('lookup');
  const [identifierType, setIdentifierType] =
    useState<OnboardIdentifierType>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] =
    useState<LoginCountry>(DEFAULT_LOGIN_COUNTRY);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<AvailableUser | null>(null);
  const [inviteForm, setInviteForm] = useState<OnboardInviteFormData>(
    EMPTY_ONBOARD_INVITE_FORM,
  );
  const [formErrors, setFormErrors] = useState<OnboardInviteFormErrors>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [stepLoading, setStepLoading] = useState(false);

  const {
    loading: formDataLoading,
    constants,
    invitePackages,
    permissionPackages,
    error: formDataError,
    load: loadFormData,
    reset: resetFormData,
  } = useOnboardInviteFormData(companyId);

  const resetAll = useCallback(() => {
    setStep('lookup');
    setIdentifierType('email');
    setEmail('');
    setPhone('');
    setSelectedCountry(DEFAULT_LOGIN_COUNTRY);
    setCountryPickerOpen(false);
    setLookupLoading(false);
    setLookupError(null);
    setFoundUser(null);
    setInviteForm(EMPTY_ONBOARD_INVITE_FORM);
    setFormErrors({});
    setSendError(null);
    setSending(false);
    setStepLoading(false);
    resetFormData();
  }, [resetFormData]);

  useEffect(() => {
    if (visible) {
      resetAll();
    }
  }, [visible, resetAll]);

  const handleChangeType = useCallback((type: OnboardIdentifierType) => {
    setIdentifierType(type);
    setLookupError(null);
    setFoundUser(null);
  }, []);

  const handleFindUser = useCallback(async () => {
    setLookupError(null);
    setFoundUser(null);

    if (companyId == null) {
      setLookupError(t('home.companyInvites.onboardModal.noCompany'));
      return;
    }

    if (identifierType === 'email') {
      const trimmed = email.trim();
      if (!trimmed) {
        setLookupError(
          t('home.companyInvites.onboardModal.errors.emailRequired'),
        );
        return;
      }
      if (!isValidEmail(trimmed)) {
        setLookupError(
          t('home.companyInvites.onboardModal.errors.emailInvalid'),
        );
        return;
      }
      setLookupLoading(true);
      try {
        const res = await userAvailabilityApi.checkAvailable(companyId, {
          email: trimmed.toLowerCase(),
        });
        if (res.success && res.code === 'USER_AVAILABLE' && res.data) {
          setFoundUser(res.data);
          return;
        }
        setLookupError(res.message?.trim() || t('home.companyInvites.apiError'));
      } catch (err) {
        setLookupError(readApiError(err));
      } finally {
        setLookupLoading(false);
      }
      return;
    }

    const digits = phone.replace(/\D/g, '');
    if (!digits) {
      setLookupError(
        t('home.companyInvites.onboardModal.errors.mobileRequired'),
      );
      return;
    }
    if (!isValidNationalMobile(digits)) {
      setLookupError(
        t('home.companyInvites.onboardModal.errors.mobileInvalid'),
      );
      return;
    }
    setLookupLoading(true);
    try {
      const res = await userAvailabilityApi.checkAvailable(companyId, {
        mobile: digits,
      });
      if (res.success && res.code === 'USER_AVAILABLE' && res.data) {
        setFoundUser(res.data);
        return;
      }
      setLookupError(res.message?.trim() || t('home.companyInvites.apiError'));
    } catch (err) {
      setLookupError(readApiError(err));
    } finally {
      setLookupLoading(false);
    }
  }, [companyId, email, identifierType, phone, t]);

  const handleChangeUser = useCallback(() => {
    setFoundUser(null);
    setLookupError(null);
  }, []);

  const handleNext = useCallback(async () => {
    if (!foundUser || companyId == null) {
      return;
    }
    setStepLoading(true);
    setSendError(null);
    setFormErrors({});
    const result = await loadFormData();
    setStepLoading(false);
    if (!result.ok) {
      setLookupError(
        result.error ?? t('home.companyInvites.onboardModal.formLoadError'),
      );
      return;
    }
    setInviteForm(EMPTY_ONBOARD_INVITE_FORM);
    setStep('invite');
  }, [foundUser, companyId, loadFormData, t]);

  const handleBackToLookup = useCallback(() => {
    setStep('lookup');
    setSendError(null);
    setFormErrors({});
  }, []);

  const handleSendInvite = useCallback(async () => {
    if (!foundUser || companyId == null) {
      return;
    }
    const validationMessages = {
      permissionPackage: t(
        'home.companyInvites.onboardModal.formErrors.permissionPackage',
      ),
      designation: t(
        'home.companyInvites.onboardModal.formErrors.designation',
      ),
      employmentType: t(
        'home.companyInvites.onboardModal.formErrors.employmentType',
      ),
      salaryType: t('home.companyInvites.onboardModal.formErrors.salaryType'),
      attendanceMethods: t(
        'home.companyInvites.onboardModal.formErrors.attendanceMethods',
      ),
      shiftStart: t('home.companyInvites.onboardModal.formErrors.shiftStart'),
      shiftEnd: t('home.companyInvites.onboardModal.formErrors.shiftEnd'),
    };
    const errs = validateOnboardInviteForm(inviteForm, validationMessages);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setFormErrors({});
    setSendError(null);
    setSending(true);
    try {
      const payload = buildCompanyInviteSendPayload(foundUser.id, inviteForm);
      const res = await companyInviteApi.send(companyId, payload);
      if (res.success) {
        onInviteSent();
        onDismiss();
        return;
      }
      setSendError(
        formatInviteSendError(
          res,
          t('home.companyInvites.onboardModal.sendError'),
        ),
      );
    } catch (err) {
      setSendError(
        readInviteSendFailure(
          err,
          t('home.companyInvites.onboardModal.sendError'),
        ),
      );
    } finally {
      setSending(false);
    }
  }, [
    companyId,
    foundUser,
    inviteForm,
    onDismiss,
    onInviteSent,
    t,
  ]);

  const sheetTitle =
    step === 'lookup'
      ? t('home.companyInvites.onboardModal.title')
      : t('home.companyInvites.onboardModal.inviteStepTitle');

  const formOptionsLoading = formDataLoading || stepLoading;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={onDismiss}>
        <SafeAreaView
          style={styles.modalSafe}
          edges={['top', 'left', 'right', 'bottom']}>
          <Pressable style={styles.modalBackdrop} onPress={onDismiss} />
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <View style={[styles.sheet, styles.sheetForm]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{sheetTitle}</Text>
                <Pressable
                  style={styles.sheetCloseBtn}
                  onPress={onDismiss}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.companyInvites.onboardModal.close')}>
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
                keyboardShouldPersistTaps="handled">
                {step === 'lookup' ? (
                  foundUser ? (
                    <>
                      <View style={styles.onboardSuccessBanner}>
                        <MaterialCommunityIcons
                          name="check-circle-outline"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={styles.onboardSuccessText}>
                          {t('home.companyInvites.onboardModal.userFound')}
                        </Text>
                      </View>
                      <Text style={styles.onboardUserHint}>
                        {t('home.companyInvites.onboardModal.userFoundHint')}
                      </Text>
                      <View style={styles.onboardUserCard}>
                        <View style={styles.heroRow}>
                          <AvatarView
                            name={foundUser.name}
                            size={56}
                            styles={styles}
                          />
                          <View style={styles.heroMain}>
                            <Text style={styles.heroName} numberOfLines={2}>
                              {foundUser.name}
                            </Text>
                            {foundUser.email ? (
                              <Text style={styles.heroEmail} numberOfLines={1}>
                                {foundUser.email}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.viewRow}>
                          <Text style={styles.viewLabel}>
                            {t('home.companyInvites.onboardModal.email')}
                          </Text>
                          <Text style={styles.viewValue}>
                            {foundUser.email || '—'}
                          </Text>
                        </View>
                        <View style={styles.viewRow}>
                          <Text style={styles.viewLabel}>
                            {t('home.companyInvites.onboardModal.phone')}
                          </Text>
                          <Text style={styles.viewValue}>
                            {foundUser.phone || '—'}
                          </Text>
                        </View>
                        <View style={styles.viewRow}>
                          <Text style={styles.viewLabel}>
                            {t('home.companyInvites.onboardModal.memberSince')}
                          </Text>
                          <Text style={styles.viewValue}>
                            {formatMemberSince(foundUser.created_at)}
                          </Text>
                        </View>
                      </View>
                      {lookupError ? (
                        <View style={styles.onboardErrorBanner}>
                          <MaterialCommunityIcons
                            name="alert-circle-outline"
                            size={20}
                            color={colors.danger}
                          />
                          <Text style={styles.onboardErrorText}>
                            {lookupError}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Text style={styles.onboardSubtitle}>
                        {t('home.companyInvites.onboardModal.subtitle')}
                      </Text>
                      <View style={styles.onboardSegmentRow}>
                        <Pressable
                          style={[
                            styles.onboardSegmentBtn,
                            identifierType === 'email' &&
                              styles.onboardSegmentBtnActive,
                          ]}
                          onPress={() => handleChangeType('email')}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: identifierType === 'email',
                          }}>
                          <Text
                            style={[
                              styles.onboardSegmentText,
                              identifierType === 'email' &&
                                styles.onboardSegmentTextActive,
                            ]}>
                            {t('home.companyInvites.onboardModal.emailTab')}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.onboardSegmentBtn,
                            identifierType === 'mobile' &&
                              styles.onboardSegmentBtnActive,
                          ]}
                          onPress={() => handleChangeType('mobile')}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: identifierType === 'mobile',
                          }}>
                          <Text
                            style={[
                              styles.onboardSegmentText,
                              identifierType === 'mobile' &&
                                styles.onboardSegmentTextActive,
                            ]}>
                            {t('home.companyInvites.onboardModal.mobileTab')}
                          </Text>
                        </Pressable>
                      </View>
                      {lookupError ? (
                        <View style={styles.onboardErrorBanner}>
                          <MaterialCommunityIcons
                            name="alert-circle-outline"
                            size={20}
                            color={colors.danger}
                          />
                          <Text style={styles.onboardErrorText}>
                            {lookupError}
                          </Text>
                        </View>
                      ) : null}
                      {identifierType === 'email' ? (
                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>
                            {t('home.companyInvites.onboardModal.emailLabel')}
                          </Text>
                          <TextInput
                            style={styles.formInput}
                            value={email}
                            onChangeText={setEmail}
                            placeholder={t(
                              'home.companyInvites.onboardModal.emailPlaceholder',
                            )}
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            textContentType="emailAddress"
                            returnKeyType="search"
                            onSubmitEditing={() => {
                              handleFindUser().catch(() => {});
                            }}
                          />
                        </View>
                      ) : (
                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>
                            {t('home.companyInvites.onboardModal.mobileLabel')}
                          </Text>
                          <View style={styles.phoneRow}>
                            <Pressable
                              style={styles.countryBtn}
                              onPress={() => setCountryPickerOpen(true)}
                              accessibilityRole="button">
                              <Text style={styles.countryDial}>
                                {selectedCountry.dialCode}
                              </Text>
                              <MaterialCommunityIcons
                                name="chevron-down"
                                size={18}
                                color={colors.textMuted}
                              />
                            </Pressable>
                            <TextInput
                              style={[styles.formInput, styles.phoneInput]}
                              value={phone}
                              onChangeText={setPhone}
                              placeholder={t(
                                'home.companyInvites.onboardModal.mobilePlaceholder',
                              )}
                              placeholderTextColor={colors.textMuted}
                              keyboardType="phone-pad"
                              textContentType="telephoneNumber"
                              returnKeyType="search"
                              onSubmitEditing={() => {
                                handleFindUser().catch(() => {});
                              }}
                            />
                          </View>
                        </View>
                      )}
                    </>
                  )
                ) : foundUser && constants ? (
                  <InviteFormStep
                    foundUser={foundUser}
                    form={inviteForm}
                    setForm={setInviteForm}
                    formErrors={formErrors}
                    constants={constants}
                    invitePackages={invitePackages}
                    permissionPackages={permissionPackages}
                    formOptionsLoading={formOptionsLoading}
                    sendError={sendError}
                    styles={styles}
                    colors={colors}
                    t={t}
                  />
                ) : formDataError ? (
                  <View style={styles.onboardErrorBanner}>
                    <Text style={styles.onboardErrorText}>{formDataError}</Text>
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.sheetFooter}>
                {step === 'lookup' ? (
                  foundUser ? (
                    <>
                      <Pressable
                        style={styles.sheetFooterBtn}
                        onPress={handleChangeUser}
                        disabled={stepLoading}
                        accessibilityRole="button">
                        <Text style={styles.sheetFooterBtnText}>
                          {t('home.companyInvites.onboardModal.changeUser')}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.sheetFooterBtn,
                          styles.sheetFooterBtnPrimary,
                          stepLoading && styles.sheetFooterBtnDisabled,
                        ]}
                        onPress={() => {
                          handleNext().catch(() => {});
                        }}
                        disabled={stepLoading}
                        accessibilityRole="button">
                        {stepLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text
                            style={[
                              styles.sheetFooterBtnText,
                              styles.sheetFooterBtnTextPrimary,
                            ]}>
                            {t('home.companyInvites.onboardModal.next')}
                          </Text>
                        )}
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        style={styles.sheetFooterBtn}
                        onPress={onDismiss}
                        disabled={lookupLoading}
                        accessibilityRole="button">
                        <Text style={styles.sheetFooterBtnText}>
                          {t('home.companyInvites.onboardModal.cancel')}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.sheetFooterBtn,
                          styles.sheetFooterBtnPrimary,
                          lookupLoading && styles.sheetFooterBtnDisabled,
                        ]}
                        onPress={() => {
                          handleFindUser().catch(() => {});
                        }}
                        disabled={lookupLoading}
                        accessibilityRole="button">
                        {lookupLoading ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text
                            style={[
                              styles.sheetFooterBtnText,
                              styles.sheetFooterBtnTextPrimary,
                            ]}>
                            {t('home.companyInvites.onboardModal.findUser')}
                          </Text>
                        )}
                      </Pressable>
                    </>
                  )
                ) : (
                  <>
                    <Pressable
                      style={styles.sheetFooterBtn}
                      onPress={handleBackToLookup}
                      disabled={sending}
                      accessibilityRole="button">
                      <Text style={styles.sheetFooterBtnText}>
                        {t('home.companyInvites.onboardModal.back')}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.sheetFooterBtn,
                        styles.sheetFooterBtnPrimary,
                        sending && styles.sheetFooterBtnDisabled,
                      ]}
                      onPress={() => {
                        handleSendInvite().catch(() => {});
                      }}
                      disabled={sending || formOptionsLoading}
                      accessibilityRole="button">
                      {sending ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text
                          style={[
                            styles.sheetFooterBtnText,
                            styles.sheetFooterBtnTextPrimary,
                          ]}>
                          {t('home.companyInvites.onboardModal.sendInvite')}
                        </Text>
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <CountryCodePicker
        visible={countryPickerOpen}
        selectedCountryCode={selectedCountry.code}
        onDismiss={() => setCountryPickerOpen(false)}
        onSelectCountry={country => {
          setSelectedCountry(country);
          setCountryPickerOpen(false);
        }}
      />
    </>
  );
}
