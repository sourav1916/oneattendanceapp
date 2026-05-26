import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type { LeaveApplication, LeaveApplicationStatus } from '@src/types/leaveApplication';

type Props = {
    visible: boolean;
    leave: LeaveApplication | null;
    onDismiss: () => void;
};

const STATUS_PALETTE: Record<
    LeaveApplicationStatus,
    { bgLight: string; bgDark: string; textLight: string; textDark: string }
> = {
    pending: {
        bgLight: '#fef3c7',
        bgDark: '#422006',
        textLight: '#92400e',
        textDark: '#fbbf24',
    },
    approved: {
        bgLight: '#dcfce7',
        bgDark: '#14532d',
        textLight: '#166534',
        textDark: '#4ade80',
    },
    rejected: {
        bgLight: '#fee2e2',
        bgDark: '#450a0a',
        textLight: '#991b1b',
        textDark: '#f87171',
    },
    cancelled: {
        bgLight: '#f1f5f9',
        bgDark: '#334155',
        textLight: '#475569',
        textDark: '#94a3b8',
    },
};

function formatDisplayDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
        return iso;
    }
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
        return iso;
    }
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${h12}:${mm} ${ampm}`;
}

export function LeaveDetailModal({ visible, leave, onDismiss }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const styles = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);

    if (!leave) {
        return null;
    }

    const isDark = resolvedScheme === 'dark';
    const statusPalette = STATUS_PALETTE[leave.status];
    const statusBg = isDark ? statusPalette.bgDark : statusPalette.bgLight;
    const statusText = isDark ? statusPalette.textDark : statusPalette.textLight;

    const dateRange =
        leave.start_date === leave.end_date
            ? formatDisplayDate(leave.start_date)
            : `${formatDisplayDate(leave.start_date)}  →  ${formatDisplayDate(leave.end_date)}`;

    const dayLabel = leave.total_days === 1 ? 'day' : 'days';

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onDismiss}>
            <SafeAreaView style={styles.safe}>
                <Pressable
                    style={styles.backdrop}
                    accessibilityRole="button"
                    accessibilityLabel={t('modals.common.closeDialog')}
                    onPress={onDismiss}
                />

                <View style={styles.centerWrap} pointerEvents="box-none">
                    <View
                        style={styles.card}
                        accessibilityViewIsModal>
                        <Text style={styles.title} accessibilityRole="header">
                            {t('home.leaveRequest.detailModal.title')}
                        </Text>

                        <ScrollView
                            style={styles.scrollBody}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            bounces={false}>

                            {/* Leave Type */}
                            <View style={styles.row}>
                                <Text style={styles.label}>
                                    {t('home.leaveRequest.detailModal.leaveType')}
                                </Text>
                                <View style={styles.rowValueRow}>
                                    <Text style={styles.value}>{leave.leave_type_name}</Text>
                                    <View style={[styles.badge, leave.is_paid ? styles.badgePaid : styles.badgeUnpaid]}>
                                        <Text style={[styles.badgeText, leave.is_paid ? styles.badgePaidText : styles.badgeUnpaidText]}>
                                            {leave.is_paid ? 'Paid' : 'Unpaid'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Date Range */}
                            <View style={styles.row}>
                                <Text style={styles.label}>
                                    {t('home.leaveRequest.detailModal.dateRange')}
                                </Text>
                                <Text style={styles.value}>{dateRange}</Text>
                            </View>

                            {/* Duration */}
                            <View style={styles.row}>
                                <Text style={styles.label}>
                                    {t('home.leaveRequest.detailModal.duration')}
                                </Text>
                                <View style={styles.rowValueRow}>
                                    <Text style={styles.value}>
                                        {leave.total_days} {dayLabel}
                                    </Text>
                                    {leave.is_half_day ? (
                                        <View style={styles.badgeHalfDay}>
                                            <Text style={styles.badgeHalfDayText}>
                                                {t('home.leaveRequest.detailModal.halfDayType')}
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                                {leave.is_half_day && leave.half_day_type ? (
                                    <Text style={styles.subValue}>
                                        {leave.half_day_type === 'first_half'
                                            ? t('home.leaveRequest.detailModal.firstHalf')
                                            : t('home.leaveRequest.detailModal.secondHalf')}
                                    </Text>
                                ) : null}
                            </View>

                            {/* Reason */}
                            <View style={styles.row}>
                                <Text style={styles.label}>
                                    {t('home.leaveRequest.detailModal.reason')}
                                </Text>
                                <Text style={styles.value}>{leave.reason}</Text>
                            </View>

                            {/* Status */}
                            <View style={styles.row}>
                                <Text style={styles.label}>
                                    {t('home.leaveRequest.detailModal.status')}
                                </Text>
                                <View style={styles.rowValueRow}>
                                    <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                                        <Text style={[styles.statusBadgeText, { color: statusText }]}>
                                            {t(`home.leaveRequest.status.${leave.status}`)}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Applied On */}
                            <View style={styles.row}>
                                <Text style={styles.label}>
                                    {t('home.leaveRequest.detailModal.appliedAt')}
                                </Text>
                                <Text style={styles.value}>
                                    {formatDateTime(leave.applied_at)}
                                </Text>
                            </View>

                            {/* Admin Remarks */}
                            {leave.approval_remarks ? (
                                <View style={styles.row}>
                                    <Text style={styles.label}>
                                        {t('home.leaveRequest.detailModal.remarks')}
                                    </Text>
                                    <Text style={styles.value}>{leave.approval_remarks}</Text>
                                </View>
                            ) : null}

                            {/* Attachments */}
                            {leave.attachments.length > 0 ? (
                                <View style={styles.row}>
                                    <Text style={styles.label}>
                                        {t('home.leaveRequest.detailModal.attachments')}
                                    </Text>
                                    {leave.attachments.map((att) => (
                                        <Pressable
                                            key={att.id}
                                            style={({ pressed }) => [
                                                styles.attachmentRow,
                                                pressed && styles.attachmentPressed,
                                            ]}
                                            accessibilityRole="link"
                                            onPress={() => {
                                                Linking.openURL(att.file_url).catch(() => {});
                                            }}>
                                            <MaterialCommunityIcons
                                                name="file-outline"
                                                size={16}
                                                color={colors.primary}
                                            />
                                            <Text
                                                style={styles.attachmentName}
                                                numberOfLines={1}>
                                                {att.original_name}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            ) : null}
                        </ScrollView>

                        {/* Close Button */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.closeBtn,
                                pressed && styles.closeBtnPressed,
                            ]}
                            accessibilityRole="button"
                            onPress={onDismiss}>
                            <Text style={styles.closeBtnText}>
                                {t('home.leaveRequest.detailModal.close')}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
    const isDark = scheme === 'dark';

    return StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.overlay,
        },
        backdrop: {
            ...StyleSheet.absoluteFill,
        },
        centerWrap: {
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: 16,
        },
        card: {
            alignSelf: 'center',
            width: '100%',
            maxWidth: 420,
            maxHeight: '88%',
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            paddingTop: 20,
            paddingBottom: 16,
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.12,
                    shadowRadius: 20,
                },
                android: { elevation: 12 },
            }),
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
            paddingHorizontal: 20,
            marginBottom: 16,
        },
        scrollBody: {
            paddingHorizontal: 20,
        },
        row: {
            marginBottom: 16,
        },
        label: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
        },
        value: {
            fontSize: 14,
            color: colors.text,
            lineHeight: 20,
        },
        subValue: {
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 2,
        },
        rowValueRow: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
        },
        badge: {
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
        },
        badgePaid: {
            backgroundColor: isDark ? '#14532d' : '#dcfce7',
        },
        badgePaidText: {
            color: isDark ? '#4ade80' : '#166534',
        },
        badgeUnpaid: {
            backgroundColor: isDark ? '#422006' : '#fef3c7',
        },
        badgeUnpaidText: {
            color: isDark ? '#fbbf24' : '#92400e',
        },
        badgeText: {
            fontSize: 11,
            fontWeight: '600',
        },
        badgeHalfDay: {
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: isDark ? '#1e3a5f' : '#dbeafe',
        },
        badgeHalfDayText: {
            fontSize: 11,
            fontWeight: '600',
            color: isDark ? '#60a5fa' : '#2563eb',
        },
        statusBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
        },
        statusBadgeText: {
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'capitalize',
        },
        attachmentRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 6,
            paddingHorizontal: 8,
            borderRadius: 8,
            backgroundColor: isDark ? colors.background : '#f8fafc',
            marginTop: 4,
        },
        attachmentPressed: {
            opacity: 0.7,
        },
        attachmentName: {
            flex: 1,
            fontSize: 13,
            color: colors.primary,
        },
        closeBtn: {
            marginTop: 8,
            marginHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 13,
            borderRadius: 12,
            backgroundColor: colors.secondaryButton,
            borderWidth: 1,
            borderColor: colors.border,
        },
        closeBtnPressed: {
            opacity: 0.82,
        },
        closeBtnText: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
    });
}
