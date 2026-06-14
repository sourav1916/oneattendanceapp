import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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
import type { IconProps } from 'react-native-vector-icons/Icon';

import type { NominatimReverseJson } from '@src/api/nominatimReverseGeocode';
import { reverseGeocodeFull } from '@src/api/nominatimReverseGeocode';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { localeTagForFormatting } from '@src/i18n/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { ActiveSession } from '@src/types/activeSessions';
import {
  resolveSessionDeviceVisual,
  sessionDeviceTint,
} from '@src/utils/sessionDeviceVisual';
import { formatSessionDateTime } from '@src/utils/sessionDateFormat';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.82, 620);

type Props = {
  visible: boolean;
  session: ActiveSession | null;
  onDismiss: () => void;
};

type DetailRowConfig = {
  icon: IconProps['name'];
  labelKey: string;
  value: string;
  accent: string;
  tint: string;
  multiline?: boolean;
};

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    sheetWrap: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    sheet: {
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      maxHeight: SHEET_MAX_HEIGHT,
      ...Platform.select({
        ios: {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: 16,
        },
        android: { elevation: 8 },
      }),
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? '#475569' : '#cbd5e1',
      marginTop: 10,
      marginBottom: 4,
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroIconDynamic: {
      backgroundColor: 'transparent',
    },
    heroBody: {
      flex: 1,
      minWidth: 0,
    },
    heroTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      lineHeight: 22,
    },
    heroSubtitle: {
      marginTop: 3,
      fontSize: 13,
      color: colors.textMuted,
    },
    currentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      marginTop: 8,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: '#0d9488',
    },
    currentBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.3,
    },
    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 8,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginBottom: 8,
      marginTop: 4,
      paddingHorizontal: 4,
    },
    detailCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      marginBottom: 12,
      overflow: 'hidden',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    detailRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    detailIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    detailBody: {
      flex: 1,
      minWidth: 0,
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.35,
      marginBottom: 2,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 20,
    },
    detailValueMuted: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
    },
    locationCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(13, 148, 136, 0.35)' : '#99f6e4',
      backgroundColor: isDark ? 'rgba(13, 148, 136, 0.12)' : '#f0fdfa',
      padding: 12,
      marginBottom: 4,
    },
    locationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    locationTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#5eead4' : '#0f766e',
    },
    skeletonLine: {
      height: 12,
      borderRadius: 6,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      marginBottom: 8,
    },
    skeletonLineShort: {
      width: '72%',
    },
    locationLoader: {
      marginTop: 4,
    },
    mapCategoryText: {
      marginTop: 8,
    },
    footer: {
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    closeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    closeBtnPressed: {
      opacity: 0.9,
    },
    closeBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
  });
}

function sessionCoordParts(session: ActiveSession): { lat: string; lon: string } | null {
  const lat = session.location?.latitude;
  const lng = session.location?.longitude;
  if (lat == null || lng == null) {
    return null;
  }
  const latS = String(lat).trim();
  const lonS = String(lng).trim();
  if (!latS || !lonS || latS === 'null' || lonS === 'null') {
    return null;
  }
  return { lat: latS, lon: lonS };
}

