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
import type { CreateCompanyBody } from '@src/types/createCompany';
import type { UploadableFile } from '@src/utils/FileUpload';
import { uploadFileToOneSaas } from '@src/utils/FileUpload';
import { readApiError } from '@src/utils/readApiError';

const SHEET_HEIGHT_CAP = 520;
const MIN_SHEET_HEIGHT = 300;
const NAME_MAX_LEN = 255;

export type CreateCompanyFormPayload = CreateCompanyBody;

type Props = {
    visible: boolean;
    onDismiss: () => void;
    onSubmit: (payload: CreateCompanyFormPayload) => void | Promise<void>;
};

type SheetLayout = {
    wrapStyle: ViewStyle;
    sheetHeight: number;
};

function trimOrUndefined(value: string): string | undefined {
    const t = value.trim();
    return t.length > 0 ? t : undefined;
}

function resolveSheetLayout(
    windowHeight: number,
    keyboardHeight: number,
    topInset: number,
    bottomInset: number,
): SheetLayout {
    const keyboardOpen = keyboardHeight > 0;
    const topGap = topInset + 8;
    const keyboardGap = 8;

    if (keyboardOpen) {
        const spaceAboveKeyboard = windowHeight - keyboardHeight - keyboardGap;
        const sheetHeight = Math.max(
            MIN_SHEET_HEIGHT,
            Math.min(SHEET_HEIGHT_CAP, spaceAboveKeyboard - topGap),
        );
        return {
            wrapStyle: {
                justifyContent: 'flex-start',
                paddingTop: topGap,
                paddingBottom: 0,
            },
            sheetHeight,
        };
    }

    return {
        wrapStyle: {
            justifyContent: 'center',
            paddingTop: 0,
            paddingBottom: Math.max(bottomInset, 16),
        },
        sheetHeight: Math.min(SHEET_HEIGHT_CAP, Math.max(MIN_SHEET_HEIGHT, windowHeight * 0.78)),
    };
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark', sheetHeight: number) {
    return StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.overlay,
        },
        backdrop: {
            ...StyleSheet.absoluteFill,
        },
        sheetWrap: {
            flex: 1,
            paddingHorizontal: 16,
        },
        sheet: {
            alignSelf: 'center',
            width: '100%',
            maxWidth: 420,
            height: sheetHeight,
            maxHeight: sheetHeight,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        sheetHeader: {
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        sheetScroll: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 12,
        },
        sheetFooter: {
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        fieldLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.textMuted,
            marginBottom: 6,
        },
        requiredMark: {
            color: colors.danger,
        },
        input: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 12 : 10,
            fontSize: 16,
            color: colors.text,
            backgroundColor: colors.background,
            marginBottom: 12,
        },
        inputLast: {
            marginBottom: 8,
        },
        infoHintRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 12,
            paddingHorizontal: 2,
        },
        infoHintIcon: {
            marginTop: 1,
        },
        infoHint: {
            flex: 1,
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 19,
        },
        logoBlock: {
            marginBottom: 14,
        },
        logoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        logoPreview: {
            width: 72,
            height: 72,
            borderRadius: 14,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
        },
        logoPreviewImg: {
            width: '100%',
            height: '100%',
        },
        logoPlaceholderIcon: {
            opacity: 0.45,
        },
        logoActions: {
            flex: 1,
            minWidth: 0,
            gap: 8,
        },
        chooseLogoBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 12,
        },
        chooseLogoBtnPressed: {
            opacity: 0.92,
            backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
        },
        chooseLogoBtnDisabled: {
            opacity: 0.55,
        },
        chooseLogoLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        removeLogoBtn: {
            alignSelf: 'flex-start',
            paddingVertical: 4,
        },
        removeLogoLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.danger,
        },
        errorText: {
            fontSize: 13,
            color: colors.danger,
            marginBottom: 10,
        },
        actions: {
            flexDirection: 'row',
            gap: 10,
        },
        btnSecondary: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            backgroundColor: colors.background,
        },
        btnPrimary: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: colors.primary,
        },
        btnPrimaryDisabled: {
            opacity: 0.55,
        },
        btnSecondaryLabel: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.primary,
        },
        btnPrimaryLabel: {
            fontSize: 16,
            fontWeight: '600',
            color: '#fff',
        },
    });
}

