import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type { CompanyListItem } from '@src/types/companyList';
import type { UpdateCompanyPayload } from '@src/types/updateCompany';
import type { UploadableFile } from '@src/utils/FileUpload';
import { uploadFileToOneSaas } from '@src/utils/FileUpload';
import { readApiError } from '@src/utils/readApiError';
import {
  ATTENDANCE_METHOD_OPTIONS,
  buildUpdateCompanyPayload,
  companyToFormState,
  validateUpdateCompanyForm,
  type UpdateCompanyFormState,
} from '@src/utils/updateCompanyForm';
import { API_ENDPOINT } from '@src/utils/config';

const T = 'home.companyList.updateModal.';
const MIN_SHEET_HEIGHT = 280;
const KEYBOARD_GAP = 8;

function resolveLogoUrl(path: string | null): string | null {
  if (path == null || path.trim() === '') {
    return null;
  }
  const p = path.trim();
  if (p.startsWith('http://') || p.startsWith('https://')) {
    return p;
  }
  return `${API_ENDPOINT}${p.startsWith('/') ? '' : '/'}${p}`;
}

function resolveSheetLayout(
  windowHeight: number,
  keyboardHeight: number,
  topInset: number,
): { wrapStyle: ViewStyle; sheetHeight?: number; sheetMaxHeight: number } {
  const keyboardOpen = keyboardHeight > 0;
  const sheetMaxHeight = Math.min(windowHeight * 0.92, windowHeight - topInset - 24);

  if (keyboardOpen) {
    const available = windowHeight - keyboardHeight - KEYBOARD_GAP - topInset;
    const sheetHeight = Math.max(MIN_SHEET_HEIGHT, Math.min(sheetMaxHeight, available));
    return {
      wrapStyle: { justifyContent: 'flex-end', paddingTop: 24, paddingBottom: keyboardHeight },
      sheetHeight,
      sheetMaxHeight,
    };
  }

  return {
    wrapStyle: { justifyContent: 'flex-end', paddingTop: 48, paddingBottom: 0 },
    sheetMaxHeight,
  };
}

export type UpdateCompanyModalProps = {
  visible: boolean;
  company: CompanyListItem | null;
  submitting: boolean;
  onDismiss: () => void;
  onSubmit: (payload: UpdateCompanyPayload) => void;
};

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const cardBg = scheme === 'dark' ? colors.background : '#f8fafc';
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.overlay },
    backdrop: { ...StyleSheet.absoluteFill },
    sheetWrap: { flex: 1 },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      flexDirection: 'column',
      overflow: 'hidden',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 8,
    },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    scroll: { flexGrow: 0, flexShrink: 1 },
    scrollKeyboardOpen: { flex: 1, minHeight: 0 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 4,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: cardBg,
      marginBottom: 12,
    },
    inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    logoPreview: {
      width: 64,
      height: 64,
      borderRadius: 12,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoImg: { width: '100%', height: '100%' },
    logoActions: { flex: 1, gap: 8 },
    logoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 10,
      backgroundColor: cardBg,
    },
    logoBtnLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: cardBg,
    },
    chipSelected: { borderColor: colors.primary, backgroundColor: `${colors.primary}18` },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
    chipTextSelected: { color: colors.primary },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      marginBottom: 8,
    },
    switchLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, marginRight: 12 },
    error: { fontSize: 12, color: colors.danger, marginBottom: 8 },
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    btnSecondary: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    btnPrimary: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    btnSecondaryLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    btnPrimaryLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
    btnDisabled: { opacity: 0.55 },
  });
}

