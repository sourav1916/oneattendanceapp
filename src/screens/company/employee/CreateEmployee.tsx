import { HeaderBackButton } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
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
  BackHandler,
  FlatList,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { constantsApi } from '@src/api/constantsApi';
import { createEmployeeApi } from '@src/api/createEmployeeApi';
import { employeeManagementApi } from '@src/api/employeeManagementApi';
import { CountryCodePicker } from '@src/components/modals/CountryCodePicker';
import { DatePicker } from '@src/components/modals/DatePicker';
import {
  LeaveConfirmModal,
  useLeaveConfirmModal,
} from '@src/components/modals/LeaveConfirmModal';
import {
  StatusAlert,
  useStatusAlert,
} from '@src/components/modals/StatusAlert';
import {
  formatTime12h,
  formatTime24h,
  TimePicker,
  useTimePicker,
} from '@src/components/modals/TimePicker';
import { TAB_SCREEN_SAFE_AREA_EDGES } from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList } from '@src/navigation/types';
import { tryOptionalLocationCoords } from '@src/screens/auth/optionalLocationCoords';
import type { AppThemeColors } from '@src/theme/palettes';
import {
  EMPTY_CREATE_EMPLOYEE_FORM,
  type CreateEmployeeFormData,
  type CreateEmployeeSignupType,
} from '@src/types/createEmployee';
import type { PermissionPackage } from '@src/types/employeeManagement';
import { todayIso } from '@src/utils/attendanceListDisplay';
import {
  buildCreateEmployeePayload,
  validateCreateEmployeeForm,
  type CreateEmployeeFormErrors,
} from '@src/utils/createEmployeeForm';
import {
  combinePhoneDigits,
  DEFAULT_LOGIN_COUNTRY,
  type LoginCountry,
} from '@src/utils/loginCountries';
import {
  isValidEmail,
  isValidNationalMobile,
} from '@src/utils/loginIdentifier';
import {
  mapGlobalConstantsToFormConstants,
  type InvitePackageFormConstants,
} from '@src/utils/mapGlobalConstants';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'CreateEmployee'>;

type ScreenStep = 1 | 2 | 3;
type SignupChannel = 'email' | 'phone';

const OTP_LENGTH = 6;
const OTP_EXPIRY_SEC = 300;
const RESEND_COOLDOWN_SEC = 30;
const OTP_CELL_SIZE = Platform.OS === 'ios' ? 44 : 42;

const ALL_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const dark = scheme === 'dark';
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
      fontWeight: '700',
      color: colors.text,
      marginLeft: 2,
    },
    stepHeader: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    stepViewport: {
      flex: 1,
      overflow: 'hidden',
    },
    stepStrip: {
      flexDirection: 'row',
      flex: 1,
    },
    stepPanelScroll: {
      flex: 1,
    },
    stepPanelContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    stepRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    stepChip: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    stepChipActive: {
      borderColor: colors.primary,
      backgroundColor: dark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
    },
    stepChipDone: {
      borderColor: '#16a34a',
      backgroundColor: dark ? 'rgba(34,197,94,0.12)' : '#f0fdf4',
    },
    stepChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    stepChipTextActive: {
      color: colors.primary,
    },
    stepChipTextDone: {
      color: '#16a34a',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    sectionTitleSpaced: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 12,
    },
    sectionHint: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 19,
      marginBottom: 14,
    },
    channelRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    channelBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    channelBtnActive: {
      borderColor: colors.primary,
      backgroundColor: dark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
    },
    channelBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    channelBtnTextActive: {
      color: colors.primary,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 15,
      color: colors.text,
      marginBottom: 12,
    },
    inputError: {
      borderColor: colors.danger,
    },
    phoneRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    countryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    countryDial: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      minWidth: 36,
    },
    phoneInput: {
      flex: 1,
      marginBottom: 0,
    },
    errorText: {
      fontSize: 12,
      color: colors.danger,
      marginTop: -8,
      marginBottom: 10,
    },
    bannerError: {
      flexDirection: 'row',
      gap: 8,
      padding: 12,
      borderRadius: 10,
      backgroundColor: dark ? '#450a0a' : '#fef2f2',
      borderWidth: 1,
      borderColor: dark ? '#7f1d1d' : '#fecaca',
      marginBottom: 12,
    },
    bannerErrorText: {
      flex: 1,
      fontSize: 13,
      color: colors.danger,
      lineHeight: 18,
    },
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
      marginBottom: 10,
    },
    otpCell: {
      flex: 1,
      maxWidth: 48,
      height: OTP_CELL_SIZE,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    },
    timerText: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 8,
    },
    resendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 16,
    },
    resendBtn: {
      paddingVertical: 4,
    },
    resendBtnDisabled: {
      opacity: 0.45,
    },
    resendText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    selectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 13 : 11,
      marginBottom: 12,
    },
    selectBtnText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    selectBtnPlaceholder: {
      color: colors.textMuted,
    },
    weekendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    weekendChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    weekendChipActive: {
      borderColor: colors.primary,
      backgroundColor: dark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
    },
    weekendChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    weekendChipTextActive: {
      color: colors.primary,
    },
    timeRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    timeCol: { flex: 1 },
    primaryBtn: {
      marginTop: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnPressed: { opacity: 0.88 },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
    secondaryBtn: {
      marginTop: 8,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.secondaryButton,
    },
    secondaryBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    identifierSummary: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 14,
    },
    loadingBox: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    dropdownSafe: { flex: 1, backgroundColor: colors.overlay },
    dropdownBackdrop: { ...StyleSheet.absoluteFill },
    dropdownSheet: {
      marginTop: 'auto',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingBottom: 16,
    },
    dropdownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dropdownTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    dropdownOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dropdownOptionActive: {
      backgroundColor: dark ? 'rgba(37,99,235,0.12)' : '#eff6ff',
    },
    dropdownOptionText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    dropdownOptionTextActive: {
      fontWeight: '700',
      color: colors.primary,
    },
  });
}

