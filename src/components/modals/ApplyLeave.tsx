import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { DatePicker } from '@src/components/modals/DatePicker';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
    ApplyLeaveApiPayload,
    DerivedLeaveType,
    LeaveApplication,
    UpdateLeaveApiPayload,
} from '@src/types/leaveApplication';
import { uploadFileToOneSaas } from '@src/utils/FileUpload';

export type { ApplyLeaveApiPayload, UpdateLeaveApiPayload };

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.92;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const FAR_FUTURE = '2099-12-31';

const T = 'home.leaveRequest.applyModal.';

function todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRequestedDays(startDate: string, endDate: string, isHalfDay: boolean): number {
    if (!startDate || !endDate) { return 0; }
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    if (isHalfDay && startDate === endDate) { return 0.5; }
    return dayCount;
}

function formatDisplayDate(iso: string): string {
    if (!iso) { return ''; }
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

type UploadedFile = {
    id: string;
    url: string;
    name: string;
};

type ExistingAttachment = {
    id: string;
    file_url: string;
    original_name: string;
    markedForDeletion: boolean;
};

export type ApplyLeaveModalProps = {
    visible: boolean;
    onDismiss: () => void;
    leaveTypes: DerivedLeaveType[];
    initialLeave: LeaveApplication | null;
    onSubmit: (payload: ApplyLeaveApiPayload | UpdateLeaveApiPayload) => void | Promise<void>;
    submitting: boolean;
};

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
    const cardBg = scheme === 'dark' ? '#1e293b' : '#f8fafc';
    return StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'flex-end',
        },
        backdrop: {
            ...StyleSheet.absoluteFill,
        },
        sheet: {
            maxHeight: SHEET_MAX_HEIGHT,
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: scheme === 'dark' ? 0.35 : 0.12,
                    shadowRadius: 16,
                },
                android: { elevation: 16 },
            }),
        },
        handleBar: {
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            marginTop: 10,
            marginBottom: 6,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        closeBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.secondaryButton,
        },
        body: {
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 8,
        },
        sectionLabel: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 10,
            marginTop: 4,
        },
        chipScroll: {
            marginBottom: 4,
        },
        chipRow: {
            flexDirection: 'row',
            gap: 10,
            paddingRight: 4,
        },
        chip: {
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: cardBg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        chipSelected: {
            borderColor: colors.primary,
            backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#eff6ff',
        },
        chipName: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        chipNameSelected: {
            color: colors.primary,
        },
        chipBadge: {
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: scheme === 'dark' ? '#334155' : '#e2e8f0',
        },
        chipBadgeSelected: {
            backgroundColor: scheme === 'dark' ? '#2563eb' : '#bfdbfe',
        },
        chipBadgeText: {
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
        },
        chipBadgeTextSelected: {
            color: scheme === 'dark' ? '#fff' : '#1d4ed8',
        },
        balanceHint: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
            marginBottom: 4,
            paddingHorizontal: 4,
        },
        balanceHintText: {
            fontSize: 13,
            color: colors.primary,
            fontWeight: '600',
        },
        fieldCard: {
            backgroundColor: cardBg,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 14,
            overflow: 'hidden',
        },
        dateRow: {
            flexDirection: 'row',
        },
        dateField: {
            flex: 1,
            paddingHorizontal: 14,
            paddingVertical: 14,
        },
        dateFieldLeft: {
            borderRightWidth: StyleSheet.hairlineWidth,
            borderRightColor: colors.border,
        },
        dateFieldLabel: {
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 6,
        },
        dateFieldValue: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        dateFieldPlaceholder: {
            color: colors.textMuted,
            fontWeight: '400',
        },
        halfDayRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        halfDayLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        halfDayLabel: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        toggleTrack: {
            width: 46,
            height: 26,
            borderRadius: 13,
            justifyContent: 'center',
            paddingHorizontal: 2,
        },
        toggleTrackOff: {
            backgroundColor: scheme === 'dark' ? '#475569' : '#cbd5e1',
        },
        toggleTrackOn: {
            backgroundColor: colors.primary,
        },
        toggleThumb: {
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: '#fff',
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.2,
                    shadowRadius: 2,
                },
                android: { elevation: 2 },
            }),
        },
        halfTypeRow: {
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 14,
            paddingBottom: 14,
        },
        halfTypeBtn: {
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center',
            backgroundColor: cardBg,
        },
        halfTypeBtnSelected: {
            borderColor: colors.primary,
            backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#eff6ff',
        },
        halfTypeText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.textMuted,
        },
        halfTypeTextSelected: {
            color: colors.primary,
        },
        requestedRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        requestedLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        requestedValue: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.primary,
        },
        requestedExceeds: {
            color: colors.danger,
        },
        warningRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 14,
            paddingBottom: 12,
        },
        warningText: {
            fontSize: 13,
            color: colors.danger,
            fontWeight: '600',
            flex: 1,
        },
        reasonInput: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: Platform.OS === 'ios' ? 14 : 12,
            fontSize: 15,
            color: colors.text,
            backgroundColor: cardBg,
            marginBottom: 14,
            minHeight: 90,
            textAlignVertical: 'top',
        },
        attachSection: {
            marginBottom: 14,
        },
        addFileBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: 'dashed',
            backgroundColor: cardBg,
        },
        addFileBtnPressed: {
            opacity: 0.7,
        },
        addFileLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.primary,
        },
        uploadingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
        },
        uploadingText: {
            fontSize: 13,
            color: colors.textMuted,
        },
        fileItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 8,
        },
        fileItemDeleted: {
            opacity: 0.45,
        },
        fileItemName: {
            flex: 1,
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
        },
        fileRemoveBtn: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: scheme === 'dark' ? '#3f1d1d' : '#fee2e2',
        },
        fileUndoBtn: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#dbeafe',
        },
        errorText: {
            fontSize: 13,
            color: colors.danger,
            marginBottom: 8,
            paddingHorizontal: 2,
        },
        footer: {
            flexDirection: 'row',
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 28 : 16,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
        },
        btnCancel: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center',
            backgroundColor: colors.secondaryButton,
        },
        btnSubmit: {
            flex: 1.4,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            backgroundColor: colors.primary,
        },
        btnSubmitDisabled: {
            opacity: 0.5,
        },
        btnCancelLabel: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
        },
        btnSubmitLabel: {
            fontSize: 16,
            fontWeight: '700',
            color: '#fff',
        },
        pressed: {
            opacity: 0.85,
        },
    });
}

