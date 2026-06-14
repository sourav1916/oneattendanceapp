import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  TAB_SCREEN_SAFE_AREA_EDGES,
  TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { fetchActiveSessions } from '@src/api/fetchActiveSessions';
import { logoutAllOtherSessions } from '@src/api/logoutAllOtherSessions';
import { logoutSession } from '@src/api/logoutSession';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { SessionDetails } from '@src/components/modals/SessionDetails';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { localeTagForFormatting } from '@src/i18n/types';
import type { SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { ActiveSession } from '@src/types/activeSessions';
import { readApiError } from '@src/utils/readApiError';
import {
  resolveSessionDeviceVisual,
  sessionDeviceTint,
} from '@src/utils/sessionDeviceVisual';
import { formatSessionDateTime } from '@src/utils/sessionDateFormat';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Sessions'>;

function buildSessionStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';
  const screenBg = isDark ? colors.background : '#f1f5f9';
  const cardBg = isDark ? colors.surface : '#ffffff';

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: screenBg,
    },
    fill: {
      flex: 1,
    },
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
    stackHeaderRight: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#fecaca',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#450a0a' : '#fff1f2',
    },
    stackHeaderRightPressed: {
      opacity: 0.88,
    },
    stackHeaderRightDisabled: {
      opacity: 0.55,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
    },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 16,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.18 : 0.05,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      }),
    },
    summaryIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    summaryBody: {
      flex: 1,
    },
    summaryHint: {
      marginTop: 2,
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    centerBox: {
      paddingVertical: 56,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingHorizontal: 24,
    },
    centerIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    muted: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
    error: {
      fontSize: 15,
      color: colors.danger,
      textAlign: 'center',
      lineHeight: 22,
    },
    retryBtn: {
      marginTop: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryBtnPressed: {
      opacity: 0.9,
    },
    retryLabel: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    card: {
      backgroundColor: cardBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.16 : 0.04,
          shadowRadius: 4,
        },
        android: { elevation: 1 },
      }),
    },
    cardCurrent: {
      borderColor: '#0d9488',
      backgroundColor: isDark ? '#0f172a' : '#f0fdfa',
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    deviceIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: {
      flex: 1,
      minWidth: 0,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    deviceName: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 20,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: '#0d9488',
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#fff',
    },
    lastActiveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    lastActiveText: {
      flex: 1,
      fontSize: 12,
      color: colors.textMuted,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    iconBtnPressed: {
      opacity: 0.85,
    },
    iconBtnPrimary: {
      borderColor: isDark ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.2)',
      backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
    },
    iconBtnDanger: {
      borderColor: '#fecaca',
      backgroundColor: isDark ? '#450a0a' : '#fff1f2',
    },
    iconBtnDisabled: {
      opacity: 0.5,
    },
    skPulseBase: {
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
    },
    skSummaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: cardBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 16,
    },
    skIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
    },
    skSummaryIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
    },
    skBody: {
      flex: 1,
      minWidth: 0,
      gap: 8,
    },
    skLine: {
      height: 12,
      borderRadius: 6,
    },
    skLineMd: {
      width: '55%',
    },
    skLineLg: {
      width: '78%',
    },
    skLineSm: {
      width: '42%',
      height: 10,
    },
    skCard: {
      backgroundColor: cardBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
    },
    skCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    skActions: {
      flexDirection: 'row',
      gap: 4,
    },
    skActionBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
    },
  });
}

const SKELETON_CARD_COUNT = 4;

function useSkeletonPulse() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);

  return useMemo(
    () => ({
      opacity: pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.38, 0.72],
      }),
    }),
    [pulse],
  );
}