export function CreateCompany({ visible, onDismiss, onSubmit }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const layout = useMemo(
        () => resolveSheetLayout(windowHeight, keyboardHeight, insets.top, insets.bottom),
        [windowHeight, keyboardHeight, insets.top, insets.bottom],
    );

    const styles = useMemo(
        () => buildStyles(colors, resolvedScheme, layout.sheetHeight),
        [colors, resolvedScheme, layout.sheetHeight],
    );

    const scrollRef = useRef<ScrollView>(null);
    const nameFieldY = useRef(0);
    const legalFieldY = useRef(0);
    const focusedFieldRef = useRef<'name' | 'legal' | null>(null);

    const [name, setName] = useState('');
    const [legalName, setLegalName] = useState('');
    const [pendingLogoFile, setPendingLogoFile] = useState<UploadableFile | null>(null);
    const [logoUploadedUrl, setLogoUploadedUrl] = useState<string | null>(null);
    const [logoUploading, setLogoUploading] = useState(false);
    const logoPickSeqRef = useRef(0);
    const [formError, setFormError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const scrollToField = useCallback((y: number) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    }, []);

    useEffect(() => {
        if (!visible) {
            setKeyboardHeight(0);
            return;
        }

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, event => {
            setKeyboardHeight(event.endCoordinates.height);
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
            focusedFieldRef.current = null;
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [visible]);

    useEffect(() => {
        if (keyboardHeight <= 0 || focusedFieldRef.current == null) {
            return;
        }
        const y =
            focusedFieldRef.current === 'legal' ? legalFieldY.current : nameFieldY.current;
        const id = requestAnimationFrame(() => scrollToField(y));
        return () => cancelAnimationFrame(id);
    }, [keyboardHeight, scrollToField]);

    useEffect(() => {
        if (!visible) {
            return;
        }
        setName('');
        setLegalName('');
        setPendingLogoFile(null);
        setLogoUploadedUrl(null);
        setLogoUploading(false);
        logoPickSeqRef.current += 1;
        setFormError(null);
        setSubmitting(false);
        setKeyboardHeight(0);
    }, [visible]);

    const logoPreviewUri = useMemo(() => {
        if (logoUploadedUrl?.trim()) {
            return logoUploadedUrl.trim();
        }
        if (pendingLogoFile?.uri) {
            return pendingLogoFile.uri;
        }
        return null;
    }, [logoUploadedUrl, pendingLogoFile]);

    const chooseLogo = useCallback(async () => {
        setFormError(null);
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
        setLogoUploadedUrl(null);
        setPendingLogoFile(file);
        setLogoUploading(true);
        try {
            const url = await uploadFileToOneSaas(file);
            if (logoPickSeqRef.current !== seq) {
                return;
            }
            setLogoUploadedUrl(url);
            setPendingLogoFile(null);
        } catch (err) {
            if (logoPickSeqRef.current !== seq) {
                return;
            }
            setFormError(readApiError(err));
        } finally {
            if (logoPickSeqRef.current === seq) {
                setLogoUploading(false);
            }
        }
    }, []);

    const clearLogo = useCallback(() => {
        logoPickSeqRef.current += 1;
        setPendingLogoFile(null);
        setLogoUploadedUrl(null);
        setLogoUploading(false);
        setFormError(null);
    }, []);

    const buildPayload = useCallback((): CreateCompanyFormPayload | null => {
        const trimmedName = name.trim();
        if (!trimmedName || trimmedName.length > NAME_MAX_LEN) {
            return null;
        }
        const payload: CreateCompanyFormPayload = { name: trimmedName };
        const legal = trimOrUndefined(legalName);
        if (legal) {
            payload.legal_name = legal;
        }
        const logo = logoUploadedUrl?.trim();
        if (logo) {
            payload.logo_url = logo;
        }
        return payload;
    }, [name, legalName, logoUploadedUrl]);

    const validate = useCallback((): string | null => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            return t('home.companyList.createModal.errors.nameRequired');
        }
        if (trimmedName.length > NAME_MAX_LEN) {
            return t('home.companyList.createModal.errors.nameTooLong');
        }
        if (logoUploading) {
            return t('home.companyList.createModal.errors.logoUploading');
        }
        if (pendingLogoFile && !logoUploadedUrl?.trim()) {
            return t('home.companyList.createModal.errors.logoUploadPending');
        }
        return null;
    }, [name, logoUploading, pendingLogoFile, logoUploadedUrl, t]);

    const createDisabled = useMemo(() => {
        const trimmedName = name.trim();
        if (!trimmedName || trimmedName.length > NAME_MAX_LEN) {
            return true;
        }
        if (submitting || logoUploading) {
            return true;
        }
        if (pendingLogoFile && !logoUploadedUrl?.trim()) {
            return true;
        }
        return false;
    }, [name, submitting, logoUploading, pendingLogoFile, logoUploadedUrl]);

    const handleSubmit = useCallback(() => {
        const err = validate();
        if (err) {
            setFormError(err);
            return;
        }
        const payload = buildPayload();
        if (!payload) {
            setFormError(t('home.companyList.createModal.errors.nameRequired'));
            return;
        }
        setFormError(null);
        setSubmitting(true);
        void Promise.resolve(onSubmit(payload))
            .then(() => {
                onDismiss();
            })
            .catch(() => {
                /* parent handles API errors */
            })
            .finally(() => {
                setSubmitting(false);
            });
    }, [validate, buildPayload, onSubmit, onDismiss, t]);

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onDismiss}>
            <SafeAreaView style={styles.safe} edges={['top', 'right', 'left', 'bottom']}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('home.companyList.createModal.cancel')}
                    style={styles.backdrop}
                    onPress={onDismiss}
                />
                <View style={[styles.sheetWrap, layout.wrapStyle]} pointerEvents="box-none">
                    <View style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.title} accessibilityRole="header">
                                {t('home.companyList.createModal.title')}
                            </Text>
                        </View>

                        <ScrollView
                            ref={scrollRef}
                            style={styles.sheetScroll}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="none"
                            showsVerticalScrollIndicator={false}
                            showsHorizontalScrollIndicator={false}
                            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                            bounces={false}
                            contentContainerStyle={styles.scrollContent}>
                            <View style={styles.logoBlock}>
                                <Text style={styles.fieldLabel}>
                                    {t('home.companyList.createModal.logo')}
                                </Text>
                                <View style={styles.logoRow}>
                                    <View style={styles.logoPreview}>
                                        {logoPreviewUri ? (
                                            <Image
                                                source={{ uri: logoPreviewUri }}
                                                style={styles.logoPreviewImg}
                                                resizeMode="cover"
                                                accessibilityIgnoresInvertColors
                                            />
                                        ) : (
                                            <MaterialCommunityIcons
                                                name="office-building-outline"
                                                size={32}
                                                color={colors.textMuted}
                                                style={styles.logoPlaceholderIcon}
                                                accessibilityElementsHidden
                                            />
                                        )}
                                        {logoUploading ? (
                                            <View
                                                style={[
                                                    StyleSheet.absoluteFill,
                                                    {
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: 'rgba(0,0,0,0.35)',
                                                    },
                                                ]}>
                                                <ActivityIndicator color="#fff" />
                                            </View>
                                        ) : null}
                                    </View>
                                    <View style={styles.logoActions}>
                                        <Pressable
                                            accessibilityRole="button"
                                            onPress={() => {
                                                void chooseLogo();
                                            }}
                                            disabled={logoUploading}
                                            style={({ pressed }) => [
                                                styles.chooseLogoBtn,
                                                pressed && !logoUploading && styles.chooseLogoBtnPressed,
                                                logoUploading && styles.chooseLogoBtnDisabled,
                                            ]}>
                                            <MaterialCommunityIcons
                                                name="image-plus"
                                                size={20}
                                                color={colors.primary}
                                                accessibilityElementsHidden
                                            />
                                            <Text style={styles.chooseLogoLabel}>
                                                {logoUploading
                                                    ? t('home.companyList.createModal.uploadingLogo')
                                                    : t('home.companyList.createModal.chooseLogo')}
                                            </Text>
                                        </Pressable>
                                        {logoPreviewUri ? (
                                            <Pressable
                                                accessibilityRole="button"
                                                onPress={clearLogo}
                                                disabled={logoUploading}
                                                style={styles.removeLogoBtn}>
                                                <Text style={styles.removeLogoLabel}>
                                                    {t('home.companyList.createModal.removeLogo')}
                                                </Text>
                                            </Pressable>
                                        ) : null}
                                    </View>
                                </View>
                            </View>

                            <View
                                onLayout={e => {
                                    nameFieldY.current = e.nativeEvent.layout.y;
                                }}>
                                <Text style={styles.fieldLabel}>
                                    {t('home.companyList.createModal.name')}
                                    <Text style={styles.requiredMark}> *</Text>
                                </Text>
                                <TextInput
                                    value={name}
                                    onChangeText={v => {
                                        setFormError(null);
                                        setName(v);
                                    }}
                                    onFocus={() => {
                                        focusedFieldRef.current = 'name';
                                        scrollToField(nameFieldY.current);
                                    }}
                                    onBlur={() => {
                                        if (focusedFieldRef.current === 'name') {
                                            focusedFieldRef.current = null;
                                        }
                                    }}
                                    placeholder={t('home.companyList.createModal.namePlaceholder')}
                                    placeholderTextColor={colors.textMuted}
                                    style={styles.input}
                                    autoCorrect={false}
                                />
                            </View>

                            <View
                                onLayout={e => {
                                    legalFieldY.current = e.nativeEvent.layout.y;
                                }}>
                                <Text style={styles.fieldLabel}>{t('home.companyList.createModal.legalName')}</Text>
                                <TextInput
                                    value={legalName}
                                    onChangeText={v => {
                                        setFormError(null);
                                        setLegalName(v);
                                    }}
                                    onFocus={() => {
                                        focusedFieldRef.current = 'legal';
                                        scrollToField(legalFieldY.current);
                                    }}
                                    onBlur={() => {
                                        if (focusedFieldRef.current === 'legal') {
                                            focusedFieldRef.current = null;
                                        }
                                    }}
                                    placeholder={t('home.companyList.createModal.legalNamePlaceholder')}
                                    placeholderTextColor={colors.textMuted}
                                    style={[styles.input, styles.inputLast]}
                                    autoCorrect={false}
                                />
                            </View>

                            <View style={styles.infoHintRow}>
                                <MaterialCommunityIcons
                                    name="information-outline"
                                    size={18}
                                    color={colors.primary}
                                    style={styles.infoHintIcon}
                                    accessibilityElementsHidden
                                />
                                <Text style={styles.infoHint}>
                                    {t('home.companyList.createModal.freeCreationHint')}
                                </Text>
                            </View>

                            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                        </ScrollView>

                        <View style={styles.sheetFooter}>
                            <View style={styles.actions}>
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={onDismiss}
                                    disabled={submitting}
                                    style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.92 }]}>
                                    <Text style={styles.btnSecondaryLabel}>
                                        {t('home.companyList.createModal.cancel')}
                                    </Text>
                                </Pressable>
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={handleSubmit}
                                    disabled={createDisabled}
                                    accessibilityState={{ disabled: createDisabled }}
                                    style={({ pressed }) => [
                                        styles.btnPrimary,
                                        createDisabled && styles.btnPrimaryDisabled,
                                        pressed && !createDisabled && { opacity: 0.92 },
                                    ]}>
                                    <Text style={styles.btnPrimaryLabel}>
                                        {submitting
                                            ? t('home.companyList.createModal.submitting')
                                            : t('home.companyList.createModal.submit')}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}