export function ApplyLeaveModal({
    visible,
    onDismiss,
    leaveTypes,
    initialLeave,
    onSubmit,
    submitting,
}: ApplyLeaveModalProps): React.JSX.Element {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const styles = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);

    const isEdit = initialLeave != null;

    const [selectedTypeId, setSelectedTypeId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isHalfDay, setIsHalfDay] = useState(false);
    const [halfDayType, setHalfDayType] = useState<'first_half' | 'second_half'>('first_half');
    const [reason, setReason] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [existingAttachments, setExistingAttachments] = useState<ExistingAttachment[]>([]);
    const [uploading, setUploading] = useState(false);

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const toggleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(toggleAnim, {
            toValue: isHalfDay ? 1 : 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [isHalfDay, toggleAnim]);

    const toggleTranslateX = toggleAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 20],
    });

    useEffect(() => {
        if (!visible) { return; }
        setFormError(null);
        setUploading(false);

        if (initialLeave) {
            setSelectedTypeId(initialLeave.leave_type_id);
            setStartDate(initialLeave.start_date);
            setEndDate(initialLeave.end_date);
            setIsHalfDay(initialLeave.is_half_day);
            setHalfDayType(initialLeave.half_day_type ?? 'first_half');
            setReason(initialLeave.reason);
            setUploadedFiles([]);
            setExistingAttachments(
                initialLeave.attachments.map(a => ({
                    id: a.id,
                    file_url: a.file_url,
                    original_name: a.original_name,
                    markedForDeletion: false,
                })),
            );
        } else {
            setSelectedTypeId(leaveTypes.length === 1 ? leaveTypes[0].id : '');
            setStartDate('');
            setEndDate('');
            setIsHalfDay(false);
            setHalfDayType('first_half');
            setReason('');
            setUploadedFiles([]);
            setExistingAttachments([]);
        }
    }, [visible, initialLeave, leaveTypes]);

    const selectedType = useMemo(
        () => leaveTypes.find(lt => lt.id === selectedTypeId) ?? null,
        [leaveTypes, selectedTypeId],
    );

    const today = useMemo(() => todayIso(), []);

    const requestedDays = useMemo(
        () => getRequestedDays(startDate, endDate, isHalfDay),
        [startDate, endDate, isHalfDay],
    );

    const balanceExceeded = selectedType != null && requestedDays > 0 && requestedDays > selectedType.remaining;

    const validate = useCallback((): string | null => {
        if (!selectedTypeId) { return t(`${T}errors.leaveTypeRequired`); }
        if (!startDate || !endDate) { return t(`${T}errors.datesRequired`); }
        if (endDate < startDate) { return t(`${T}errors.endBeforeStart`); }
        if (isHalfDay && startDate !== endDate) { return t(`${T}errors.halfDayRange`); }
        if (balanceExceeded) { return t(`${T}errors.exceedsRemaining`); }
        if (!reason.trim()) { return t(`${T}errors.reasonRequired`); }
        return null;
    }, [selectedTypeId, startDate, endDate, isHalfDay, balanceExceeded, reason, t]);

    const handlePickFile = useCallback(async () => {
        try {
            const result = await launchImageLibrary({
                mediaType: 'mixed',
                selectionLimit: 1,
            });
            if (result.didCancel || !result.assets?.length) { return; }
            const asset = result.assets[0];
            const mime = asset.type ?? 'application/octet-stream';
            if (!ALLOWED_MIME_TYPES.includes(mime)) {
                setFormError(t(`${T}errors.invalidFileType`));
                return;
            }
            setUploading(true);
            setFormError(null);
            const url = await uploadFileToOneSaas({
                uri: asset.uri ?? '',
                mimeType: mime,
                fileName: asset.fileName ?? `file_${Date.now()}`,
            });
            setUploadedFiles(prev => [
                ...prev,
                { id: String(Date.now()), url, name: asset.fileName ?? 'file' },
            ]);
        } catch {
            setFormError(t(`${T}errors.uploadFailed`));
        } finally {
            setUploading(false);
        }
    }, [t]);

    const removeUploadedFile = useCallback((id: string) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== id));
    }, []);

    const toggleExistingDeletion = useCallback((id: string) => {
        setExistingAttachments(prev =>
            prev.map(a => (a.id === id ? { ...a, markedForDeletion: !a.markedForDeletion } : a)),
        );
    }, []);

    const handleSubmit = useCallback(() => {
        const err = validate();
        if (err) {
            setFormError(err);
            return;
        }
        setFormError(null);

        const newAttachmentUrls = uploadedFiles.map(f => f.url);

        if (isEdit && initialLeave) {
            const deletedIds = existingAttachments
                .filter(a => a.markedForDeletion)
                .map(a => a.id);
            const keptUrls = existingAttachments
                .filter(a => !a.markedForDeletion)
                .map(a => a.file_url);

            const payload: UpdateLeaveApiPayload = {
                id: initialLeave.id,
                leave_config_id: selectedTypeId,
                start_date: startDate,
                end_date: endDate,
                is_half_day: isHalfDay ? 1 : 0,
                reason: reason.trim(),
                attachments: [...keptUrls, ...newAttachmentUrls],
            };
            if (isHalfDay) { payload.half_day_type = halfDayType; }
            if (deletedIds.length > 0) { payload.deleted_attachments = deletedIds; }
            Promise.resolve(onSubmit(payload)).catch(() => {});
        } else {
            const payload: ApplyLeaveApiPayload = {
                leave_config_id: selectedTypeId,
                start_date: startDate,
                end_date: endDate,
                is_half_day: isHalfDay ? 1 : 0,
                reason: reason.trim(),
            };
            if (isHalfDay) { payload.half_day_type = halfDayType; }
            if (newAttachmentUrls.length > 0) { payload.attachments = newAttachmentUrls; }
            Promise.resolve(onSubmit(payload)).catch(() => {});
        }
    }, [
        validate, isEdit, initialLeave, selectedTypeId, startDate, endDate,
        isHalfDay, halfDayType, reason, uploadedFiles, existingAttachments, onSubmit,
    ]);

    const handleSelectType = useCallback((id: string) => {
        setSelectedTypeId(id);
        setFormError(null);
    }, []);

    const handleStartConfirm = useCallback((iso: string) => {
        setStartDate(iso);
        if (endDate && endDate < iso) { setEndDate(iso); }
        setShowStartPicker(false);
    }, [endDate]);

    const handleEndConfirm = useCallback((iso: string) => {
        setEndDate(iso);
        setShowEndPicker(false);
    }, []);

    const showHalfDay = selectedType?.allow_half_day === true;

    useEffect(() => {
        if (!showHalfDay) { setIsHalfDay(false); }
    }, [showHalfDay]);

    const submitDisabled = submitting || uploading || balanceExceeded;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onDismiss}>
            <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(`${T}cancel`)}
                    style={styles.backdrop}
                    onPress={onDismiss}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={0}>
                    <View style={styles.sheet}>
                        <View style={styles.handleBar} />

                        <View style={styles.header}>
                            <Text style={styles.headerTitle} accessibilityRole="header">
                                {isEdit ? t(`${T}editTitle`) : t(`${T}title`)}
                            </Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t(`${T}cancel`)}
                                onPress={onDismiss}
                                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                                <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
                            </Pressable>
                        </View>

                        <ScrollView
                            contentContainerStyle={styles.body}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            bounces={false}>

                            {/* Leave Type Chips */}
                            <Text style={styles.sectionLabel}>{t(`${T}leaveTypeLabel`)}</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.chipScroll}
                                contentContainerStyle={styles.chipRow}
                                keyboardShouldPersistTaps="handled">
                                {leaveTypes.map(lt => {
                                    const active = lt.id === selectedTypeId;
                                    return (
                                        <Pressable
                                            key={lt.id}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: active }}
                                            onPress={() => handleSelectType(lt.id)}
                                            style={({ pressed }) => [
                                                styles.chip,
                                                active && styles.chipSelected,
                                                pressed && styles.pressed,
                                            ]}>
                                            <Text style={[styles.chipName, active && styles.chipNameSelected]}>
                                                {lt.name}
                                            </Text>
                                            <View style={[styles.chipBadge, active && styles.chipBadgeSelected]}>
                                                <Text style={[
                                                    styles.chipBadgeText,
                                                    active && styles.chipBadgeTextSelected,
                                                ]}>
                                                    {lt.code}
                                                </Text>
                                            </View>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>

                            {selectedType && (
                                <View style={styles.balanceHint}>
                                    <MaterialCommunityIcons name="information-outline" size={16} color={colors.primary} />
                                    <Text style={styles.balanceHintText}>
                                        {t(`${T}remainingHint`, { count: selectedType.remaining })}
                                    </Text>
                                </View>
                            )}

                            {/* Dates + Half Day + Requested Days */}
                            <Text style={styles.sectionLabel}>{t(`${T}selectDate`)}</Text>
                            <View style={styles.fieldCard}>
                                <View style={styles.dateRow}>
                                    <Pressable
                                        accessibilityRole="button"
                                        style={({ pressed }) => [
                                            styles.dateField,
                                            styles.dateFieldLeft,
                                            pressed && styles.pressed,
                                        ]}
                                        onPress={() => setShowStartPicker(true)}>
                                        <Text style={styles.dateFieldLabel}>{t(`${T}startLabel`)}</Text>
                                        <Text style={[
                                            styles.dateFieldValue,
                                            !startDate && styles.dateFieldPlaceholder,
                                        ]}>
                                            {startDate ? formatDisplayDate(startDate) : t(`${T}selectDate`)}
                                        </Text>
                                    </Pressable>

                                    <Pressable
                                        accessibilityRole="button"
                                        style={({ pressed }) => [
                                            styles.dateField,
                                            pressed && styles.pressed,
                                        ]}
                                        onPress={() => setShowEndPicker(true)}>
                                        <Text style={styles.dateFieldLabel}>{t(`${T}endLabel`)}</Text>
                                        <Text style={[
                                            styles.dateFieldValue,
                                            !endDate && styles.dateFieldPlaceholder,
                                        ]}>
                                            {endDate ? formatDisplayDate(endDate) : t(`${T}selectDate`)}
                                        </Text>
                                    </Pressable>
                                </View>

                                {showHalfDay && (
                                    <>
                                        <View style={styles.halfDayRow}>
                                            <View style={styles.halfDayLeft}>
                                                <MaterialCommunityIcons
                                                    name="clock-outline"
                                                    size={20}
                                                    color={isHalfDay ? colors.primary : colors.textMuted}
                                                />
                                                <Text style={styles.halfDayLabel}>{t(`${T}halfDayLabel`)}</Text>
                                            </View>
                                            <Pressable
                                                accessibilityRole="switch"
                                                accessibilityState={{ checked: isHalfDay }}
                                                onPress={() => setIsHalfDay(prev => !prev)}>
                                                <View style={[
                                                    styles.toggleTrack,
                                                    isHalfDay ? styles.toggleTrackOn : styles.toggleTrackOff,
                                                ]}>
                                                    <Animated.View
                                                        style={[
                                                            styles.toggleThumb,
                                                            { transform: [{ translateX: toggleTranslateX }] },
                                                        ]}
                                                    />
                                                </View>
                                            </Pressable>
                                        </View>

                                        {isHalfDay && (
                                            <View style={styles.halfTypeRow}>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: halfDayType === 'first_half' }}
                                                    onPress={() => setHalfDayType('first_half')}
                                                    style={({ pressed }) => [
                                                        styles.halfTypeBtn,
                                                        halfDayType === 'first_half' && styles.halfTypeBtnSelected,
                                                        pressed && styles.pressed,
                                                    ]}>
                                                    <Text style={[
                                                        styles.halfTypeText,
                                                        halfDayType === 'first_half' && styles.halfTypeTextSelected,
                                                    ]}>
                                                        {t(`${T}firstHalf`)}
                                                    </Text>
                                                </Pressable>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: halfDayType === 'second_half' }}
                                                    onPress={() => setHalfDayType('second_half')}
                                                    style={({ pressed }) => [
                                                        styles.halfTypeBtn,
                                                        halfDayType === 'second_half' && styles.halfTypeBtnSelected,
                                                        pressed && styles.pressed,
                                                    ]}>
                                                    <Text style={[
                                                        styles.halfTypeText,
                                                        halfDayType === 'second_half' && styles.halfTypeTextSelected,
                                                    ]}>
                                                        {t(`${T}secondHalf`)}
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        )}
                                    </>
                                )}

                                {requestedDays > 0 && (
                                    <View style={styles.requestedRow}>
                                        <Text style={styles.requestedLabel}>{t(`${T}requestedDays`)}</Text>
                                        <Text style={[
                                            styles.requestedValue,
                                            balanceExceeded && styles.requestedExceeds,
                                        ]}>
                                            {requestedDays}
                                        </Text>
                                    </View>
                                )}

                                {balanceExceeded && (
                                    <View style={styles.warningRow}>
                                        <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.danger} />
                                        <Text style={styles.warningText}>{t(`${T}exceedsBalance`)}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Reason */}
                            <Text style={styles.sectionLabel}>{t(`${T}reasonLabel`)}</Text>
                            <TextInput
                                value={reason}
                                onChangeText={setReason}
                                placeholder={t(`${T}reasonPlaceholder`)}
                                placeholderTextColor={colors.textMuted}
                                multiline
                                style={styles.reasonInput}
                            />

                            {/* Attachments */}
                            <Text style={styles.sectionLabel}>{t(`${T}attachmentsLabel`)}</Text>
                            <View style={styles.attachSection}>
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() => { handlePickFile().catch(() => {}); }}
                                    disabled={uploading}
                                    style={({ pressed }) => [
                                        styles.addFileBtn,
                                        pressed && styles.addFileBtnPressed,
                                    ]}>
                                    <MaterialCommunityIcons name="paperclip" size={20} color={colors.primary} />
                                    <Text style={styles.addFileLabel}>{t(`${T}addFile`)}</Text>
                                </Pressable>

                                {uploading && (
                                    <View style={styles.uploadingRow}>
                                        <ActivityIndicator size="small" color={colors.primary} />
                                        <Text style={styles.uploadingText}>{t(`${T}uploading`)}</Text>
                                    </View>
                                )}

                                {existingAttachments.map(att => (
                                    <View
                                        key={att.id}
                                        style={[styles.fileItem, att.markedForDeletion && styles.fileItemDeleted]}>
                                        <MaterialCommunityIcons
                                            name="file-document-outline"
                                            size={18}
                                            color={colors.textMuted}
                                        />
                                        <Text style={styles.fileItemName} numberOfLines={1}>
                                            {att.original_name}
                                        </Text>
                                        <Pressable
                                            accessibilityRole="button"
                                            onPress={() => toggleExistingDeletion(att.id)}
                                            style={att.markedForDeletion ? styles.fileUndoBtn : styles.fileRemoveBtn}>
                                            <MaterialCommunityIcons
                                                name={att.markedForDeletion ? 'undo' : 'close'}
                                                size={16}
                                                color={att.markedForDeletion ? colors.primary : colors.danger}
                                            />
                                        </Pressable>
                                    </View>
                                ))}

                                {uploadedFiles.map(file => (
                                    <View key={file.id} style={styles.fileItem}>
                                        <MaterialCommunityIcons
                                            name="file-check-outline"
                                            size={18}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.fileItemName} numberOfLines={1}>
                                            {file.name}
                                        </Text>
                                        <Pressable
                                            accessibilityRole="button"
                                            onPress={() => removeUploadedFile(file.id)}
                                            style={styles.fileRemoveBtn}>
                                            <MaterialCommunityIcons name="close" size={16} color={colors.danger} />
                                        </Pressable>
                                    </View>
                                ))}
                            </View>

                            {formError && <Text style={styles.errorText}>{formError}</Text>}
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <Pressable
                                accessibilityRole="button"
                                onPress={onDismiss}
                                disabled={submitting}
                                style={({ pressed }) => [styles.btnCancel, pressed && styles.pressed]}>
                                <Text style={styles.btnCancelLabel}>{t(`${T}cancel`)}</Text>
                            </Pressable>
                            <Pressable
                                accessibilityRole="button"
                                onPress={handleSubmit}
                                disabled={submitDisabled}
                                style={({ pressed }) => [
                                    styles.btnSubmit,
                                    submitDisabled && styles.btnSubmitDisabled,
                                    pressed && !submitDisabled && styles.pressed,
                                ]}>
                                <Text style={styles.btnSubmitLabel}>
                                    {submitting
                                        ? t(`${T}submitting`)
                                        : isEdit
                                            ? t(`${T}update`)
                                            : t(`${T}submit`)}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>

            <DatePicker
                visible={showStartPicker}
                value={startDate || today}
                onDismiss={() => setShowStartPicker(false)}
                onConfirm={handleStartConfirm}
                title={t(`${T}startLabel`)}
                minDate={today}
                maxDate={FAR_FUTURE}
            />
            <DatePicker
                visible={showEndPicker}
                value={endDate || startDate || today}
                onDismiss={() => setShowEndPicker(false)}
                onConfirm={handleEndConfirm}
                title={t(`${T}endLabel`)}
                minDate={startDate || today}
                maxDate={FAR_FUTURE}
            />
        </Modal>
    );
}