function SessionListSkeleton({
  ms,
  count = SKELETON_CARD_COUNT,
}: {
  ms: ReturnType<typeof buildSessionStyles>;
  count?: number;
}) {
  const pulseStyle = useSkeletonPulse();

  return (
    <>
      <View style={ms.skSummaryCard}>
        <Animated.View style={[ms.skSummaryIcon, ms.skPulseBase, pulseStyle]} />
        <View style={ms.skBody}>
          <Animated.View style={[ms.skLine, ms.skLineMd, ms.skPulseBase, pulseStyle]} />
          <Animated.View style={[ms.skLine, ms.skLineLg, ms.skPulseBase, pulseStyle]} />
        </View>
      </View>
      {Array.from({ length: count }, (_, index) => (
        <View key={`session-sk-${index}`} style={ms.skCard}>
          <View style={ms.skCardRow}>
            <Animated.View style={[ms.skIcon, ms.skPulseBase, pulseStyle]} />
            <View style={ms.skBody}>
              <Animated.View style={[ms.skLine, ms.skLineMd, ms.skPulseBase, pulseStyle]} />
              <Animated.View style={[ms.skLine, ms.skLineSm, ms.skPulseBase, pulseStyle]} />
            </View>
            <View style={ms.skActions}>
              <Animated.View style={[ms.skActionBtn, ms.skPulseBase, pulseStyle]} />
              <Animated.View style={[ms.skActionBtn, ms.skPulseBase, pulseStyle]} />
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

export function SessionScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const ms = useMemo(() => buildSessionStyles(colors, resolvedScheme), [colors, resolvedScheme]);
  const localeTag = localeTagForFormatting(i18n.language);

  const { props: confirmProps, present } = useConfirmAlert();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoutOthersSubmitting, setLogoutOthersSubmitting] = useState(false);
  const [logoutOneSubmittingId, setLogoutOneSubmittingId] = useState<number | null>(null);
  const [detailSession, setDetailSession] = useState<ActiveSession | null>(null);

  const hasOtherSessions = useMemo(
    () => sessions.some(s => !s.is_current),
    [sessions],
  );

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => Number(b.is_current) - Number(a.is_current)),
    [sessions],
  );

  const showSkeleton = loading || refreshing;

  const load = useCallback(async () => {
    const tkn = token?.trim();
    if (!tkn) {
      setError(t('settings.sessions.errors.noToken'));
      setSessions([]);
      return;
    }
    setError(null);
    try {
      const data = await fetchActiveSessions();
      if (!data.success) {
        setError(data.message || t('settings.sessions.errors.generic'));
        setSessions([]);
        return;
      }
      setSessions(data.sessions ?? []);
    } catch (e) {
      setError(readApiError(e));
      setSessions([]);
    }
  }, [token, t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openLogoutOneSessionConfirm = useCallback(
    (session: ActiveSession) => {
      if (session.is_current) {
        return;
      }
      present({
        title: t('settings.sessions.logoutOneConfirmTitle'),
        message: t('settings.sessions.logoutOneConfirmMessage', {
          device: session.device_name,
        }),
        buttons: [
          { key: 'cancel', text: t('settings.alerts.cancel'), variant: 'secondary' },
          {
            key: 'confirm',
            text: t('settings.sessions.logoutOneConfirm'),
            variant: 'danger',
            onPress: () => {
              void (async () => {
                setLogoutOneSubmittingId(session.id);
                try {
                  const data = await logoutSession(session.id);
                  if (!data.success) {
                    present({
                      title: t('settings.sessions.logoutOneFailedTitle'),
                      message: data.message || t('settings.sessions.errors.generic'),
                      buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
                    });
                    return;
                  }
                  setDetailSession(prev => (prev?.id === session.id ? null : prev));
                  await load();
                  present({
                    title: t('settings.sessions.logoutOneSuccessTitle'),
                    message: [data.message, t('settings.sessions.logoutOneSuccessMessage')]
                      .filter(Boolean)
                      .join('\n\n'),
                    buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
                  });
                } catch (e) {
                  present({
                    title: t('settings.sessions.logoutOneFailedTitle'),
                    message: readApiError(e),
                    buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
                  });
                } finally {
                  setLogoutOneSubmittingId(null);
                }
              })();
            },
          },
        ],
      });
    },
    [load, present, t],
  );

  const openLogoutOthersConfirm = useCallback(() => {
    present({
      title: t('settings.sessions.logoutOthersConfirmTitle'),
      message: t('settings.sessions.logoutOthersConfirmMessage'),
      buttons: [
        { key: 'cancel', text: t('settings.alerts.cancel'), variant: 'secondary' },
        {
          key: 'confirm',
          text: t('settings.sessions.logoutOthersConfirm'),
          variant: 'danger',
          onPress: () => {
            void (async () => {
              setLogoutOthersSubmitting(true);
              try {
                const data = await logoutAllOtherSessions();
                if (!data.success) {
                  present({
                    title: t('settings.sessions.logoutOthersFailedTitle'),
                    message: data.message || t('settings.sessions.errors.generic'),
                    buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
                  });
                  return;
                }
                await load();
                const detail = t('settings.sessions.logoutOthersSuccessMessage', {
                  count: data.affected_sessions,
                });
                present({
                  title: t('settings.sessions.logoutOthersSuccessTitle'),
                  message: [data.message, detail].filter(Boolean).join('\n\n'),
                  buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
                });
              } catch (e) {
                present({
                  title: t('settings.sessions.logoutOthersFailedTitle'),
                  message: readApiError(e),
                  buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
                });
              } finally {
                setLogoutOthersSubmitting(false);
              }
            })();
          },
        },
      ],
    });
  }, [load, present, t]);

  return (
    <SafeAreaView style={ms.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={ms.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('settings.sessions.back')}
        />
        <Text style={ms.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
          {t('settings.sessions.title')}
        </Text>
        {hasOtherSessions ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.sessions.logoutOthers')}
            disabled={logoutOthersSubmitting || logoutOneSubmittingId !== null}
            onPress={openLogoutOthersConfirm}
            style={({ pressed }) => [
              ms.stackHeaderRight,
              pressed &&
              !logoutOthersSubmitting &&
              logoutOneSubmittingId === null &&
              ms.stackHeaderRightPressed,
              (logoutOthersSubmitting || logoutOneSubmittingId !== null) && ms.stackHeaderRightDisabled,
            ]}>
            {logoutOthersSubmitting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
            )}
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        style={ms.fill}
        contentContainerStyle={ms.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing && !loading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        {showSkeleton ? (
          <SessionListSkeleton ms={ms} />
        ) : error ? (
          <View style={ms.centerBox}>
            <View style={ms.centerIconWrap}>
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color={colors.danger} />
            </View>
            <Text style={ms.error}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLoading(true);
                load()
                  .catch(() => {})
                  .finally(() => {
                    setLoading(false);
                  });
              }}
              style={({ pressed }) => [ms.retryBtn, pressed && ms.retryBtnPressed]}>
              <Text style={ms.retryLabel}>{t('settings.sessions.retry')}</Text>
            </Pressable>
          </View>
        ) : sessions.length === 0 ? (
          <View style={ms.centerBox}>
            <View style={ms.centerIconWrap}>
              <MaterialCommunityIcons name="devices" size={32} color={colors.textMuted} />
            </View>
            <Text style={ms.muted}>{t('settings.sessions.empty')}</Text>
          </View>
        ) : (
          <>
            <View style={ms.summaryCard}>
              <View style={ms.summaryIconWrap}>
                <MaterialCommunityIcons name="shield-check" size={24} color={colors.primary} />
              </View>
              <View style={ms.summaryBody}>
                <Text style={ms.summaryTitle}>
                  {t('settings.sessions.listMeta', { total: sessions.length })}
                </Text>
                <Text style={ms.summaryHint}>
                  {hasOtherSessions
                    ? t('settings.sessions.summaryHintOthers')
                    : t('settings.sessions.summaryHintOnly')}
                </Text>
              </View>
            </View>
            {sortedSessions.map(s => {
              return (
                <SessionCard
                  key={s.id}
                  session={s}
                  ms={ms}
                  scheme={resolvedScheme}
                  localeTag={localeTag}
                  onOpenDetails={() => setDetailSession(s)}
                  onLogoutPress={openLogoutOneSessionConfirm}
                  logoutOneSubmittingId={logoutOneSubmittingId}
                  logoutOthersSubmitting={logoutOthersSubmitting}
                />
              );
            })}
          </>
        )}
      </ScrollView>
      <SessionDetails
        visible={detailSession !== null}
        session={detailSession}
        onDismiss={() => setDetailSession(null)}
      />
      <ConfirmAlert {...confirmProps} />
    </SafeAreaView>
  );
}

function SessionCard({
  session,
  ms,
  scheme,
  localeTag,
  onOpenDetails,
  onLogoutPress,
  logoutOneSubmittingId,
  logoutOthersSubmitting,
}: {
  session: ActiveSession;
  ms: ReturnType<typeof buildSessionStyles>;
  scheme: 'light' | 'dark';
  localeTag: string;
  onOpenDetails: () => void;
  onLogoutPress: (s: ActiveSession) => void;
  logoutOneSubmittingId: number | null;
  logoutOthersSubmitting: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const lastActive = formatSessionDateTime(session.last_active, localeTag);
  const thisLogoutLoading = logoutOneSubmittingId === session.id;
  const deviceVisual = resolveSessionDeviceVisual(
    session.user_agent,
    session.device_name,
    session.is_current,
  );
  const iconBg = sessionDeviceTint(scheme, deviceVisual);
  const actionsDisabled = logoutOthersSubmitting || thisLogoutLoading;

  return (
    <View style={[ms.card, session.is_current && ms.cardCurrent]}>
      <View style={ms.cardRow}>
        <View style={[ms.deviceIconWrap, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons
            name={deviceVisual.icon}
            size={20}
            color={deviceVisual.accent}
          />
        </View>
        <View style={ms.cardBody}>
          <View style={ms.cardTitleRow}>
            <Text style={ms.deviceName} numberOfLines={1}>
              {session.device_name}
            </Text>
            {session.is_current ? (
              <View style={ms.badge}>
                <MaterialCommunityIcons name="check-circle" size={10} color="#fff" />
                <Text style={ms.badgeText}>{t('settings.sessions.current')}</Text>
              </View>
            ) : null}
          </View>
          <View style={ms.lastActiveRow}>
            <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textMuted} />
            <Text style={ms.lastActiveText} numberOfLines={1}>
              {t('settings.sessions.lastActive')}: {lastActive}
            </Text>
          </View>
        </View>
        <View style={ms.cardActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.sessions.viewDetails')}
            onPress={onOpenDetails}
            style={({ pressed }) => [
              ms.iconBtn,
              ms.iconBtnPrimary,
              pressed && ms.iconBtnPressed,
            ]}>
            <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />
          </Pressable>
          {!session.is_current ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.sessions.terminateSession')}
              disabled={actionsDisabled}
              onPress={() => onLogoutPress(session)}
              style={({ pressed }) => [
                ms.iconBtn,
                ms.iconBtnDanger,
                pressed && !actionsDisabled && ms.iconBtnPressed,
                actionsDisabled && ms.iconBtnDisabled,
              ]}>
              {thisLogoutLoading ? (
                <ActivityIndicator size="small" color="#e11d48" />
              ) : (
                <MaterialCommunityIcons name="logout" size={18} color="#e11d48" />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
