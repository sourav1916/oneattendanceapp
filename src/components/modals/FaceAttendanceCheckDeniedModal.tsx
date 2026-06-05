import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
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
import { humanizeLedgerKey } from '@src/utils/ledgerFormat';
import type { FaceAttendanceMatchedEmployee } from '@src/utils/parseFaceAttendanceCheck';
import { resolveMediaUrl } from '@src/utils/resolveMediaUrl';

const AVATAR_SIZE = 72;
const FAIL_RED = '#dc2626';
const FAIL_RED_DARK = '#f87171';
const FAIL_RED_BG_LIGHT = '#fef2f2';
const FAIL_RED_BG_DARK = '#450a0a';
const FAIL_RED_BORDER_LIGHT = '#fecaca';
const FAIL_RED_BORDER_DARK = 'rgba(248,113,113,0.45)';

export type FaceAttendanceCheckDeniedModalProps = {
  visible: boolean;
  employee: FaceAttendanceMatchedEmployee | null;
  message: string;
  actionLabel?: string;
  onDismiss: () => void;
};

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

type DetailRowProps = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
  styles: ReturnType<typeof buildStyles>;
  iconColor: string;
};

function DetailRow({ icon, label, value, styles, iconColor }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
      <View style={styles.detailTextWrap}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export function FaceAttendanceCheckDeniedModal({
  visible,
  employee,
  message,
  actionLabel,
  onDismiss,
}: FaceAttendanceCheckDeniedModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const isDark = resolvedScheme === 'dark';
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const failAccent = isDark ? FAIL_RED_DARK : FAIL_RED;
  const detailIconColor = isDark ? '#fca5a5' : '#991b1b';

  if (employee == null) {
    return null;
  }

  const avatarUri = resolveMediaUrl(employee.profilePictureUrl) || null;
  const designationLabel = employee.designation
    ? humanizeLedgerKey(employee.designation)
    : null;
  const similarityLabel =
    employee.similarity != null && Number.isFinite(employee.similarity)
      ? t('home.faceAttendance.similarity', {
          value: (employee.similarity * 100).toFixed(0),
        })
      : null;
  const reasonText =
    message.trim() || t('home.faceAttendance.errors.notAllowedTitle');

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={styles.safe}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t('modals.common.closeDialog')}
          onPress={onDismiss}
        />

        <View style={styles.centerWrap} pointerEvents="box-none">
          <View
            style={[styles.card, styles.cardFailBorder]}
            accessibilityViewIsModal
          >
            <View style={styles.headerBanner}>
              <View style={styles.headerIconWrap}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={32}
                  color={failAccent}
                />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, styles.titleFail]} accessibilityRole="header">
                  {t('modals.faceAttendanceCheckDenied.title')}
                </Text>
                <Text style={styles.subtitle}>
                  {t('modals.faceAttendanceCheckDenied.subtitle')}
                </Text>
                {actionLabel ? (
                  <View style={styles.actionChip}>
                    <MaterialCommunityIcons
                      name="gesture-tap"
                      size={14}
                      color={failAccent}
                    />
                    <Text style={[styles.actionChipText, { color: failAccent }]}>
                      {actionLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <ScrollView
              style={styles.scrollBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <View style={styles.reasonCard}>
                <View style={styles.reasonHeaderRow}>
                  <MaterialCommunityIcons
                    name="alert-octagon"
                    size={20}
                    color={failAccent}
                  />
                  <Text style={styles.reasonLabel}>
                    {t('modals.faceAttendanceCheckDenied.reasonLabel')}
                  </Text>
                </View>
                <Text style={styles.reasonMessage}>{reasonText}</Text>
              </View>

              <Text style={styles.sectionTitle}>
                {t('modals.faceAttendanceCheckDenied.matchedEmployee')}
              </Text>

              <View style={styles.employeeCard}>
                <View style={styles.avatarWrap}>
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.avatarImage}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <Text style={styles.avatarInitials}>
                      {getInitials(employee.employeeName)}
                    </Text>
                  )}
                </View>
                <Text style={styles.employeeName}>{employee.employeeName}</Text>
                <Text style={styles.meta}>
                  {t('home.faceAttendance.employeeId', {
                    id: employee.employeeId,
                  })}
                </Text>
                {similarityLabel ? (
                  <Text style={styles.meta}>{similarityLabel}</Text>
                ) : null}
                <View style={styles.detailsBlock}>
                  {designationLabel ? (
                    <DetailRow
                      icon="briefcase-outline"
                      label={t('home.faceAttendance.designation')}
                      value={designationLabel}
                      styles={styles}
                      iconColor={detailIconColor}
                    />
                  ) : null}
                  {employee.email ? (
                    <DetailRow
                      icon="email-outline"
                      label={t('home.faceAttendance.email')}
                      value={employee.email}
                      styles={styles}
                      iconColor={detailIconColor}
                    />
                  ) : null}
                  {employee.mobile ? (
                    <DetailRow
                      icon="phone-outline"
                      label={t('home.faceAttendance.mobile')}
                      value={employee.mobile}
                      styles={styles}
                      iconColor={detailIconColor}
                    />
                  ) : null}
                </View>
              </View>
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && styles.closeBtnPressed,
              ]}
            >
              <Text style={styles.closeBtnText}>
                {t('modals.faceAttendanceCheckDenied.gotIt')}
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
  const failBannerBg = isDark ? FAIL_RED_BG_DARK : FAIL_RED_BG_LIGHT;
  const failBorder = isDark ? FAIL_RED_BORDER_DARK : FAIL_RED_BORDER_LIGHT;
  const failAccent = isDark ? FAIL_RED_DARK : FAIL_RED;

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
      maxHeight: '90%',
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
    cardFailBorder: {
      borderColor: failBorder,
      borderWidth: 2,
    },
    headerBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 18,
      backgroundColor: failBannerBg,
      borderBottomWidth: 1,
      borderBottomColor: failBorder,
    },
    headerIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: isDark ? 'rgba(220,38,38,0.25)' : '#fee2e2',
      borderWidth: 1,
      borderColor: failBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextWrap: { flex: 1 },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    titleFail: {
      color: failAccent,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
      lineHeight: 18,
    },
    actionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(220,38,38,0.2)' : '#fff',
      borderWidth: 1,
      borderColor: failBorder,
    },
    actionChipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    scrollBody: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    reasonCard: {
      backgroundColor: isDark ? 'rgba(220,38,38,0.18)' : FAIL_RED_BG_LIGHT,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: failBorder,
      padding: 14,
      marginBottom: 16,
    },
    reasonHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    reasonLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: failAccent,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    reasonMessage: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#fecaca' : '#7f1d1d',
      lineHeight: 24,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 10,
    },
    employeeCard: {
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: failBorder,
      padding: 16,
      alignItems: 'center',
      marginBottom: 8,
    },
    avatarWrap: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: isDark ? 'rgba(220,38,38,0.15)' : '#fff',
      borderWidth: 2,
      borderColor: failAccent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      overflow: 'hidden',
    },
    avatarImage: { width: AVATAR_SIZE, height: AVATAR_SIZE },
    avatarInitials: {
      fontSize: 24,
      fontWeight: '700',
      color: failAccent,
    },
    employeeName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    meta: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 2,
    },
    detailsBlock: {
      alignSelf: 'stretch',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: failBorder,
      gap: 8,
    },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    detailTextWrap: { flex: 1 },
    detailLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 1,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    closeBtn: {
      marginHorizontal: 20,
      marginTop: 8,
      marginBottom: 16,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: failAccent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnPressed: { opacity: 0.88 },
    closeBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
  });
}