export function UpdateCompanyModal({
  visible,
  company,
  submitting,
  onDismiss,
  onSubmit,
}: UpdateCompanyModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [form, setForm] = useState<UpdateCompanyFormState | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<UploadableFile | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoPickSeqRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const wasVisibleRef = useRef(false);

  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const layout = useMemo(
    () => resolveSheetLayout(windowHeight, keyboardHeight, insets.top),
    [insets.top, keyboardHeight, windowHeight],
  );

  const sheetSizeStyle = useMemo(
    (): ViewStyle => ({
      maxHeight: layout.sheetMaxHeight,
      ...(layout.sheetHeight != null ? { height: layout.sheetHeight } : null),
    }),
    [layout.sheetHeight, layout.sheetMaxHeight],
  );

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    if (wasVisibleRef.current || !company) {
      return;
    }
    wasVisibleRef.current = true;
    setForm(companyToFormState(company));
    setPendingLogoFile(null);
    setLogoUploading(false);
    logoPickSeqRef.current += 1;
    setError(null);
  }, [visible, company]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const patchForm = useCallback((patch: Partial<UpdateCompanyFormState>) => {
    setForm(prev => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const toggleMethod = useCallback((method: (typeof ATTENDANCE_METHOD_OPTIONS)[number]) => {
    setForm(prev => {
      if (!prev) {
        return prev;
      }
      const has = prev.attendanceMethods.includes(method);
      const attendanceMethods = has
        ? prev.attendanceMethods.filter(m => m !== method)
        : [...prev.attendanceMethods, method];
      return { ...prev, attendanceMethods };
    });
  }, []);

  const chooseLogo = useCallback(async () => {
    setError(null);
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });
    if (result.didCancel || !result.assets?.length) {
      return;
    }
    const asset = result.assets[0];
    const uri = asset.uri;
    if (!uri) {
      return;
    }
    const file: UploadableFile = {
      uri,
      mimeType: asset.type?.trim() || 'image/jpeg',
      fileName: asset.fileName?.trim() || `company-logo-${Date.now()}.jpg`,
    };
    const seq = ++logoPickSeqRef.current;
    setPendingLogoFile(file);
    setLogoUploading(true);
    try {
      const url = await uploadFileToOneSaas(file);
      if (logoPickSeqRef.current !== seq) {
        return;
      }
      patchForm({ newLogoUrl: url });
      setPendingLogoFile(null);
    } catch (err) {
      if (logoPickSeqRef.current !== seq) {
        return;
      }
      setError(readApiError(err));
    } finally {
      if (logoPickSeqRef.current === seq) {
        setLogoUploading(false);
      }
    }
  }, [patchForm]);

  const logoPreviewUri = useMemo(() => {
    if (form?.newLogoUrl?.trim()) {
      return form.newLogoUrl.trim();
    }
    if (pendingLogoFile?.uri) {
      return pendingLogoFile.uri;
    }
    if (company) {
      return resolveLogoUrl(company.logo_url);
    }
    return null;
  }, [company, form?.newLogoUrl, pendingLogoFile]);

  const handleSubmit = useCallback(() => {
    if (!company || !form) {
      return;
    }
    const validation = validateUpdateCompanyForm(
      form,
      logoUploading,
      pendingLogoFile != null,
    );
    if (!validation.ok) {
      setError(
        t(validation.errorKey, validation.errorParams as Record<string, string> | undefined),
      );
      return;
    }
    const payload = buildUpdateCompanyPayload(company, form);
    if (!payload) {
      setError(t(`${T}errors.noChanges`));
      return;
    }
    setError(null);
    onSubmit(payload);
  }, [company, form, logoUploading, onSubmit, pendingLogoFile, t]);

  if (!visible || !company || !form) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t('modals.common.closeDialog')}
          onPress={onDismiss}
        />
        <View style={[styles.sheetWrap, layout.wrapStyle]} pointerEvents="box-none">
          <View style={[styles.sheet, sheetSizeStyle]} accessibilityViewIsModal>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{t(`${T}title`)}</Text>
              <Text style={styles.subtitle}>{company.name}</Text>
            </View>

            <ScrollView
              ref={scrollRef}
              style={[styles.scroll, keyboardHeight > 0 && styles.scrollKeyboardOpen]}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: Math.max(16, insets.bottom) },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={keyboardHeight > 0}
              bounces={false}>
              <Text style={styles.sectionLabel}>{t(`${T}sections.profile`)}</Text>
              <View style={styles.logoRow}>
                <View style={styles.logoPreview}>
                  {logoPreviewUri ? (
                    <Image
                      source={{ uri: logoPreviewUri }}
                      style={styles.logoImg}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="office-building-outline"
                      size={28}
                      color={colors.textMuted}
                    />
                  )}
                </View>
                <View style={styles.logoActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={logoUploading || submitting}
                    onPress={() => {
                      chooseLogo().catch(() => {});
                    }}
                    style={styles.logoBtn}>
                    {logoUploading ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="image-edit-outline" size={18} color={colors.primary} />
                        <Text style={styles.logoBtnLabel}>{t(`${T}changeLogo`)}</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>

              <Text style={styles.label}>{t(`${T}nameLabel`)}</Text>
              <TextInput
                value={form.name}
                onChangeText={value => patchForm({ name: value })}
                maxLength={255}
                placeholder={t(`${T}namePlaceholder`)}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <Text style={styles.label}>{t(`${T}legalNameLabel`)}</Text>
              <TextInput
                value={form.legalName}
                onChangeText={value => patchForm({ legalName: value })}
                placeholder={t(`${T}legalNamePlaceholder`)}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t(`${T}isActiveLabel`)}</Text>
                <Switch
                  value={form.isActive}
                  onValueChange={value => patchForm({ isActive: value })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={styles.sectionLabel}>{t(`${T}sections.address`)}</Text>
              <Text style={styles.label}>{t(`${T}addressLine1Label`)}</Text>
              <TextInput
                value={form.addressLine1}
                onChangeText={value => patchForm({ addressLine1: value })}
                onFocus={scrollToEnd}
                style={styles.input}
              />
              <Text style={styles.label}>{t(`${T}addressLine2Label`)}</Text>
              <TextInput
                value={form.addressLine2}
                onChangeText={value => patchForm({ addressLine2: value })}
                onFocus={scrollToEnd}
                style={styles.input}
              />
              <Text style={styles.label}>{t(`${T}cityLabel`)}</Text>
              <TextInput
                value={form.city}
                onChangeText={value => patchForm({ city: value })}
                onFocus={scrollToEnd}
                style={styles.input}
              />
              <Text style={styles.label}>{t(`${T}stateLabel`)}</Text>
              <TextInput
                value={form.state}
                onChangeText={value => patchForm({ state: value })}
                onFocus={scrollToEnd}
                style={styles.input}
              />
              <Text style={styles.label}>{t(`${T}postalCodeLabel`)}</Text>
              <TextInput
                value={form.postalCode}
                onChangeText={value => patchForm({ postalCode: value })}
                onFocus={scrollToEnd}
                style={styles.input}
              />
              <Text style={styles.label}>{t(`${T}countryLabel`)}</Text>
              <TextInput
                value={form.country}
                onChangeText={value => patchForm({ country: value })}
                onFocus={scrollToEnd}
                style={styles.input}
              />
              <Text style={styles.label}>{t(`${T}latitudeLabel`)}</Text>
              <TextInput
                value={form.latitude}
                onChangeText={value => patchForm({ latitude: value })}
                onFocus={scrollToEnd}
                keyboardType="decimal-pad"
                style={styles.input}
              />
              <Text style={styles.label}>{t(`${T}longitudeLabel`)}</Text>
              <TextInput
                value={form.longitude}
                onChangeText={value => patchForm({ longitude: value })}
                onFocus={scrollToEnd}
                keyboardType="decimal-pad"
                style={styles.input}
              />

              <Text style={styles.sectionLabel}>{t(`${T}sections.settings`)}</Text>
              <Text style={styles.label}>{t(`${T}currencyLabel`)}</Text>
              <TextInput
                value={form.transactionCurrency}
                onChangeText={value => patchForm({ transactionCurrency: value })}
                onFocus={scrollToEnd}
                autoCapitalize="characters"
                style={styles.input}
              />
              <Text style={styles.label}>{t(`${T}maxDistanceLabel`)}</Text>
              <TextInput
                value={form.maxDistance}
                onChangeText={value => patchForm({ maxDistance: value })}
                onFocus={scrollToEnd}
                keyboardType="number-pad"
                placeholder={t(`${T}maxDistancePlaceholder`)}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <Text style={styles.label}>{t(`${T}methodsLabel`)}</Text>
              <View style={styles.chipRow}>
                {ATTENDANCE_METHOD_OPTIONS.map(method => {
                  const selected = form.attendanceMethods.includes(method);
                  return (
                    <Pressable
                      key={method}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => toggleMethod(method)}
                      style={[styles.chip, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {t(`${T}methods.${method}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>{t(`${T}companyIpsLabel`)}</Text>
              <TextInput
                value={form.companyIps}
                onChangeText={value => patchForm({ companyIps: value, clearIps: false })}
                onFocus={scrollToEnd}
                editable={!form.clearIps}
                multiline
                placeholder={t(`${T}companyIpsPlaceholder`)}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.inputMultiline]}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t(`${T}clearIpsLabel`)}</Text>
                <Switch
                  value={form.clearIps}
                  onValueChange={value => patchForm({ clearIps: value })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={onDismiss}
                style={[styles.btnSecondary, submitting && styles.btnDisabled]}>
                <Text style={styles.btnSecondaryLabel}>{t(`${T}cancel`)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={submitting || logoUploading}
                onPress={handleSubmit}
                style={[
                  styles.btnPrimary,
                  (submitting || logoUploading) && styles.btnDisabled,
                ]}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryLabel}>{t(`${T}save`)}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
