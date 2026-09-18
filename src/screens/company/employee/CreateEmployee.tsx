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
  BackHandler,
  FlatList,
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
import { invitePackageApi } from '@src/api/invitePackageApi';
import { salaryApi } from '@src/api/salaryApi';
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
import type { AppThemeColors } from '@src/theme/palettes';
import {
  EMPTY_CREATE_EMPLOYEE_FORM,
  type CreateEmployeeFormData,
  type SalaryComponentEntry,
} from '@src/types/createEmployee';
import type { PermissionPackage } from '@src/types/employeeManagement';
import type { InvitePackageItem } from '@src/types/invitePackage';
import type {
  SalaryComponent,
  SalaryPackage,
} from '@src/types/salary';
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
import { tryOptionalLocationCoords } from '@src/utils/optionalLocationCoords';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'CreateEmployee'>;

type SignupChannel = 'email' | 'phone';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 30;

const ALL_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type DropdownOption = {
  value: string;
  label: string;
  subtitle?: string;
};

export function CreateEmployeeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const isFocused = useIsFocused();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const { props: statusProps, presentError, presentSuccess } = useStatusAlert();
  const { props: leaveConfirmProps, present: presentLeaveConfirm } =
    useLeaveConfirmModal();
  const leaveOnConfirmRef = useRef<(() => void) | null>(null);

  // Contact & OTP state
  const [channel, setChannel] = useState<SignupChannel>('email');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [phoneNational, setPhoneNational] = useState('');
  const [phoneCountry, setPhoneCountry] =
    useState<LoginCountry>(DEFAULT_LOGIN_COUNTRY);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verifiedIdentifier, setVerifiedIdentifier] = useState('');
  const [resendLeft, setResendLeft] = useState(0);
  const [contactError, setContactError] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Form state
  const [form, setForm] = useState<CreateEmployeeFormData>(() => {
    const today = todayIso();
    return {
      ...EMPTY_CREATE_EMPLOYEE_FORM,
      joining_date: today,
      effective_from: `${today.slice(0, 8)}01`,
    };
  });
  const [formErrors, setFormErrors] = useState<CreateEmployeeFormErrors>({});

  // Dropdown & package data
  const [constantsLoading, setConstantsLoading] = useState(false);
  const [constants, setConstants] = useState<InvitePackageFormConstants | null>(
    null,
  );
  const [permissionPackages, setPermissionPackages] = useState<
    PermissionPackage[]
  >([]);
  const [onboardingPackages, setOnboardingPackages] = useState<
    InvitePackageItem[]
  >([]);
  const [salaryPackages, setSalaryPackages] = useState<SalaryPackage[]>([]);
  const [availableComponents, setAvailableComponents] = useState<
    SalaryComponent[]
  >([]);

  // Modals & pickers
  const [dropdownField, setDropdownField] = useState<string | null>(null);
  const [joiningPickerVisible, setJoiningPickerVisible] = useState(false);
  const [effectiveFromPickerVisible, setEffectiveFromPickerVisible] =
    useState(false);
  const [effectiveToPickerVisible, setEffectiveToPickerVisible] =
    useState(false);

  // Add Component Modal
  const [addComponentVisible, setAddComponentVisible] = useState(false);
  const [newComponentId, setNewComponentId] = useState<number | null>(null);
  const [newComponentCalcType, setNewComponentCalcType] = useState<
    'fixed' | 'percentage'
  >('percentage');
  const [newComponentValue, setNewComponentValue] = useState('');
  const [newComponentReason, setNewComponentReason] = useState('');

  const scrollRef = useRef<ScrollView | null>(null);
  const leavingConfirmedRef = useRef(false);
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

  useLayoutEffect(() => {
    shiftStartPicker.setValue(form.shift_start);
    shiftEndPicker.setValue(form.shift_end);
    breakPicker.setValue(form.break_minutes);
    gracePicker.setValue(form.grace_minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.shift_start, form.shift_end, form.break_minutes, form.grace_minutes]);

  const clearResendTimer = useCallback(() => {
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
  }, []);

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
      clearResendTimer();
    },
    [clearResendTimer],
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
    if (otpSent || form.name.trim()) {
      promptExit();
      return;
    }
    navigation.goBack();
  }, [form.name, navigation, otpSent, promptExit]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (otpSent || form.name.trim()) {
        promptExit();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [form.name, isFocused, otpSent, promptExit]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', event => {
      if (!otpSent && !form.name.trim()) {
        return;
      }
      if (leavingConfirmedRef.current) {
        return;
      }
      event.preventDefault();
      promptExit(() => {
        navigation.dispatch(event.data.action);
      });
    });
    return unsubscribe;
  }, [form.name, navigation, otpSent, promptExit]);

  // Fetch initial constants & package options
  useEffect(() => {
    if (companyId == null) {
      return;
    }
    setConstantsLoading(true);
    Promise.all([
      constantsApi.list(),
      employeeManagementApi.getAllPermissionPackages(companyId),
      invitePackageApi.list(companyId, { limit: 100 }),
      salaryApi.listPackages(companyId),
      salaryApi.listComponents(companyId),
    ])
      .then(
        ([constantsRes, packagesRes, invitePackagesRes, salaryPackagesRes, componentsRes]) => {
          if (constantsRes.success && constantsRes.data) {
            setConstants(mapGlobalConstantsToFormConstants(constantsRes.data));
          }
          if (packagesRes.success && packagesRes.data) {
            setPermissionPackages(packagesRes.data);
          }
          if (invitePackagesRes.success && invitePackagesRes.data) {
            setOnboardingPackages(invitePackagesRes.data);
          }
          if (salaryPackagesRes.success && salaryPackagesRes.data) {
            setSalaryPackages(salaryPackagesRes.data);
          }
          if (componentsRes.success && componentsRes.data) {
            setAvailableComponents(componentsRes.data);
          }
        },
      )
      .catch(() => {})
      .finally(() => setConstantsLoading(false));
  }, [companyId]);

  const phoneCombined = combinePhoneDigits(phoneCountry, phoneNational);
  const contactDisplay =
    channel === 'email' ? email.trim() : phoneCombined;

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
        setContactError(
          res.message?.trim() || t('home.createEmployee.errors.otpRequestFailed'),
        );
        return false;
      }
      setOtpSent(true);
      setOtp('');
      setVerifiedIdentifier(contactDisplay);
      startResendCooldown();
      setStep(2);
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
    contactDisplay,
    email,
    phoneCombined,
    startResendCooldown,
    t,
    validateContact,
  ]);

  const handleChangeContact = useCallback(() => {
    setOtpSent(false);
    setOtp('');
    setContactError(null);
    clearResendTimer();
    setResendLeft(0);
    setStep(1);
  }, [clearResendTimer]);

  const handleContinueToOtp = useCallback(() => {
    const errors = validateCreateEmployeeForm(form, {
      name: t('home.createEmployee.errors.name'),
      permissionPackage: t('home.createEmployee.errors.permissionPackage'),
      designation: t('home.createEmployee.errors.designation'),
      employmentType: t('home.createEmployee.errors.employmentType'),
      salaryType: t('home.createEmployee.errors.salaryType'),
      baseAmount: t('home.createEmployee.errors.baseAmount'),
      effectiveFrom: t('home.createEmployee.errors.effectiveFrom'),
      shiftStart: t('home.createEmployee.errors.shiftStart'),
      shiftEnd: t('home.createEmployee.errors.shiftEnd'),
    });
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setContactError(null);
    setStep(3);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [form, t]);

  // Onboarding Package auto-fill
  const handleOnboardingPackageSelect = useCallback(
    (packageId: string) => {
      const pkg = onboardingPackages.find(p => String(p.id) === String(packageId));
      if (!pkg) {
        return;
      }
      const getVal = (v: any) =>
        typeof v === 'object' && v !== null ? v.value : v;

      const designationValue = getVal(pkg.designation);
      const employmentTypeValue = getVal(pkg.employment_type);
      const salaryTypeValue = getVal(pkg.salary_type);
      const normalizedWeekends = Array.isArray(pkg.weekends)
        ? pkg.weekends
            .map(w => (typeof w === 'object' && w !== null ? (w as any).day : w))
            .filter(Boolean)
        : [];

      const pkgComponents = (pkg as any).salary_components || (pkg as any).components || [];
      const newComponents: SalaryComponentEntry[] = pkgComponents
        .map((comp: any) => ({
          component_id: comp.component_id,
          calc_type: comp.calc_type || 'percentage',
          calc_value:
            comp.calc_value == null ? '' : String(comp.calc_value),
          effective_from: form.effective_from || '',
          effective_to: '',
          reason: '',
        }))
        .filter((c: any) => c.component_id);

      setForm(prev => ({
        ...prev,
        designation: designationValue || prev.designation,
        employment_type: employmentTypeValue || prev.employment_type,
        salary_type: salaryTypeValue || prev.salary_type,
        permission_package_id:
          pkg.permission_package_id || prev.permission_package_id,
        shift_start: pkg.shift_start || prev.shift_start,
        shift_end: pkg.shift_end || prev.shift_end,
        break_minutes:
          pkg.break_minutes != null
            ? String(pkg.break_minutes)
            : prev.break_minutes,
        grace_minutes:
          pkg.grace_minutes != null
            ? String(pkg.grace_minutes)
            : prev.grace_minutes,
        weekends: normalizedWeekends.length ? normalizedWeekends : prev.weekends,
        base_amount:
          (pkg as any).base_amount != null
            ? String((pkg as any).base_amount)
            : prev.base_amount,
        components: newComponents.length ? newComponents : prev.components,
        component_package_id:
          (pkg as any).component_package || prev.component_package_id,
      }));

      presentSuccess({
        title: t('home.createEmployee.appliedPackage', {
          name: pkg.name || pkg.code,
        }),
        message: '',
      });
    },
    [form.effective_from, onboardingPackages, presentSuccess, t],
  );

  // Salary Package auto-fill
  const handleSalaryPackageSelect = useCallback(
    (packageId: string) => {
      const pkg = salaryPackages.find(p => String(p.id) === String(packageId));
      if (!pkg) {
        setForm(p => ({ ...p, component_package_id: '' }));
        return;
      }
      const packageComponents: SalaryComponentEntry[] = (pkg.items || []).map(
        item => ({
          component_id: item.component_id,
          calc_type: item.calc_type || 'percentage',
          calc_value: item.calc_value != null ? String(item.calc_value) : '',
          effective_from: form.effective_from || '',
          effective_to: '',
          reason: `From ${pkg.name}`,
        }),
      );
      setForm(prev => ({
        ...prev,
        component_package_id: pkg.id,
        components: packageComponents,
      }));
    },
    [form.effective_from, salaryPackages],
  );

  const toggleWeekend = useCallback((day: string) => {
    setForm(f => ({
      ...f,
      weekends: f.weekends.includes(day)
        ? f.weekends.filter(d => d !== day)
        : [...f.weekends, day],
    }));
  }, []);

  const handleRemoveComponent = useCallback((index: number) => {
    setForm(p => ({
      ...p,
      components: p.components.filter((_, i) => i !== index),
      component_package_id: '',
    }));
  }, []);

  const handleUpdateComponent = useCallback(
    (index: number, key: keyof SalaryComponentEntry, value: any) => {
      setForm(p => {
        const updated = [...p.components];
        updated[index] = { ...updated[index]!, [key]: value };
        return {
          ...p,
          components: updated,
          component_package_id: '',
        };
      });
    },
    [],
  );

  const handleAddComponentConfirm = useCallback(() => {
    if (!newComponentId) {
      return;
    }
    const val = newComponentValue.replace(/[^0-9.]/g, '');
    const entry: SalaryComponentEntry = {
      component_id: newComponentId,
      calc_type: newComponentCalcType,
      calc_value: val,
      effective_from: form.effective_from || '',
      effective_to: '',
      reason: newComponentReason.trim() || undefined,
    };
    setForm(p => ({
      ...p,
      components: [...p.components, entry],
      component_package_id: '',
    }));
    setAddComponentVisible(false);
    setNewComponentId(null);
    setNewComponentCalcType('percentage');
    setNewComponentValue('');
    setNewComponentReason('');
  }, [
    form.effective_from,
    newComponentCalcType,
    newComponentId,
    newComponentReason,
    newComponentValue,
  ]);

  const existingComponentIds = useMemo(
    () => form.components.map(c => c.component_id),
    [form.components],
  );

  const filteredAvailableComponents = useMemo(
    () =>
      availableComponents.filter(c => !existingComponentIds.includes(c.id)),
    [availableComponents, existingComponentIds],
  );

  const handleDropdownSelect = useCallback(
    (value: string) => {
      switch (dropdownField) {
        case 'designation':
          setForm(f => ({ ...f, designation: value }));
          break;
        case 'employment_type':
          setForm(f => ({ ...f, employment_type: value }));
          break;
        case 'salary_type':
          setForm(f => ({ ...f, salary_type: value }));
          break;
        case 'permission_package':
          setForm(f => ({
            ...f,
            permission_package_id: parseInt(value, 10) || null,
          }));
          break;
        case 'onboarding_package':
          handleOnboardingPackageSelect(value);
          break;
        case 'salary_package':
          handleSalaryPackageSelect(value);
          break;
        case 'new_component_select':
          setNewComponentId(parseInt(value, 10) || null);
          break;
        case 'new_component_calc_type':
          setNewComponentCalcType(value as 'fixed' | 'percentage');
          break;
        default:
          break;
      }
    },
    [dropdownField, handleOnboardingPackageSelect, handleSalaryPackageSelect],
  );

  const getDropdownOptions = useCallback((): DropdownOption[] => {
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
      case 'onboarding_package':
        return onboardingPackages.map(p => ({
          value: String(p.id),
          label: p.name ? `${p.name} (${p.code})` : p.code,
        }));
      case 'salary_package':
        return salaryPackages.map(p => ({
          value: String(p.id),
          label: `${p.name} (${p.code})`,
        }));
      case 'new_component_select':
        return filteredAvailableComponents.map(c => ({
          value: String(c.id),
          label: c.code ? `${c.name} (${c.code})` : c.name,
          subtitle: c.type ? `Type: ${c.type}` : undefined,
        }));
      case 'new_component_calc_type':
        return [
          { value: 'percentage', label: t('home.createEmployee.percentage') },
          { value: 'fixed', label: t('home.createEmployee.fixed') },
        ];
      default:
        return [];
    }
  }, [
    constants,
    dropdownField,
    filteredAvailableComponents,
    onboardingPackages,
    permissionPackages,
    salaryPackages,
    t,
  ]);

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
      case 'salary_package':
        return form.component_package_id
          ? String(form.component_package_id)
          : '';
      case 'new_component_select':
        return newComponentId ? String(newComponentId) : '';
      case 'new_component_calc_type':
        return newComponentCalcType;
      default:
        return '';
    }
  }, [
    dropdownField,
    form.component_package_id,
    form.designation,
    form.employment_type,
    form.permission_package_id,
    form.salary_type,
    newComponentCalcType,
    newComponentId,
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
      case 'onboarding_package':
        return t('home.createEmployee.onboardingPackage');
      case 'salary_package':
        return t('home.createEmployee.salaryPackage');
      case 'new_component_select':
        return t('home.createEmployee.selectComponent');
      case 'new_component_calc_type':
        return t('home.createEmployee.calcType');
      default:
        return '';
    }
  }, [dropdownField, t]);

  const isFormValid = useMemo(() => {
    const contactOk =
      channel === 'email'
        ? isValidEmail(email.trim())
        : isValidNationalMobile(phoneNational) && phoneCombined.length >= 10;
    const baseAmt = Number(form.base_amount.trim());
    return Boolean(
      contactOk &&
        otp.trim().length === OTP_LENGTH &&
        form.name.trim().length >= 3 &&
        form.permission_package_id != null &&
        form.designation.trim() &&
        form.employment_type.trim() &&
        form.salary_type.trim() &&
        form.shift_start.trim() &&
        form.shift_end.trim() &&
        form.effective_from.trim() &&
        Number.isFinite(baseAmt) &&
        baseAmt > 0,
    );
  }, [
    channel,
    email,
    form.base_amount,
    form.designation,
    form.effective_from,
    form.employment_type,
    form.name,
    form.permission_package_id,
    form.salary_type,
    form.shift_end,
    form.shift_start,
    otp,
    phoneCombined.length,
    phoneNational,
  ]);

  const handleCreate = useCallback(async () => {
    if (companyId == null) {
      return;
    }
    const errors = validateCreateEmployeeForm(form, {
      name: t('home.createEmployee.errors.name'),
      permissionPackage: t('home.createEmployee.errors.permissionPackage'),
      designation: t('home.createEmployee.errors.designation'),
      employmentType: t('home.createEmployee.errors.employmentType'),
      salaryType: t('home.createEmployee.errors.salaryType'),
      baseAmount: t('home.createEmployee.errors.baseAmount'),
      effectiveFrom: t('home.createEmployee.errors.effectiveFrom'),
      shiftStart: t('home.createEmployee.errors.shiftStart'),
      shiftEnd: t('home.createEmployee.errors.shiftEnd'),
    });
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      setStep(2);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!otpSent) {
      setContactError(t('home.createEmployee.errors.otpRequired'));
      setStep(1);
      return;
    }
    if (otp.trim().length !== OTP_LENGTH) {
      setContactError(t('home.createEmployee.errors.otpIncomplete'));
      return;
    }

    setContactError(null);
    setCreateLoading(true);
    try {
      const coords = await tryOptionalLocationCoords();
      const payload = buildCreateEmployeePayload({
        signupType: channel === 'email' ? 'email' : 'phone',
        email: email.trim(),
        phone: phoneCombined,
        otp: otp.trim(),
        form,
        coords,
      });

      let res: Awaited<ReturnType<typeof createEmployeeApi.createEmployee>>;
      try {
        res = await createEmployeeApi.createEmployee(companyId, payload);
      } catch (err) {
        if (!axios.isAxiosError(err) || err.response?.status !== 500) {
          throw err;
        }

        const employeeOnlyPayload = buildCreateEmployeePayload({
          signupType: channel === 'email' ? 'email' : 'phone',
          email: email.trim(),
          phone: phoneCombined,
          otp: otp.trim(),
          form,
          coords,
          includeSalary: false,
        });
        res = await createEmployeeApi.createEmployee(
          companyId,
          employeeOnlyPayload,
        );
      }
      if (!res.success) {
        presentError({
          title: t('home.createEmployee.errors.createFailedTitle'),
          message:
            res.message?.trim() || t('home.createEmployee.errors.createFailed'),
        });
        return;
      }
      presentSuccess({
        title: t('home.createEmployee.successTitle'),
        message:
          res.message?.trim() || t('home.createEmployee.successMessage'),
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
    channel,
    companyId,
    email,
    form,
    navigation,
    otp,
    otpSent,
    phoneCombined,
    presentError,
    presentSuccess,
    t,
  ]);

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

  const selectedSalaryPkg = salaryPackages.find(
    p => String(p.id) === String(form.component_package_id),
  );

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      {/* Header */}
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
      <View style={styles.stepIndicator} accessibilityRole="header">
        {[1, 2, 3].map(item => (
          <View
            key={item}
            style={[
              styles.stepIndicatorItem,
              item === step && styles.stepIndicatorItemActive,
              item < step && styles.stepIndicatorItemDone,
            ]}
          >
            <Text
              style={[
                styles.stepIndicatorText,
                (item === step || item < step) &&
                  styles.stepIndicatorTextActive,
              ]}
            >
              {item}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 1. Contact Verification Section ─── */}
        <View
          style={[
            styles.cardSection,
            step !== 1 && step !== 3 && styles.stepHidden,
          ]}
        >
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons
              name="account-check-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.cardTitle}>
              {t('home.createEmployee.contactTitle')}
            </Text>
          </View>

          {otpSent && step === 3 ? (
            <View style={styles.otpSentContainer}>
              <View style={styles.otpBadgeRow}>
                <View style={styles.otpBadgeInfo}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={18}
                    color="#16a34a"
                  />
                  <View style={styles.otpBadgeTexts}>
                    <Text style={styles.otpBadgeTitle}>
                      {t('home.createEmployee.otpSentBadge', {
                        contact: verifiedIdentifier,
                      })}
                    </Text>
                    <Text style={styles.otpBadgeSubtitle}>
                      {t('home.createEmployee.otpHelperText')}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleChangeContact}
                  style={styles.changeBtn}
                >
                  <Text style={styles.changeBtnText}>
                    {t('home.createEmployee.changeContact')}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>
                {t('home.createEmployee.otpLabel')} *
              </Text>
              <TextInput
                value={otp}
                onChangeText={v => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                style={[styles.input, styles.otpInput]}
              />

              <View style={styles.resendRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={resendLeft > 0 || requestLoading}
                  onPress={handleRequestOtp}
                  style={[
                    styles.resendBtn,
                    (resendLeft > 0 || requestLoading) &&
                      styles.resendBtnDisabled,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="refresh"
                    size={16}
                    color={resendLeft > 0 ? colors.textMuted : colors.primary}
                  />
                  <Text
                    style={[
                      styles.resendText,
                      resendLeft > 0 && styles.resendTextDisabled,
                    ]}
                  >
                    {resendLeft > 0
                      ? t('home.createEmployee.resendIn', { seconds: resendLeft })
                      : t('home.createEmployee.resendOtp')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.channelContainer}>
              <View style={styles.channelRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setChannel('email')}
                  style={[
                    styles.channelBtn,
                    channel === 'email' && styles.channelBtnActive,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={18}
                    color={channel === 'email' ? '#fff' : colors.textMuted}
                  />
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
                  <MaterialCommunityIcons
                    name="phone-outline"
                    size={18}
                    color={channel === 'phone' ? '#fff' : colors.textMuted}
                  />
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
                    {t('home.createEmployee.emailLabel')} *
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
                    {t('home.createEmployee.phoneLabel')} *
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
                      onChangeText={v =>
                        setPhoneNational(v.replace(/\D/g, '').slice(0, 15))
                      }
                      keyboardType="phone-pad"
                      placeholder={t('home.createEmployee.phonePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, styles.phoneInput]}
                    />
                  </View>
                </>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={requestLoading}
                onPress={handleRequestOtp}
                style={({ pressed }) => [
                  styles.sendOtpBtn,
                  requestLoading && styles.primaryBtnDisabled,
                  pressed && !requestLoading && styles.primaryBtnPressed,
                ]}
              >
                {requestLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="send"
                      size={16}
                      color="#fff"
                    />
                    <Text style={styles.sendOtpBtnText}>
                      {t('home.createEmployee.sendOtp')}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {contactError ? (
            <View style={styles.bannerError}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={18}
                color={colors.danger}
              />
              <Text style={styles.bannerErrorText}>{contactError}</Text>
            </View>
          ) : null}
        </View>

        {/* ─── The Rest of the Form (Unlocked when OTP Sent or filled) ─── */}
        {otpSent && step === 2 && (
          <>
            {/* ─── Onboarding Package (Quick Fill) ─── */}
            <View style={styles.onboardingCard}>
              <View style={styles.onboardingHeader}>
                <MaterialCommunityIcons
                  name="lightning-bolt"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.onboardingTitle}>
                  {t('home.createEmployee.onboardingPackage')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDropdownField('onboarding_package')}
                style={styles.selectBtn}
              >
                <Text style={styles.selectBtnPlaceholder}>
                  {t('home.createEmployee.onboardingPackagePlaceholder')}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            {/* ─── 2. Employee Details Section ─── */}
            <View style={[styles.cardSection, step !== 2 && styles.stepHidden]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons
                  name="account-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.cardTitle}>
                  {t('home.createEmployee.stepDetails')}
                </Text>
              </View>

              {/* Employee Name */}
              <Text style={styles.fieldLabel}>
                {t('home.createEmployee.nameLabel')} *
              </Text>
              <TextInput
                value={form.name}
                onChangeText={v => setForm(f => ({ ...f, name: v }))}
                placeholder={t('home.createEmployee.namePlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, formErrors.name && styles.inputError]}
              />
              {formErrors.name ? (
                <Text style={styles.errorText}>{formErrors.name}</Text>
              ) : null}

              {/* Designation */}
              <Text style={styles.fieldLabel}>
                {t('home.invitePackages.formModal.designation')} *
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDropdownField('designation')}
                style={[
                  styles.selectBtn,
                  formErrors.designation && styles.inputError,
                ]}
              >
                <Text
                  style={[
                    styles.selectBtnText,
                    !form.designation && styles.selectBtnPlaceholder,
                  ]}
                >
                  {constants?.designations.find(
                    o => o.value === form.designation,
                  )?.label ||
                    form.designation ||
                    t('home.invitePackages.formModal.selectDesignation')}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
              {formErrors.designation ? (
                <Text style={styles.errorText}>{formErrors.designation}</Text>
              ) : null}

              {/* Permission Package */}
              <Text style={styles.fieldLabel}>
                {t('home.invitePackages.formModal.permissionPackage')} *
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDropdownField('permission_package')}
                style={[
                  styles.selectBtn,
                  formErrors.permission_package_id && styles.inputError,
                ]}
              >
                <Text
                  style={[
                    styles.selectBtnText,
                    form.permission_package_id == null &&
                      styles.selectBtnPlaceholder,
                  ]}
                >
                  {permissionPackages.find(
                    p => p.id === form.permission_package_id,
                  )?.name ||
                    t('home.invitePackages.formModal.selectPackage')}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
              {formErrors.permission_package_id ? (
                <Text style={styles.errorText}>
                  {formErrors.permission_package_id}
                </Text>
              ) : null}

              {/* Employment Type */}
              <Text style={styles.fieldLabel}>
                {t('home.invitePackages.formModal.employmentType')} *
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDropdownField('employment_type')}
                style={[
                  styles.selectBtn,
                  formErrors.employment_type && styles.inputError,
                ]}
              >
                <Text
                  style={[
                    styles.selectBtnText,
                    !form.employment_type && styles.selectBtnPlaceholder,
                  ]}
                >
                  {constants?.employment_types.find(
                    o => o.value === form.employment_type,
                  )?.label ||
                    form.employment_type ||
                    t('home.invitePackages.formModal.selectEmploymentType')}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
              {formErrors.employment_type ? (
                <Text style={styles.errorText}>{formErrors.employment_type}</Text>
              ) : null}

              {/* Salary Type */}
              <Text style={styles.fieldLabel}>
                {t('home.invitePackages.formModal.salaryType')} *
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDropdownField('salary_type')}
                style={[
                  styles.selectBtn,
                  formErrors.salary_type && styles.inputError,
                ]}
              >
                <Text
                  style={[
                    styles.selectBtnText,
                    !form.salary_type && styles.selectBtnPlaceholder,
                  ]}
                >
                  {constants?.salary_types.find(
                    o => o.value === form.salary_type,
                  )?.label ||
                    form.salary_type ||
                    t('home.invitePackages.formModal.selectSalaryType')}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
              {formErrors.salary_type ? (
                <Text style={styles.errorText}>{formErrors.salary_type}</Text>
              ) : null}

              {/* Joining Date */}
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
            </View>

            {/* ─── 3. Work Schedule Section ─── */}
            <View style={[styles.cardSection, step !== 2 && styles.stepHidden]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.cardTitle}>
                  {t('home.invitePackages.formModal.scheduleTimings')}
                </Text>
              </View>

              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.fieldLabel}>
                    {t('home.invitePackages.formModal.shiftStart')} *
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
                    {t('home.invitePackages.formModal.shiftEnd')} *
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

              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
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
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
                <View style={styles.timeCol}>
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
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

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
            </View>

            {/* ─── 4. Salary Details Section ─── */}
            <View style={[styles.cardSection, step !== 2 && styles.stepHidden]}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons
                  name="cash-multiple"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.cardTitle}>
                  {t('home.createEmployee.salaryComponents')}
                </Text>
              </View>

              {/* Effective From & Effective To */}
              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.fieldLabel}>
                    {t('home.createEmployee.effectiveFrom')} *
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setEffectiveFromPickerVisible(true)}
                    style={[
                      styles.selectBtn,
                      formErrors.effective_from && styles.inputError,
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectBtnText,
                        !form.effective_from && styles.selectBtnPlaceholder,
                      ]}
                    >
                      {form.effective_from ||
                        t('home.createEmployee.effectiveFromPlaceholder')}
                    </Text>
                    <MaterialCommunityIcons
                      name="calendar"
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                  {formErrors.effective_from ? (
                    <Text style={styles.errorText}>
                      {formErrors.effective_from}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.timeCol}>
                  <Text style={styles.fieldLabel}>
                    {t('home.createEmployee.effectiveTo')}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setEffectiveToPickerVisible(true)}
                    style={styles.selectBtn}
                  >
                    <Text
                      style={[
                        styles.selectBtnText,
                        !form.effective_to && styles.selectBtnPlaceholder,
                      ]}
                    >
                      {form.effective_to ||
                        t('home.createEmployee.effectiveToPlaceholder')}
                    </Text>
                    <MaterialCommunityIcons
                      name="calendar"
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Salary Package (Quick Fill) */}
              <Text style={styles.fieldLabel}>
                {t('home.createEmployee.salaryPackage')}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDropdownField('salary_package')}
                style={styles.selectBtn}
              >
                <Text
                  style={[
                    styles.selectBtnText,
                    !selectedSalaryPkg && styles.selectBtnPlaceholder,
                  ]}
                >
                  {selectedSalaryPkg
                    ? `${selectedSalaryPkg.name} (${selectedSalaryPkg.code})`
                    : t('home.createEmployee.salaryPackagePlaceholder')}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>

              {/* Base Amount */}
              <Text style={styles.fieldLabel}>
                {t('home.createEmployee.baseAmount')} *
              </Text>
              <TextInput
                value={form.base_amount}
                onChangeText={v => setForm(f => ({ ...f, base_amount: v }))}
                placeholder={t('home.createEmployee.baseAmountPlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  formErrors.base_amount && styles.inputError,
                ]}
              />
              {formErrors.base_amount ? (
                <Text style={styles.errorText}>{formErrors.base_amount}</Text>
              ) : null}

              {/* Salary Components List */}
              <View style={styles.componentsHeaderRow}>
                <Text style={styles.fieldLabelBold}>
                  {t('home.createEmployee.salaryComponents')}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAddComponentVisible(true)}
                  style={styles.addComponentBtn}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.addComponentBtnText}>
                    {t('home.createEmployee.addComponent')}
                  </Text>
                </Pressable>
              </View>

              {form.components.length === 0 ? (
                <View style={styles.emptyComponentsBox}>
                  <Text style={styles.emptyComponentsText}>
                    {t('home.createEmployee.noComponents')}
                  </Text>
                </View>
              ) : (
                <View style={styles.componentsList}>
                  {form.components.map((comp, idx) => {
                    const cData = availableComponents.find(
                      c => c.id === comp.component_id,
                    );
                    const compTitle =
                      cData?.name || `Component #${comp.component_id}`;
                    const compCode = cData?.code || '';

                    return (
                      <View key={idx} style={styles.componentCard}>
                        <View style={styles.componentCardTop}>
                          <View style={styles.componentNameBox}>
                            <Text style={styles.componentNameText}>
                              {compTitle}
                            </Text>
                            {compCode ? (
                              <Text style={styles.componentCodeText}>
                                ({compCode})
                              </Text>
                            ) : null}
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => handleRemoveComponent(idx)}
                            style={styles.componentDeleteBtn}
                          >
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={18}
                              color={colors.danger}
                            />
                          </Pressable>
                        </View>

                        <View style={styles.componentFieldsRow}>
                          <View style={styles.componentTypeCol}>
                            <Text style={styles.subFieldLabel}>
                              {t('home.createEmployee.calcType')}
                            </Text>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => {
                                const nextType =
                                  comp.calc_type === 'percentage'
                                    ? 'fixed'
                                    : 'percentage';
                                handleUpdateComponent(idx, 'calc_type', nextType);
                              }}
                              style={styles.typeToggleBtn}
                            >
                              <Text style={styles.typeToggleText}>
                                {comp.calc_type === 'percentage'
                                  ? t('home.createEmployee.percentage')
                                  : t('home.createEmployee.fixed')}
                              </Text>
                              <MaterialCommunityIcons
                                name="swap-horizontal"
                                size={14}
                                color={colors.primary}
                              />
                            </Pressable>
                          </View>

                          <View style={styles.componentValCol}>
                            <Text style={styles.subFieldLabel}>
                              {t('home.createEmployee.calcValue')}
                            </Text>
                            <TextInput
                              value={comp.calc_value}
                              onChangeText={v =>
                                handleUpdateComponent(
                                  idx,
                                  'calc_value',
                                  v.replace(/[^0-9.]/g, ''),
                                )
                              }
                              placeholder="0"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="decimal-pad"
                              style={styles.componentValInput}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        {constantsLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.sectionHint}>
              {t('home.invitePackages.formModal.loadingConstants')}
            </Text>
          </View>
        )}

        {step === 2 ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleContinueToOtp}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>
              {t('home.createEmployee.continueToOtp')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* ─── Bottom Action Bar ─── */}
      {otpSent && step === 3 && (
        <View style={styles.bottomBar}>
          <Pressable
            accessibilityRole="button"
            disabled={createLoading || !isFormValid}
            onPress={handleCreate}
            style={({ pressed }) => [
              styles.primaryBtn,
              (!isFormValid || createLoading) && styles.primaryBtnDisabled,
              pressed && isFormValid && !createLoading && styles.primaryBtnPressed,
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
        </View>
      )}

      {/* ─── Universal Dropdown Modal Sheet ─── */}
      <Modal
        visible={dropdownField != null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setDropdownField(null)}
      >
        <SafeAreaView
          style={styles.dropdownSafe}
          edges={TAB_SCREEN_SAFE_AREA_EDGES}
        >
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
                    <View style={styles.fill}>
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          active && styles.dropdownOptionTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.subtitle ? (
                        <Text style={styles.dropdownOptionSubtitle}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {active ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color={colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* ─── Add Component Modal ─── */}
      <Modal
        visible={addComponentVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setAddComponentVisible(false)}
      >
        <SafeAreaView
          style={styles.dropdownSafe}
          edges={TAB_SCREEN_SAFE_AREA_EDGES}
        >
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={() => setAddComponentVisible(false)}
          />
          <View style={styles.dropdownSheet}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>
                {t('home.createEmployee.addComponent')}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAddComponentVisible(false)}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <View style={styles.addComponentForm}>
              {/* Select Component */}
              <Text style={styles.fieldLabel}>
                {t('home.createEmployee.selectComponent')} *
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDropdownField('new_component_select')}
                style={styles.selectBtn}
              >
                <Text
                  style={[
                    styles.selectBtnText,
                    !newComponentId && styles.selectBtnPlaceholder,
                  ]}
                >
                  {availableComponents.find(c => c.id === newComponentId)
                    ?.name || t('home.createEmployee.selectComponent')}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>

              {/* Calculation Type */}
              <Text style={styles.fieldLabel}>
                {t('home.createEmployee.calcType')} *
              </Text>
              <View style={styles.channelRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setNewComponentCalcType('percentage')}
                  style={[
                    styles.channelBtn,
                    newComponentCalcType === 'percentage' &&
                      styles.channelBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.channelBtnText,
                      newComponentCalcType === 'percentage' &&
                        styles.channelBtnTextActive,
                    ]}
                  >
                    {t('home.createEmployee.percentage')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setNewComponentCalcType('fixed')}
                  style={[
                    styles.channelBtn,
                    newComponentCalcType === 'fixed' &&
                      styles.channelBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.channelBtnText,
                      newComponentCalcType === 'fixed' &&
                        styles.channelBtnTextActive,
                    ]}
                  >
                    {t('home.createEmployee.fixed')}
                  </Text>
                </Pressable>
              </View>

              {/* Calculation Value */}
              <Text style={styles.fieldLabel}>
                {t('home.createEmployee.calcValue')} *
              </Text>
              <TextInput
                value={newComponentValue}
                onChangeText={v =>
                  setNewComponentValue(v.replace(/[^0-9.]/g, ''))
                }
                placeholder="e.g. 10 or 2500"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={styles.input}
              />

              {/* Remark / Reason */}
              <Text style={styles.fieldLabel}>
                {t('home.createEmployee.reason')}
              </Text>
              <TextInput
                value={newComponentReason}
                onChangeText={setNewComponentReason}
                placeholder="Optional remark"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <Pressable
                accessibilityRole="button"
                disabled={!newComponentId || !newComponentValue}
                onPress={handleAddComponentConfirm}
                style={[
                  styles.primaryBtn,
                  (!newComponentId || !newComponentValue) &&
                    styles.primaryBtnDisabled,
                  styles.addComponentConfirmBtn,
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {t('home.createEmployee.addComponent')}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ─── Helpers: Country, Date, Time & Alerts ─── */}
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
      <DatePicker
        visible={effectiveFromPickerVisible}
        value={form.effective_from || todayIso()}
        title={t('home.createEmployee.effectiveFrom')}
        onDismiss={() => setEffectiveFromPickerVisible(false)}
        onConfirm={date => {
          setForm(f => ({ ...f, effective_from: date }));
          setEffectiveFromPickerVisible(false);
        }}
      />
      <DatePicker
        visible={effectiveToPickerVisible}
        value={form.effective_to || todayIso()}
        title={t('home.createEmployee.effectiveTo')}
        onDismiss={() => setEffectiveToPickerVisible(false)}
        onConfirm={date => {
          setForm(f => ({ ...f, effective_to: date }));
          setEffectiveToPickerVisible(false);
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
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 10,
      backgroundColor: colors.surface,
    },
    stepIndicatorItem: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepIndicatorItemActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    stepIndicatorItemDone: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      opacity: 0.75,
    },
    stepIndicatorText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    stepIndicatorTextActive: {
      color: '#fff',
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    cardSection: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: dark ? 0.2 : 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    onboardingCard: {
      backgroundColor: dark ? 'rgba(79, 70, 229, 0.1)' : '#eef2ff',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: dark ? 'rgba(99, 102, 241, 0.3)' : '#c7d2fe',
      padding: 14,
      marginBottom: 16,
    },
    onboardingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    onboardingTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: dark ? '#a5b4fc' : '#4338ca',
    },
    channelContainer: {
      marginTop: 4,
    },
    channelRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    stepHidden: {
      display: 'none',
    },
    channelBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    channelBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    channelBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    channelBtnTextActive: {
      color: '#fff',
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
      marginTop: 10,
    },
    fieldLabelBold: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    subFieldLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
    },
    inputError: {
      borderColor: colors.danger,
    },
    errorText: {
      fontSize: 12,
      color: colors.danger,
      marginTop: 4,
    },
    phoneRow: {
      flexDirection: 'row',
      gap: 8,
    },
    countryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.background,
      gap: 4,
    },
    countryDial: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    phoneInput: {
      flex: 1,
    },
    sendOtpBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 10,
      marginTop: 14,
    },
    sendOtpBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    otpSentContainer: {
      marginTop: 4,
    },
    otpBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: dark ? 'rgba(22, 163, 74, 0.12)' : '#f0fdf4',
      borderWidth: 1,
      borderColor: dark ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0',
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    },
    otpBadgeInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      flex: 1,
      marginRight: 8,
    },
    otpBadgeTexts: {
      flex: 1,
    },
    otpBadgeTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: dark ? '#86efac' : '#15803d',
    },
    otpBadgeSubtitle: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    changeBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    changeBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    otpInput: {
      fontSize: 18,
      letterSpacing: 4,
      fontWeight: '700',
      textAlign: 'center',
    },
    resendRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 8,
    },
    resendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
    },
    resendBtnDisabled: {
      opacity: 0.6,
    },
    resendText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    resendTextDisabled: {
      color: colors.textMuted,
    },
    selectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 11,
      backgroundColor: colors.background,
    },
    selectBtnText: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    selectBtnPlaceholder: {
      fontSize: 14,
      color: colors.textMuted,
      flex: 1,
      marginRight: 8,
    },
    timeRow: {
      flexDirection: 'row',
      gap: 12,
    },
    timeCol: {
      flex: 1,
    },
    weekendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    weekendChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    weekendChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    weekendChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    weekendChipTextActive: {
      color: '#fff',
    },
    componentsHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      marginBottom: 8,
    },
    addComponentBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: dark ? 'rgba(79,70,229,0.15)' : '#eef2ff',
      borderWidth: 1,
      borderColor: dark ? 'rgba(99,102,241,0.3)' : '#c7d2fe',
    },
    addComponentBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    emptyComponentsBox: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyComponentsText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    componentsList: {
      gap: 10,
    },
    componentCard: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
    },
    componentCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    componentNameBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      marginRight: 8,
    },
    componentNameText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    componentCodeText: {
      fontSize: 12,
      color: colors.textMuted,
    },
    componentDeleteBtn: {
      padding: 4,
    },
    componentFieldsRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    componentTypeCol: {
      flex: 1,
    },
    typeToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    typeToggleText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    componentValCol: {
      flex: 1,
    },
    componentValInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: colors.surface,
    },
    bannerError: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: dark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
      borderWidth: 1,
      borderColor: dark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
      borderRadius: 10,
      padding: 10,
      marginTop: 10,
    },
    bannerErrorText: {
      fontSize: 13,
      color: colors.danger,
      flex: 1,
    },
    bottomBar: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnDisabled: {
      opacity: 0.5,
    },
    primaryBtnPressed: {
      opacity: 0.85,
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
    loadingBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    sectionHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 8,
      textAlign: 'center',
    },
    dropdownSafe: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    dropdownBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    dropdownSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '75%',
      paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    },
    dropdownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dropdownTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    dropdownOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dropdownOptionActive: {
      backgroundColor: dark ? 'rgba(79, 70, 229, 0.12)' : '#eef2ff',
    },
    dropdownOptionText: {
      fontSize: 15,
      color: colors.text,
    },
    dropdownOptionTextActive: {
      fontWeight: '700',
      color: colors.primary,
    },
    dropdownOptionSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    addComponentForm: {
      padding: 16,
    },
    addComponentConfirmBtn: {
      marginTop: 20,
    },
  });
}
