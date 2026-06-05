import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Image,
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
import type { EmpLeaveStatus, EmployeeLeaveRow } from '@src/types/employeeLeave';
import { resolveProfilePictureUrl } from '@src/utils/attendanceListDisplay';
import { resolveMediaUrl } from '@src/utils/resolveMediaUrl';

type Props = {
  visible: boolean;
  leave: EmployeeLeaveRow | null;
  onDismiss: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  actionSubmitting?: boolean;
};

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const MODAL_MAX_HEIGHT = Math.min(WINDOW_HEIGHT * 0.88, 560);
/** Room for fixed title, employee header, and footer action buttons. */
const DETAIL_CHROME_HEIGHT = 230;
const DETAIL_SCROLL_MAX_HEIGHT = Math.max(
  MODAL_MAX_HEIGHT - DETAIL_CHROME_HEIGHT,
  200,
);

const STATUS_PALETTE: Record<
  EmpLeaveStatus,
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
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
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
  if (Number.isNaN(d.getTime())) {
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

function attachmentLabel(fileType: string, index: number): string {
  if (fileType.includes('pdf')) {
    return `PDF ${index + 1}`;
  }
  if (fileType.startsWith('image/')) {
    return `Image ${index + 1}`;
  }
  return `File ${index + 1}`;
}

export function EmpLeaveDetailModal({
  visible,
  leave,
  onDismiss,
  onApprove,
  onReject,
  onEdit,
  actionSubmitting = false,
}: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  if (!leave) {
    return null;
  }

  const isDark = resolvedScheme === 'dark';
  const statusPalette = STATUS_PALETTE[leave.status];
  const statusBg = isDark ? statusPalette.bgDark : statusPalette.bgLight;
  const statusText = isDark ? statusPalette.textDark : statusPalette.textLight;
  const avatarUri = resolveProfilePictureUrl(leave.profile_picture);

  const dateRange =
    leave.start_date === leave.end_date
      ? formatDisplayDate(leave.start_date)
      : `${formatDisplayDate(leave.start_date)}  →  ${formatDisplayDate(leave.end_date)}`;

  const dayLabel = leave.total_days === 1 ? 'day' : 'days';
  const leaveTypeLabel = leave.leave_code
    ? `${leave.leave_name} (${leave.leave_code})`
    : leave.leave_name;

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
          <View style={styles.card} accessibilityViewIsModal>
            <View style={styles.headerSection}>
              <Text style={styles.title} accessibilityRole="header">
                {t('home.leaveRequests.detailModal.title')}
              </Text>

              <View style={styles.employeeHeader}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <MaterialCommunityIcons name="account" size={28} color="#94a3b8" />
                  </View>
                )}
                <View style={styles.employeeCol}>
                  <Text style={styles.employeeName}>{leave.employee_name}</Text>
                  <Text style={styles.employeeMeta}>{leave.employee_code}</Text>
                </View>
              </View>
            </View>

            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}>

              <View style={styles.row}>
                <Text style={styles.label}>
                  {t('home.leaveRequests.detailModal.email')}
                </Text>
                <Text style={styles.value}>{leave.email || '—'}</Text>
              </View>

              {leave.designation ? (
                <View style={styles.row}>
                  <Text style={styles.label}>
                    {t('home.leaveRequests.detailModal.designation')}
                  </Text>
                  <Text style={styles.value}>{leave.designation}</Text>
                </View>
              ) : null}

              <View style={styles.row}>
                <Text style={styles.label}>
                  {t('home.leaveRequest.detailModal.leaveType')}
                </Text>
                <View style={styles.rowValueRow}>
                  <Text style={styles.value}>{leaveTypeLabel}</Text>
                  <View style={[styles.badge, leave.is_paid ? styles.badgePaid : styles.badgeUnpaid]}>
                    <Text style={[styles.badgeText, leave.is_paid ? styles.badgePaidText : styles.badgeUnpaidText]}>
                      {leave.is_paid
                        ? t('home.leaveRequest.paid')
                        : t('home.leaveRequest.unpaid')}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>
                  {t('home.leaveRequest.detailModal.dateRange')}
                </Text>
                <Text style={styles.value}>{dateRange}</Text>
              </View>

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

              <View style={styles.row}>
                <Text style={styles.label}>
                  {t('home.leaveRequest.detailModal.reason')}
                </Text>
                <Text style={styles.value}>{leave.reason || '—'}</Text>
              </View>

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

              <View style={styles.row}>
                <Text style={styles.label}>
                  {t('home.leaveRequest.detailModal.appliedAt')}
                </Text>
                <Text style={styles.value}>{formatDateTime(leave.applied_at)}</Text>
              </View>

              {leave.approved_by_name && leave.approved_at ? (
                <View style={styles.row}>
                  <Text style={styles.label}>
                    {t('home.leaveRequests.detailModal.approvedBy')}
                  </Text>
                  <Text style={styles.value}>
                    {leave.approved_by_name}
                    {' · '}
                    {formatDateTime(leave.approved_at)}
                  </Text>
                </View>
              ) : null}

              {leave.approval_remarks ? (
                <View style={styles.row}>
                  <Text style={styles.label}>
                    {t('home.leaveRequest.detailModal.remarks')}
                  </Text>
                  <Text style={styles.value}>{leave.approval_remarks}</Text>
                </View>
              ) : null}

              {leave.cancelled_at ? (
                <View style={styles.row}>
                  <Text style={styles.label}>
                    {t('home.leaveRequests.detailModal.cancelledAt')}
                  </Text>
                  <Text style={styles.value}>{formatDateTime(leave.cancelled_at)}</Text>
                </View>
              ) : null}

              {leave.attachments.length > 0 ? (
                <View style={styles.row}>
                  <Text style={styles.label}>
                    {t('home.leaveRequest.detailModal.attachments')}
                  </Text>
                  {leave.attachments.map((att, index) => (
                    <Pressable
                      key={att.id}
                      style={({ pressed }) => [
                        styles.attachmentRow,
                        pressed && styles.attachmentPressed,
                      ]}
                      accessibilityRole="link"
                      onPress={() => {
                        Linking.openURL(resolveMediaUrl(att.file_url)).catch(() => {});
                      }}>
                      <MaterialCommunityIcons
                        name="file-outline"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {attachmentLabel(att.file_type, index)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.footerSection}>
            {leave.status === 'pending' && onEdit ? (
              <Pressable
                style={({ pressed }) => [
                  styles.editBtn,
                  pressed && styles.closeBtnPressed,
                  actionSubmitting && styles.actionBtnDisabled,
                ]}
                accessibilityRole="button"
                disabled={actionSubmitting}
                onPress={onEdit}>
                <MaterialCommunityIcons
                  name="calendar-edit"
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.editBtnText}>
                  {t('home.leaveRequests.actions.editRequest')}
                </Text>
              </Pressable>
            ) : null}

            {leave.status === 'pending' && onApprove && onReject ? (
              <View style={styles.actionRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtnDanger,
                    pressed && styles.closeBtnPressed,
                    actionSubmitting && styles.actionBtnDisabled,
                  ]}
                  accessibilityRole="button"
                  disabled={actionSubmitting}
                  onPress={onReject}>
                  <Text style={styles.actionBtnDangerText}>
                    {t('home.leaveRequests.actions.reject')}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtnPrimary,
                    pressed && styles.closeBtnPressed,
                    actionSubmitting && styles.actionBtnDisabled,
                  ]}
                  accessibilityRole="button"
                  disabled={actionSubmitting}
                  onPress={onApprove}>
                  <Text style={styles.actionBtnPrimaryText}>
                    {t('home.leaveRequests.actions.approve')}
                  </Text>
                </Pressable>
              </View>
            ) : null}

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
      maxHeight: MODAL_MAX_HEIGHT,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
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
    headerSection: {
      paddingTop: 20,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    scrollBody: {
      maxHeight: DETAIL_SCROLL_MAX_HEIGHT,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    footerSection: {
      paddingTop: 8,
      paddingBottom: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    employeeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingBottom: 16,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
    },
    avatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      alignItems: 'center',
      justifyContent: 'center',
    },
    employeeCol: { flex: 1, minWidth: 0 },
    employeeName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    employeeMeta: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
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
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 8,
      marginHorizontal: 20,
    },
    actionBtnPrimary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    actionBtnPrimaryText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
    actionBtnDanger: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: scheme === 'dark' ? 'rgba(239,68,68,0.2)' : '#fef2f2',
      borderWidth: 1,
      borderColor: '#fecaca',
    },
    actionBtnDangerText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#dc2626',
    },
    actionBtnDisabled: { opacity: 0.55 },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginBottom: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: scheme === 'dark' ? 'rgba(59,130,246,0.15)' : '#eff6ff',
      borderWidth: 1,
      borderColor: scheme === 'dark' ? 'rgba(59,130,246,0.4)' : '#bfdbfe',
    },
    editBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    closeBtn: {
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