function DetailRow({
  row,
  styles,
  showBorder,
  iconBg,
}: {
  row: DetailRowConfig;
  styles: ReturnType<typeof buildStyles>;
  showBorder: boolean;
  iconBg: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={[styles.detailRow, showBorder && styles.detailRowBorder]}>
      <View style={[styles.detailIcon, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={row.icon} size={17} color={row.accent} />
      </View>
      <View style={styles.detailBody}>
        <Text style={styles.detailLabel}>{t(row.labelKey)}</Text>
        <Text
          style={row.value ? styles.detailValue : styles.detailValueMuted}
          selectable
          numberOfLines={row.multiline ? undefined : 3}>
          {row.value || '—'}
        </Text>
      </View>
    </View>
  );
}

export function SessionDetails({ visible, session, onDismiss }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const localeTag = localeTagForFormatting(i18n.language);

  const [nominatim, setNominatim] = useState<NominatimReverseJson | null | 'loading' | 'failed'>(
    'loading',
  );

  const skeletonOpacity = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    if (!visible || nominatim !== 'loading') {
      return;
    }
    skeletonOpacity.setValue(0.7);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(skeletonOpacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => {
      anim.stop();
    };
  }, [visible, nominatim, skeletonOpacity]);

  useEffect(() => {
    if (!visible || !session) {
      return;
    }
    const parts = sessionCoordParts(session);
    if (!parts) {
      setNominatim(null);
      return;
    }
    let cancelled = false;
    setNominatim('loading');
    void reverseGeocodeFull(parts.lat, parts.lon).then(data => {
      if (cancelled) {
        return;
      }
      setNominatim(data === null ? 'failed' : data);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, session]);

  if (!session) {
    return null;
  }

  const visual = resolveSessionDeviceVisual(
    session.user_agent,
    session.device_name,
    session.is_current,
  );
  const iconBg = sessionDeviceTint(resolvedScheme, visual);
  const parts = sessionCoordParts(session);

  const activityRows: DetailRowConfig[] = [
    {
      icon: 'login',
      labelKey: 'settings.sessions.loginAt',
      value: formatSessionDateTime(session.login_at, localeTag),
      accent: '#2563eb',
      tint: '#dbeafe',
    },
    {
      icon: 'clock-outline',
      labelKey: 'settings.sessions.lastActive',
      value: formatSessionDateTime(session.last_active, localeTag),
      accent: '#0891b2',
      tint: '#cffafe',
    },
    {
      icon: 'timer-sand',
      labelKey: 'settings.sessions.expiresAt',
      value: formatSessionDateTime(session.expires_at, localeTag),
      accent: '#ea580c',
      tint: '#ffedd5',
    },
  ];

  const deviceRows: DetailRowConfig[] = [
    {
      icon: 'identifier',
      labelKey: 'settings.sessions.sessionId',
      value: String(session.id),
      accent: '#64748b',
      tint: '#f1f5f9',
    },
    {
      icon: 'ip-network',
      labelKey: 'settings.sessions.ip',
      value: session.ip_address,
      accent: '#7c3aed',
      tint: '#ede9fe',
    },
    {
      icon: 'web',
      labelKey: 'settings.sessions.detailsUserAgent',
      value: session.user_agent,
      accent: '#6366f1',
      tint: '#eef2ff',
      multiline: true,
    },
  ];

  if (parts) {
    deviceRows.push({
      icon: 'crosshairs-gps',
      labelKey: 'settings.sessions.coordinates',
      value: `${parts.lat}, ${parts.lon}`,
      accent: '#059669',
      tint: '#d1fae5',
    });
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.safe} edges={['top', 'right', 'left', 'bottom']}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.sessions.detailsClose')}
          style={styles.backdrop}
          onPress={onDismiss}
        />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.hero}>
              <View style={[styles.heroIcon, styles.heroIconDynamic, { backgroundColor: iconBg }]}>
                <MaterialCommunityIcons name={visual.icon} size={26} color={visual.accent} />
              </View>
              <View style={styles.heroBody}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {session.device_name}
                </Text>
                <Text style={styles.heroSubtitle}>{t('settings.sessions.detailsTitle')}</Text>
                {session.is_current ? (
                  <View style={styles.currentBadge}>
                    <MaterialCommunityIcons name="check-circle" size={11} color="#fff" />
                    <Text style={styles.currentBadgeText}>{t('settings.sessions.current')}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
              bounces={false}>
              <Text style={styles.sectionLabel}>{t('settings.sessions.detailsSectionActivity')}</Text>
              <View style={styles.detailCard}>
                {activityRows.map((row, index) => (
                  <DetailRow
                    key={row.labelKey}
                    row={row}
                    styles={styles}
                    showBorder={index > 0}
                    iconBg={
                      resolvedScheme === 'dark' ? `${row.accent}22` : row.tint
                    }
                  />
                ))}
              </View>

              <Text style={styles.sectionLabel}>{t('settings.sessions.detailsSectionDevice')}</Text>
              <View style={styles.detailCard}>
                {deviceRows.map((row, index) => (
                  <DetailRow
                    key={`${row.labelKey}-${index}`}
                    row={row}
                    styles={styles}
                    showBorder={index > 0}
                    iconBg={
                      resolvedScheme === 'dark' ? `${row.accent}22` : row.tint
                    }
                  />
                ))}
              </View>

              <Text style={styles.sectionLabel}>{t('settings.sessions.location')}</Text>
              <View style={styles.locationCard}>
                <View style={styles.locationHeader}>
                  <MaterialCommunityIcons name="map-marker-radius" size={18} color="#0d9488" />
                  <Text style={styles.locationTitle}>{t('settings.sessions.addressDetails')}</Text>
                </View>
                {nominatim === 'loading' ? (
                  <View>
                    <Animated.View style={[styles.skeletonLine, { opacity: skeletonOpacity }]} />
                    <Animated.View
                      style={[
                        styles.skeletonLine,
                        styles.skeletonLineShort,
                        { opacity: skeletonOpacity },
                      ]}
                    />
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                      style={styles.locationLoader}
                    />
                  </View>
                ) : nominatim === 'failed' || !nominatim?.display_name ? (
                  <Text style={styles.detailValueMuted}>
                    {parts
                      ? t('settings.sessions.locationUnavailable')
                      : t('settings.sessions.locationUnavailable')}
                  </Text>
                ) : (
                  <Text style={styles.detailValue} selectable>
                    {nominatim.display_name}
                  </Text>
                )}
                {nominatim && nominatim !== 'loading' && nominatim !== 'failed' && nominatim.type ? (
                  <Text style={[styles.detailValueMuted, styles.mapCategoryText]}>
                    {t('settings.sessions.mapCategory')}: {nominatim.type}
                  </Text>
                ) : null}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                onPress={onDismiss}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}>
                <MaterialCommunityIcons name="check" size={18} color="#fff" />
                <Text style={styles.closeBtnText}>{t('settings.sessions.detailsClose')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
