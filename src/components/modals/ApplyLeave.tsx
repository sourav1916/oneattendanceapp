import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type { LeaveBalanceEntry } from '@src/types/leaveBalance';

export type ApplyLeavePayload = {
    leaveSlug: string;
    leave_config_id: number;
    startDate: string;
    endDate: string;
    halfDay: boolean;
    reason: string;
};

type Props = {
    visible: boolean;
    onDismiss: () => void;
    leaveSlug: string;
    leaveDisplayName: string;
    entry: LeaveBalanceEntry;
    onSubmit: (payload: ApplyLeavePayload) => void | Promise<void>;
};

function parseYmd(s: string): number | null {
    const t = s.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        return null;
    }
    const d = new Date(`${t}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function inclusiveWeekdayCount(startYmd: string, endYmd: string): number {
    const t0 = parseYmd(startYmd);
    const t1 = parseYmd(endYmd);
    if (t0 == null || t1 == null || t1 < t0) {
        return 0;
    }
    let count = 0;
    const d = new Date(`${startYmd.trim()}T12:00:00`);
    const end = new Date(`${endYmd.trim()}T12:00:00`);
    while (d.getTime() <= end.getTime()) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) {
            count += 1;
        }
        d.setDate(d.getDate() + 1);
    }
    return count;
}

function inclusiveCalendarDays(startYmd: string, endYmd: string): number {
    const t0 = parseYmd(startYmd);
    const t1 = parseYmd(endYmd);
    if (t0 == null || t1 == null || t1 < t0) {
        return 0;
    }
    return Math.floor((t1 - t0) / 86400000) + 1;
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
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
            justifyContent: 'center',
            paddingHorizontal: 16,
        },
        sheet: {
            alignSelf: 'center',
            width: '100%',
            maxWidth: 420,
            maxHeight: '88%',
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        subtitle: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 14,
        },
        fieldLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.textMuted,
            marginBottom: 6,
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
        inputMultiline: {
            minHeight: 72,
            textAlignVertical: 'top',
        },
        segmentRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 12,
        },
        segment: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            alignItems: 'center',
        },
        segmentSelected: {
            borderColor: colors.primary,
            backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#eff6ff',
        },
        segmentText: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        segmentTextSelected: {
            color: colors.primary,
        },
        errorText: {
            fontSize: 13,
            color: colors.danger,
            marginBottom: 10,
        },
        actions: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 4,
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

export function ApplyLeave({
    visible,
    onDismiss,
    leaveSlug,
    leaveDisplayName,
    entry,
    onSubmit,
}: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const styles = useMemo(
        () => buildStyles(colors, resolvedScheme),
        [colors, resolvedScheme],
    );

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [halfDay, setHalfDay] = useState(false);
    const [reason, setReason] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!visible) {
            return;
        }
        setStartDate('');
        setEndDate('');
        setHalfDay(false);
        setReason('');
        setFormError(null);
        setSubmitting(false);
    }, [visible, leaveSlug]);

    const requestedDays = useMemo(() => {
        const s = startDate.trim();
        const e = endDate.trim();
        if (parseYmd(s) == null || parseYmd(e) == null) {
            return null;
        }
        if (parseYmd(e)! < parseYmd(s)!) {
            return null;
        }
        if (halfDay) {
            return s === e ? 0.5 : null;
        }
        if (entry.exclude_weekends) {
            return inclusiveWeekdayCount(s, e);
        }
        return inclusiveCalendarDays(s, e);
    }, [startDate, endDate, halfDay, entry.exclude_weekends]);

    const validate = useCallback((): string | null => {
        const s = startDate.trim();
        const e = endDate.trim();
        if (!s || !e) {
            return t('home.leaveRequest.applyModal.errors.datesRequired');
        }
        if (parseYmd(s) == null || parseYmd(e) == null) {
            return t('home.leaveRequest.applyModal.errors.invalidFormat');
        }
        if (parseYmd(e)! < parseYmd(s)!) {
            return t('home.leaveRequest.applyModal.errors.endBeforeStart');
        }
        if (halfDay && s !== e) {
            return t('home.leaveRequest.applyModal.errors.halfDayRange');
        }
        if (requestedDays == null) {
            return t('home.leaveRequest.applyModal.errors.invalidFormat');
        }
        if (requestedDays > entry.remaining) {
            return t('home.leaveRequest.applyModal.errors.exceedsRemaining');
        }
        return null;
    }, [startDate, endDate, halfDay, requestedDays, entry.remaining, t]);

    const handleSubmit = useCallback(() => {
        const err = validate();
        if (err) {
            setFormError(err);
            return;
        }
        setFormError(null);
        setSubmitting(true);
        const payload: ApplyLeavePayload = {
            leaveSlug,
            leave_config_id: entry.leave_config_id,
            startDate: startDate.trim(),
            endDate: endDate.trim(),
            halfDay,
            reason: reason.trim(),
        };
        void Promise.resolve(onSubmit(payload))
            .then(() => {
                onDismiss();
            })
            .catch(() => {
                /* parent may throw; keep modal open */
            })
            .finally(() => {
                setSubmitting(false);
            });
    }, [
        validate,
        onSubmit,
        onDismiss,
        leaveSlug,
        entry.leave_config_id,
        startDate,
        endDate,
        halfDay,
        reason,
    ]);

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
                    accessibilityLabel={t('home.leaveRequest.applyModal.cancel')}
                    style={styles.backdrop}
                    onPress={onDismiss}
                />
                <KeyboardAvoidingView
                    style={styles.sheetWrap}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={0}
                    pointerEvents="box-none">
                    <View style={styles.sheet}>
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            automaticallyAdjustKeyboardInsets
                            showsVerticalScrollIndicator={false}
                            bounces={false}>
                            <Text style={styles.title} accessibilityRole="header">
                                {t('home.leaveRequest.applyModal.title')}
                            </Text>
                            <Text style={styles.subtitle}>
                                {leaveDisplayName} · {t('home.leaveRequest.code')}: {entry.code}
                                {'\n'}
                                {t('home.leaveRequest.applyModal.remainingHint', { count: entry.remaining })}
                            </Text>

                            <Text style={styles.fieldLabel}>{t('home.leaveRequest.applyModal.startLabel')}</Text>
                            <TextInput
                                value={startDate}
                                onChangeText={setStartDate}
                                placeholder={t('home.leaveRequest.applyModal.datePlaceholder')}
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                autoCorrect={false}
                                style={styles.input}
                            />

                            <Text style={styles.fieldLabel}>{t('home.leaveRequest.applyModal.endLabel')}</Text>
                            <TextInput
                                value={endDate}
                                onChangeText={setEndDate}
                                placeholder={t('home.leaveRequest.applyModal.datePlaceholder')}
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                autoCorrect={false}
                                style={styles.input}
                            />

                            {entry.allow_half_day ? (
                                <>
                                    <Text style={styles.fieldLabel}>{t('home.leaveRequest.applyModal.halfDayLabel')}</Text>
                                    <View style={styles.segmentRow}>
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: !halfDay }}
                                            onPress={() => setHalfDay(false)}
                                            style={({ pressed }) => [
                                                styles.segment,
                                                !halfDay && styles.segmentSelected,
                                                pressed && { opacity: 0.92 },
                                            ]}>
                                            <Text style={[styles.segmentText, !halfDay && styles.segmentTextSelected]}>
                                                {t('home.leaveRequest.applyModal.fullDay')}
                                            </Text>
                                        </Pressable>
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: halfDay }}
                                            onPress={() => setHalfDay(true)}
                                            style={({ pressed }) => [
                                                styles.segment,
                                                halfDay && styles.segmentSelected,
                                                pressed && { opacity: 0.92 },
                                            ]}>
                                            <Text style={[styles.segmentText, halfDay && styles.segmentTextSelected]}>
                                                {t('home.leaveRequest.applyModal.halfDayOption')}
                                            </Text>
                                        </Pressable>
                                    </View>
                                </>
                            ) : null}

                            <Text style={styles.fieldLabel}>{t('home.leaveRequest.applyModal.reasonLabel')}</Text>
                            <TextInput
                                value={reason}
                                onChangeText={setReason}
                                placeholder={t('home.leaveRequest.applyModal.reasonPlaceholder')}
                                placeholderTextColor={colors.textMuted}
                                multiline
                                style={[styles.input, styles.inputMultiline]}
                            />

                            {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
                        </ScrollView>

                        <View style={styles.actions}>
                            <Pressable
                                accessibilityRole="button"
                                onPress={onDismiss}
                                disabled={submitting}
                                style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.92 }]}>
                                <Text style={styles.btnSecondaryLabel}>{t('home.leaveRequest.applyModal.cancel')}</Text>
                            </Pressable>
                            <Pressable
                                accessibilityRole="button"
                                onPress={handleSubmit}
                                disabled={submitting}
                                style={({ pressed }) => [
                                    styles.btnPrimary,
                                    submitting && styles.btnPrimaryDisabled,
                                    pressed && !submitting && { opacity: 0.92 },
                                ]}>
                                <Text style={styles.btnPrimaryLabel}>
                                    {submitting ? t('home.leaveRequest.applyModal.submitting') : t('home.leaveRequest.applyModal.submit')}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}