type DropdownOption = { value: string; label: string };

export function CreateEmployeeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const { props: statusProps, presentSuccess, presentError } = useStatusAlert();
  const { props: leaveConfirmProps, present: presentLeaveConfirm } =
    useLeaveConfirmModal();
  const leaveOnConfirmRef = useRef<(() => void) | null>(null);

  const [step, setStep] = useState<ScreenStep>(1);
  const [stepWidth, setStepWidth] = useState(0);
  const [channel, setChannel] = useState<SignupChannel>('email');
  const [email, setEmail] = useState('');
  const [phoneCountry, setPhoneCountry] =
    useState<LoginCountry>(DEFAULT_LOGIN_COUNTRY);
  const [phoneNational, setPhoneNational] = useState('');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(
    Array(OTP_LENGTH).fill(''),
  );
  const [otpSent, setOtpSent] = useState(false);
  const [verifiedIdentifier, setVerifiedIdentifier] = useState('');
  const [otpExpiryLeft, setOtpExpiryLeft] = useState(0);
  const [resendLeft, setResendLeft] = useState(0);
  const [contactError, setContactError] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [form, setForm] = useState<CreateEmployeeFormData>(() => ({
    ...EMPTY_CREATE_EMPLOYEE_FORM,
    joining_date: todayIso(),
  }));
  const [formErrors, setFormErrors] = useState<CreateEmployeeFormErrors>({});
  const [formOptionsLoading, setFormOptionsLoading] = useState(false);
  const [constants, setConstants] = useState<InvitePackageFormConstants | null>(
    null,
  );
  const [permissionPackages, setPermissionPackages] = useState<
    PermissionPackage[]
  >([]);
  const [dropdownField, setDropdownField] = useState<string | null>(null);
  const [joiningPickerVisible, setJoiningPickerVisible] = useState(false);

  const otpInputsRef = useRef<Array<TextInput | null>>([]);
  const nameInputRef = useRef<TextInput | null>(null);
  const detailsScrollRef = useRef<ScrollView | null>(null);
  const fieldLayoutsRef = useRef<Partial<Record<keyof CreateEmployeeFormErrors, number>>>(
    {},
  );
  const slideAnim = useRef(new Animated.Value(0)).current;
  const leavingConfirmedRef = useRef(false);
  const expiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const shiftStartPicker = useTimePicker({
    initialValue: form.shift_start,
    onConfirm: time => setForm(f => ({ ...f, shift_start: time })),
  });
  const shiftEndPicker = useTimePicker({
    initialValue: form.shift_end,
    onConfirm: time => setForm(f => ({ ...f, shift_end: time })),
  });
  const breakPicker = useTimePicker({
    initialValue: form.break_minutes,
    use24Hour: true,
    onConfirm: time => setForm(f => ({ ...f, break_minutes: time })),
  });
  const gracePicker = useTimePicker({
    initialValue: form.grace_minutes,
    use24Hour: true,
    onConfirm: time => setForm(f => ({ ...f, grace_minutes: time })),
  });

  const goToStep = useCallback(
    (next: ScreenStep) => {
      if (stepWidth > 0) {
        Animated.timing(slideAnim, {
          toValue: -(next - 1) * stepWidth,
          duration: 280,
          useNativeDriver: true,
        }).start();
      }
      setStep(next);
    },
    [slideAnim, stepWidth],
  );

  const onStepViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width > 0 && width !== stepWidth) {
        setStepWidth(width);
        slideAnim.setValue(-(step - 1) * width);
      }
    },
    [slideAnim, step, stepWidth],
  );

  const registerFieldLayout = useCallback(
    (key: keyof CreateEmployeeFormErrors) => (event: LayoutChangeEvent) => {
      fieldLayoutsRef.current[key] = event.nativeEvent.layout.y;
    },
    [],
  );

  const scrollToFirstError = useCallback((errors: CreateEmployeeFormErrors) => {
    const order: (keyof CreateEmployeeFormErrors)[] = [
      'name',
      'shift_start',
      'shift_end',
    ];
    for (const key of order) {
      if (!errors[key]) {
        continue;
      }
      const y = fieldLayoutsRef.current[key] ?? 0;
      detailsScrollRef.current?.scrollTo({
        y: Math.max(0, y - 16),
        animated: true,
      });
      if (key === 'name') {
        nameInputRef.current?.focus();
      }
      break;
    }
  }, []);

  useLayoutEffect(() => {
    shiftStartPicker.setValue(form.shift_start);
    shiftEndPicker.setValue(form.shift_end);
    breakPicker.setValue(form.break_minutes);
    gracePicker.setValue(form.grace_minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.shift_start, form.shift_end, form.break_minutes, form.grace_minutes]);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearInterval(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const clearResendTimer = useCallback(() => {
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
  }, []);

  const startExpiryTimer = useCallback(() => {
    clearExpiryTimer();
    setOtpExpiryLeft(OTP_EXPIRY_SEC);
    expiryTimerRef.current = setInterval(() => {
      setOtpExpiryLeft(prev => {
        if (prev <= 1) {
          clearExpiryTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearExpiryTimer]);

  const startResendCooldown = useCallback(() => {
    clearResendTimer();
    setResendLeft(RESEND_COOLDOWN_SEC);
    resendTimerRef.current = setInterval(() => {
      setResendLeft(prev => {
        if (prev <= 1) {
          clearResendTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearResendTimer]);

  useEffect(
    () => () => {
      clearExpiryTimer();
      clearResendTimer();
    },
    [clearExpiryTimer, clearResendTimer],
  );

  const promptExit = useCallback(
    (onLeave?: () => void) => {
      leaveOnConfirmRef.current =
        onLeave ??
        (() => {
          leavingConfirmedRef.current = true;
          navigation.goBack();
        });
      presentLeaveConfirm({
        title: t('home.createEmployee.exitConfirmTitle'),
        message: t('home.createEmployee.exitConfirmMessage'),
        stayLabel: t('home.createEmployee.exitConfirmStay'),
        leaveLabel: t('home.createEmployee.exitConfirmLeave'),
        onConfirmLeave: () => {
          leavingConfirmedRef.current = true;
          leaveOnConfirmRef.current?.();
          leaveOnConfirmRef.current = null;
        },
      });
    },
    [navigation, presentLeaveConfirm, t],
  );

  const handleBackPress = useCallback(() => {
    if (step === 2 || step === 3) {
      promptExit();
      return;
    }
    navigation.goBack();
  }, [navigation, promptExit, step]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 2 || step === 3) {
        promptExit();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [isFocused, promptExit, step]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', event => {
      if (step === 1 || leavingConfirmedRef.current) {
        return;
      }
      event.preventDefault();
      promptExit(() => {
        navigation.dispatch(event.data.action);
      });
    });
    return unsubscribe;
  }, [navigation, promptExit, step]);

  useEffect(() => {
    if (companyId == null) {
      return;
    }
    setFormOptionsLoading(true);
    Promise.all([
      constantsApi.list(),
      employeeManagementApi.getAllPermissionPackages(companyId),
    ])
      .then(([constantsRes, packagesRes]) => {
        if (constantsRes.success && constantsRes.data) {
          setConstants(mapGlobalConstantsToFormConstants(constantsRes.data));
        }
        if (packagesRes.success && packagesRes.data) {
          setPermissionPackages(packagesRes.data);
        }
      })
      .catch(() => { })
      .finally(() => setFormOptionsLoading(false));
  }, [companyId]);

  const signupType: CreateEmployeeSignupType =
    channel === 'email' ? 'email' : 'phone';
  const phoneCombined = combinePhoneDigits(phoneCountry, phoneNational);
  const otpValue = otpDigits.join('');

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const validateContact = useCallback((): string | null => {
    if (channel === 'email') {
      if (!isValidEmail(email.trim())) {
        return t('home.createEmployee.errors.invalidEmail');
      }
      return null;
    }
    if (!isValidNationalMobile(phoneNational)) {
      return t('home.createEmployee.errors.invalidPhone');
    }
    if (phoneCombined.length < 10) {
      return t('home.createEmployee.errors.invalidPhone');
    }
    return null;
  }, [channel, email, phoneCombined.length, phoneNational, t]);

  const handleRequestOtp = useCallback(async () => {
    if (companyId == null) {
      return false;
    }
    const validationError = validateContact();
    if (validationError) {
      setContactError(validationError);
      return false;
    }
    setContactError(null);
    setRequestLoading(true);
    try {
      const body =
        channel === 'email'
          ? { signup_type: 'email' as const, email: email.trim() }
          : { signup_type: 'phone' as const, phone: phoneCombined };
      const res = await createEmployeeApi.requestCreateOtp(companyId, body);
      if (!res.success) {
        setContactError(res.message?.trim() || t('home.createEmployee.errors.otpRequestFailed'));
        return false;
      }
      setOtpSent(true);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setVerifiedIdentifier(channel === 'email' ? email.trim() : phoneCombined);
      startExpiryTimer();
      startResendCooldown();
      return true;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        startResendCooldown();
      }
      setContactError(readApiError(err));
      return false;
    } finally {
      setRequestLoading(false);
    }
  }, [
    channel,
    companyId,
    email,
    phoneCombined,
    startExpiryTimer,
    startResendCooldown,
    t,
    validateContact,
  ]);

  const handleContinueFromContact = useCallback(async () => {
    const sent = await handleRequestOtp();
    if (sent) {
      goToStep(2);
    }
  }, [goToStep, handleRequestOtp]);

  const handleContinueToOtp = useCallback(() => {
    const errors = validateCreateEmployeeForm(form, {
      name: t('home.createEmployee.errors.name'),
      shiftStart: t('home.createEmployee.errors.shiftStart'),
      shiftEnd: t('home.createEmployee.errors.shiftEnd'),
    });
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => {
        scrollToFirstError(errors);
      });
      return;
    }
    setContactError(null);
    goToStep(3);
  }, [form, goToStep, scrollToFirstError, t]);

  const handleResendOtp = useCallback(async () => {
    if (resendLeft > 0 || requestLoading) {
      return;
    }
    await handleRequestOtp();
  }, [handleRequestOtp, requestLoading, resendLeft]);

  const setDigitAt = useCallback((index: number, value: string) => {
    setOtpDigits(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleOtpChange = useCallback(
    (text: string, index: number) => {
      const numeric = text.replace(/\D/g, '');
      if (numeric.length > 1) {
        const chars = numeric.slice(0, OTP_LENGTH).split('');
        setOtpDigits(prev => {
          const next = [...prev];
          for (let i = 0; i < chars.length && index + i < OTP_LENGTH; i++) {
            next[index + i] = chars[i] ?? '';
          }
          return next;
        });
        const nextFocus = Math.min(index + chars.length, OTP_LENGTH - 1);
        otpInputsRef.current[nextFocus]?.focus();
        return;
      }
      setDigitAt(index, numeric);
      if (numeric && index < OTP_LENGTH - 1) {
        otpInputsRef.current[index + 1]?.focus();
      }
    },
    [setDigitAt],
  );

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
    [dropdownField],
  );

  const getDropdownOptions = useCallback((): DropdownOption[] => {
    if (!constants && dropdownField !== 'permission_package') {
      return [];
    }
    switch (dropdownField) {
      case 'designation':
        return (constants?.designations ?? []).map(o => ({
          value: o.value,
          label: o.label,
        }));
      case 'employment_type':
        return (constants?.employment_types ?? []).map(o => ({
          value: o.value,
          label: o.label,
        }));
      case 'salary_type':
        return (constants?.salary_types ?? []).map(o => ({
          value: o.value,
          label: o.label,
        }));
      case 'permission_package':
        return permissionPackages.map(p => ({
          value: String(p.id),
          label: p.name,
        }));
      default:
        return [];
    }
  }, [constants, dropdownField, permissionPackages]);

  const getDropdownSelected = useCallback((): string => {
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

  const getDropdownDisplay = useCallback(
    (field: string): string => {
      const options =
        field === 'permission_package'
          ? permissionPackages.map(p => ({
            value: String(p.id),
            label: p.name,
          }))
          : field === 'designation'
            ? (constants?.designations ?? [])
            : field === 'employment_type'
              ? (constants?.employment_types ?? [])
              : field === 'salary_type'
                ? (constants?.salary_types ?? [])
                : [];
      const selected =
        field === 'permission_package'
          ? form.permission_package_id != null
            ? String(form.permission_package_id)
            : ''
          : field === 'designation'
            ? form.designation
            : field === 'employment_type'
              ? form.employment_type
              : field === 'salary_type'
                ? form.salary_type
                : '';
      return options.find(o => o.value === selected)?.label ?? '';
    },
    [constants, form, permissionPackages],
  );

  const toggleWeekend = useCallback((day: string) => {
    setForm(f => ({
      ...f,
      weekends: f.weekends.includes(day)
        ? f.weekends.filter(d => d !== day)
        : [...f.weekends, day],
    }));
  }, []);

  const handleCreate = useCallback(async () => {
    if (companyId == null) {
      return;
    }
    const errors = validateCreateEmployeeForm(form, {
      name: t('home.createEmployee.errors.name'),
      shiftStart: t('home.createEmployee.errors.shiftStart'),
      shiftEnd: t('home.createEmployee.errors.shiftEnd'),
    });
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      const focusFirstError = () => {
        scrollToFirstError(errors);
      };
      if (step !== 2) {
        goToStep(2);
        setTimeout(focusFirstError, 320);
      } else {
        requestAnimationFrame(focusFirstError);
      }
      return;
    }
    if (!otpSent) {
      setContactError(t('home.createEmployee.errors.otpRequired'));
      return;
    }
    if (otpValue.length !== OTP_LENGTH) {
      setContactError(t('home.createEmployee.errors.otpIncomplete'));
      return;
    }
    if (otpExpiryLeft <= 0) {
      setContactError(t('home.createEmployee.errors.otpExpired'));
      return;
    }
    setContactError(null);
    setCreateLoading(true);
    try {
      const coords = await tryOptionalLocationCoords();
      const payload = buildCreateEmployeePayload({
        signupType,
        email: verifiedIdentifier,
        phone: verifiedIdentifier,
        otp: otpValue,
        form,
        coords,
      });
      const res = await createEmployeeApi.createEmployee(companyId, payload);
      if (!res.success) {
        presentError({
          title: t('home.createEmployee.errors.createFailedTitle'),
          message: res.message?.trim() || t('home.createEmployee.errors.createFailed'),
        });
        return;
      }
      presentSuccess({
        title: t('home.createEmployee.successTitle'),
        message: res.message?.trim() || t('home.createEmployee.successMessage'),
        buttonText: t('home.createEmployee.successButton'),
        onAfterDismiss: () => {
          leavingConfirmedRef.current = true;
          navigation.replace('EmployeeList');
        },
      });
    } catch (err) {
      presentError({
        title: t('home.createEmployee.errors.createFailedTitle'),
        message: readApiError(err),
      });
    } finally {
      setCreateLoading(false);
    }
  }, [
    companyId,
    form,
    goToStep,
    navigation,
    otpValue,
    presentError,
    presentSuccess,
    scrollToFirstError,
    signupType,
    step,
    otpExpiryLeft,
    otpSent,
    t,
    verifiedIdentifier,
  ]);

  const dropdownTitle = useMemo(() => {
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
            {t('home.createEmployee.title')}
          </Text>
        </View>
        <View style={styles.loadingBox}>
          <Text style={styles.sectionHint}>
            {t('home.createEmployee.noCompany')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={handleBackPress}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.createEmployee.back')}
        />
        <Text style={styles.stackHeaderTitle} numberOfLines={1}>
          {t('home.createEmployee.title')}
        </Text>
      </View>

      <View style={styles.fill}>
        <View style={styles.stepHeader}>
          <View style={styles.stepRow}>
            <View
              style={[
                styles.stepChip,
                step === 1 && styles.stepChipActive,
                step > 1 && styles.stepChipDone,
              ]}
            >
              <Text
                style={[
                  styles.stepChipText,
                  step === 1 && styles.stepChipTextActive,
                  step > 1 && styles.stepChipTextDone,
                ]}
              >
                {t('home.createEmployee.stepContact')}
              </Text>
            </View>
            <View
              style={[
                styles.stepChip,
                step === 2 && styles.stepChipActive,
                step > 2 && styles.stepChipDone,
              ]}
            >
              <Text
                style={[
                  styles.stepChipText,
                  step === 2 && styles.stepChipTextActive,
                  step > 2 && styles.stepChipTextDone,
                ]}
              >
                {t('home.createEmployee.stepDetails')}
              </Text>
            </View>
            <View
              style={[styles.stepChip, step === 3 && styles.stepChipActive]}
            >
              <Text
                style={[
                  styles.stepChipText,
                  step === 3 && styles.stepChipTextActive,
                ]}
              >
                {t('home.createEmployee.stepOtp')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.stepViewport} onLayout={onStepViewportLayout}>
          <Animated.View
            style={[
              styles.stepStrip,
              stepWidth > 0 && {
                width: stepWidth * 3,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <ScrollView
              style={[styles.stepPanelScroll, stepWidth > 0 && { width: stepWidth }]}
              contentContainerStyle={styles.stepPanelContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
              pointerEvents={step === 1 ? 'auto' : 'none'}
            >
              <Text style={styles.sectionTitle}>
                {t('home.createEmployee.contactTitle')}
              </Text>
              <Text style={styles.sectionHint}>
                {t('home.createEmployee.contactHint')}
              </Text>

              <View style={styles.channelRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setChannel('email')}
                  style={[
                    styles.channelBtn,
                    channel === 'email' && styles.channelBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.channelBtnText,
                      channel === 'email' && styles.channelBtnTextActive,
                    ]}
                  >
                    {t('home.createEmployee.emailSignup')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setChannel('phone')}
                  style={[
                    styles.channelBtn,
                    channel === 'phone' && styles.channelBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.channelBtnText,
                      channel === 'phone' && styles.channelBtnTextActive,
                    ]}
                  >
                    {t('home.createEmployee.phoneSignup')}
                  </Text>
                </Pressable>
              </View>

              {channel === 'email' ? (
                <>
                  <Text style={styles.fieldLabel}>
                    {t('home.createEmployee.emailLabel')}
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={t('home.createEmployee.emailPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>
                    {t('home.createEmployee.phoneLabel')}
                  </Text>
                  <View style={styles.phoneRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setCountryPickerVisible(true)}
                      style={styles.countryBtn}
                    >
                      <Text style={styles.countryDial}>
                        {phoneCountry.dialCode}
                      </Text>
                      <MaterialCommunityIcons
                        name="chevron-down"
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    <TextInput
                      value={phoneNational}
                      onChangeText={v => setPhoneNational(v.replace(/\D/g, ''))}
                      keyboardType="phone-pad"
                      placeholder={t('home.createEmployee.phonePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, styles.phoneInput]}
                    />
                  </View>
                </>
              )}

              {contactError && step === 1 ? (
                <View style={styles.bannerError}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={18}
                    color={colors.danger}
                  />
                  <Text style={styles.bannerErrorText}>{contactError}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={requestLoading}
                onPress={() => {
                  handleContinueFromContact().catch(() => { });
                }}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  requestLoading && styles.primaryBtnDisabled,
                  pressed && !requestLoading && styles.primaryBtnPressed,
                ]}
              >
                {requestLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {t('home.createEmployee.continue')}
                  </Text>
                )}
              </Pressable>
            </ScrollView>

            <ScrollView
              ref={detailsScrollRef}
              style={[styles.stepPanelScroll, stepWidth > 0 && { width: stepWidth }]}
              contentContainerStyle={styles.stepPanelContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
              pointerEvents={step === 2 ? 'auto' : 'none'}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => goToStep(1)}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>
                  {t('home.createEmployee.backToContact')}
                </Text>
              </Pressable>

              {formOptionsLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.sectionHint}>
                    {t('home.invitePackages.formModal.loadingConstants')}
                  </Text>
                </View>
              ) : (
                <>
                  <View onLayout={registerFieldLayout('name')}>
                    <Text style={styles.fieldLabel}>
                      {t('home.createEmployee.nameLabel')}
                    </Text>
                    <TextInput
                      ref={nameInputRef}
                      value={form.name}
                      onChangeText={v => setForm(f => ({ ...f, name: v }))}
                      placeholder={t('home.createEmployee.namePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, formErrors.name && styles.inputError]}
                    />
                    {formErrors.name ? (
                      <Text style={styles.errorText}>{formErrors.name}</Text>
                    ) : null}
                  </View>

                  <Text style={styles.fieldLabel}>
                    {t('home.createEmployee.joiningDate')}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setJoiningPickerVisible(true)}
                    style={styles.selectBtn}
                  >
                    <Text style={styles.selectBtnText}>
                      {form.joining_date || todayIso()}
                    </Text>
                    <MaterialCommunityIcons
                      name="calendar"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  <Text style={styles.fieldLabel}>
                    {t('home.invitePackages.formModal.permissionPackage')}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDropdownField('permission_package')}
                    style={styles.selectBtn}
                  >
                    <Text
                      style={[
                        styles.selectBtnText,
                        !getDropdownDisplay('permission_package') &&
                        styles.selectBtnPlaceholder,
                      ]}
                    >
                      {getDropdownDisplay('permission_package') ||
                        t('home.invitePackages.formModal.selectPackage')}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  <Text style={styles.fieldLabel}>
                    {t('home.invitePackages.formModal.designation')}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDropdownField('designation')}
                    style={styles.selectBtn}
                  >
                    <Text
                      style={[
                        styles.selectBtnText,
                        !getDropdownDisplay('designation') &&
                        styles.selectBtnPlaceholder,
                      ]}
                    >
                      {getDropdownDisplay('designation') ||
                        t('home.invitePackages.formModal.selectDesignation')}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  <Text style={styles.fieldLabel}>
                    {t('home.invitePackages.formModal.employmentType')}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDropdownField('employment_type')}
                    style={styles.selectBtn}
                  >
                    <Text
                      style={[
                        styles.selectBtnText,
                        !getDropdownDisplay('employment_type') &&
                        styles.selectBtnPlaceholder,
                      ]}
                    >
                      {getDropdownDisplay('employment_type') ||
                        t('home.invitePackages.formModal.selectEmploymentType')}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  <Text style={styles.fieldLabel}>
                    {t('home.invitePackages.formModal.salaryType')}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDropdownField('salary_type')}
                    style={styles.selectBtn}
                  >
                    <Text
                      style={[
                        styles.selectBtnText,
                        !getDropdownDisplay('salary_type') &&
                        styles.selectBtnPlaceholder,
                      ]}
                    >
                      {getDropdownDisplay('salary_type') ||
                        t('home.invitePackages.formModal.selectSalaryType')}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  <View
                    style={styles.timeRow}
                    onLayout={registerFieldLayout('shift_start')}
                  >
                    <View style={styles.timeCol}>
                      <Text style={styles.fieldLabel}>
                        {t('home.invitePackages.formModal.shiftStart')}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={shiftStartPicker.present}
                        style={[
                          styles.selectBtn,
                          formErrors.shift_start && styles.inputError,
                        ]}
                      >
                        <Text style={styles.selectBtnText}>
                          {formatTime12h(form.shift_start)}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.timeCol}>
                      <Text style={styles.fieldLabel}>
                        {t('home.invitePackages.formModal.shiftEnd')}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={shiftEndPicker.present}
                        style={[
                          styles.selectBtn,
                          formErrors.shift_end && styles.inputError,
                        ]}
                      >
                        <Text style={styles.selectBtnText}>
                          {formatTime12h(form.shift_end)}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                  {formErrors.shift_start ? (
                    <Text style={styles.errorText}>{formErrors.shift_start}</Text>
                  ) : null}
                  {formErrors.shift_end ? (
                    <Text style={styles.errorText}>{formErrors.shift_end}</Text>
                  ) : null}

                  <Text style={styles.fieldLabel}>
                    {t('home.invitePackages.formModal.breakMinutes')}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={breakPicker.present}
                    style={styles.selectBtn}
                  >
                    <Text style={styles.selectBtnText}>
                      {formatTime24h(form.break_minutes)}
                    </Text>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  <Text style={styles.fieldLabel}>
                    {t('home.invitePackages.formModal.graceMinutes')}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={gracePicker.present}
                    style={styles.selectBtn}
                  >
                    <Text style={styles.selectBtnText}>
                      {formatTime24h(form.grace_minutes)}
                    </Text>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  <Text style={styles.fieldLabel}>
                    {t('home.invitePackages.formModal.weekends')}
                  </Text>
                  <View style={styles.weekendRow}>
                    {ALL_WEEKDAYS.map(day => {
                      const active = form.weekends.includes(day);
                      return (
                        <Pressable
                          key={day}
                          accessibilityRole="button"
                          onPress={() => toggleWeekend(day)}
                          style={[
                            styles.weekendChip,
                            active && styles.weekendChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.weekendChipText,
                              active && styles.weekendChipTextActive,
                            ]}
                          >
                            {t(`home.invitePackages.days.${day}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={handleContinueToOtp}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && styles.primaryBtnPressed,
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>
                      {t('home.createEmployee.continue')}
                    </Text>
                  </Pressable>
                </>
              )}
            </ScrollView>

            <ScrollView
              style={[styles.stepPanelScroll, stepWidth > 0 && { width: stepWidth }]}
              contentContainerStyle={styles.stepPanelContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
              pointerEvents={step === 3 ? 'auto' : 'none'}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => goToStep(2)}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>
                  {t('home.createEmployee.backToDetails')}
                </Text>
              </Pressable>

              <Text style={styles.sectionTitle}>
                {t('home.createEmployee.otpTitle')}
              </Text>
              <Text style={styles.sectionHint}>
                {t('home.createEmployee.otpHint', {
                  identifier: verifiedIdentifier || '—',
                })}
              </Text>
              {verifiedIdentifier ? (
                <Text style={styles.identifierSummary}>{verifiedIdentifier}</Text>
              ) : null}

              <Text style={styles.fieldLabel}>
                {t('home.createEmployee.otpLabel')}
              </Text>
              <View style={styles.otpRow}>
                {otpDigits.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={ref => {
                      otpInputsRef.current[index] = ref;
                    }}
                    value={digit}
                    onChangeText={text => handleOtpChange(text, index)}
                    onKeyPress={({ nativeEvent }) => {
                      if (
                        nativeEvent.key === 'Backspace' &&
                        !digit &&
                        index > 0
                      ) {
                        otpInputsRef.current[index - 1]?.focus();
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                    selectTextOnFocus
                    style={styles.otpCell}
                  />
                ))}
              </View>
              <Text style={styles.timerText}>
                {otpExpiryLeft > 0
                  ? t('home.createEmployee.otpExpiresIn', {
                    time: formatTimer(otpExpiryLeft),
                  })
                  : t('home.createEmployee.otpExpired')}
              </Text>
              <View style={styles.resendRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={resendLeft > 0 || requestLoading}
                  onPress={() => {
                    handleResendOtp().catch(() => { });
                  }}
                  style={[
                    styles.resendBtn,
                    (resendLeft > 0 || requestLoading) &&
                    styles.resendBtnDisabled,
                  ]}
                >
                  <Text style={styles.resendText}>
                    {resendLeft > 0
                      ? t('home.createEmployee.resendIn', {
                        seconds: resendLeft,
                      })
                      : t('home.createEmployee.resendOtp')}
                  </Text>
                </Pressable>
              </View>

              {contactError && step === 3 ? (
                <View style={styles.bannerError}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={18}
                    color={colors.danger}
                  />
                  <Text style={styles.bannerErrorText}>{contactError}</Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={createLoading}
                onPress={() => {
                  handleCreate().catch(() => { });
                }}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  createLoading && styles.primaryBtnDisabled,
                  pressed && !createLoading && styles.primaryBtnPressed,
                ]}
              >
                {createLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {t('home.createEmployee.createButton')}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      </View>

      <Modal
        visible={dropdownField != null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setDropdownField(null)}
      >
        <SafeAreaView style={styles.dropdownSafe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={() => setDropdownField(null)}
          />
          <View style={styles.dropdownSheet}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>{dropdownTitle}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDropdownField(null)}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
            <FlatList
              data={getDropdownOptions()}
              keyExtractor={item => item.value}
              renderItem={({ item }) => {
                const active = item.value === getDropdownSelected();
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      handleDropdownSelect(item.value);
                      setDropdownField(null);
                    }}
                    style={[
                      styles.dropdownOption,
                      active && styles.dropdownOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        active && styles.dropdownOptionTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>

      <CountryCodePicker
        visible={countryPickerVisible}
        selectedCountryCode={phoneCountry.code}
        onSelectCountry={setPhoneCountry}
        onDismiss={() => setCountryPickerVisible(false)}
      />

      <DatePicker
        visible={joiningPickerVisible}
        value={form.joining_date || todayIso()}
        maxDate={todayIso()}
        title={t('home.createEmployee.joiningDate')}
        onDismiss={() => setJoiningPickerVisible(false)}
        onConfirm={date => {
          setForm(f => ({ ...f, joining_date: date }));
          setJoiningPickerVisible(false);
        }}
      />

      <TimePicker {...shiftStartPicker.pickerProps} />
      <TimePicker {...shiftEndPicker.pickerProps} />
      <TimePicker {...breakPicker.pickerProps} />
      <TimePicker {...gracePicker.pickerProps} />

      <LeaveConfirmModal {...leaveConfirmProps} />

      <StatusAlert {...statusProps} />
    </SafeAreaView>
  );
}
