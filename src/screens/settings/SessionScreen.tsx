import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HeaderBackButton } from '@react-navigation/elements';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchActiveSessions } from '@src/api/fetchActiveSessions';
import { logoutAllOtherSessions } from '@src/api/logoutAllOtherSessions';
import { logoutSession } from '@src/api/logoutSession';
import { reverseGeocode } from '@src/api/nominatimReverseGeocode';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { SessionDetails } from '@src/components/modals/SessionDetails';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { localeTagForFormatting } from '@src/i18n/types';
import type { SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { ActiveSession } from '@src/types/activeSessions';
import { readApiError } from '@src/utils/readApiError';
import { formatSessionDateTime } from '@src/utils/sessionDateFormat';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Sessions'>;

function buildSessionStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
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
      fontWeight: '600',
      color: colors.text,
      marginLeft: 2,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 32,
    },
    centerBox: {
      paddingVertical: 48,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
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
      paddingHorizontal: 12,
    },
    retryBtn: {
      marginTop: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryLabel: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 16,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
    },
    cardCurrent: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? '#1e293b' : '#eff6ff',
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 8,
    },
    deviceName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.primary,
      flexShrink: 0,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#fff',
      textTransform: 'uppercase',
    },
    cardLocation: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 8,
      lineHeight: 20,
    },
    cardLocationMuted: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 8,
      lineHeight: 20,
    },
    cardMeta: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 4,
      lineHeight: 18,
    },
    cardActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 10,
    },
    actionBtn: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    actionBtnPressed: {
      opacity: 0.88,
      backgroundColor: colors.secondaryButton,
    },
    actionBtnPrimary: {
      borderColor: colors.primary,
    },
    actionBtnDanger: {
      borderColor: colors.danger,
    },
    actionBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    actionBtnTextDanger: {
      color: colors.danger,
    },
    logoutOthersBlock: {
      marginBottom: 20,
    },
    logoutOthersBtn: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    logoutOthersBtnPressed: {
      opacity: 0.88,
      backgroundColor: colors.secondaryButton,
    },
    logoutOthersBtnDisabled: {
      opacity: 0.55,
    },
    logoutOthersBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.danger,
    },
  });
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
  const [placeLabels, setPlaceLabels] = useState<
    Record<string, string | null | 'pending'>
  >({});

  const hasOtherSessions = useMemo(
    () => sessions.some(s => !s.is_current),
    [sessions],
  );

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

  useEffect(() => {
    if (sessions.length === 0) {
      setPlaceLabels({});
      return;
    }
    const byKey = new Map<string, { lat: string; lon: string }>();
    for (const s of sessions) {
      const geo = readSessionGeocode(s);
      if (!geo) {
        continue;
      }
      byKey.set(geo.key, { lat: geo.lat, lon: geo.lon });
    }

    setPlaceLabels(prev => {
      const next: Record<string, string | null | 'pending'> = {};
      byKey.forEach((_, key) => {
        const existing = prev[key];
        next[key] =
          existing !== undefined && existing !== 'pending' ? existing : 'pending';
      });
      return next;
    });

    byKey.forEach(({ lat, lon }, key) => {
      void reverseGeocode(lat, lon).then(label => {
        setPlaceLabels(p => ({ ...p, [key]: label }));
      });
    });
  }, [sessions]);

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
    <SafeAreaView style={ms.safe} edges={['top', 'left', 'right', 'bottom']}>
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
      </View>
      {loading ? (
        <View style={[ms.centerBox, ms.fill]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={ms.muted}>{t('settings.sessions.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          style={ms.fill}
          contentContainerStyle={ms.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets>
          {error ? (
            <View style={ms.centerBox}>
              <Text style={ms.error}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void load()}
                style={({ pressed }) => [ms.retryBtn, pressed && { opacity: 0.9 }]}>
                <Text style={ms.retryLabel}>{t('settings.sessions.retry')}</Text>
              </Pressable>
            </View>
          ) : sessions.length === 0 ? (
            <View style={ms.centerBox}>
              <Text style={ms.muted}>{t('settings.sessions.empty')}</Text>
            </View>
          ) : (
            <>
              {hasOtherSessions ? (
                <View style={ms.logoutOthersBlock}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('settings.sessions.logoutOthers')}
                    disabled={logoutOthersSubmitting || logoutOneSubmittingId !== null}
                    onPress={openLogoutOthersConfirm}
                    style={({ pressed }) => [
                      ms.logoutOthersBtn,
                      pressed && !logoutOthersSubmitting && ms.logoutOthersBtnPressed,
                      logoutOthersSubmitting && ms.logoutOthersBtnDisabled,
                    ]}>
                    <Text style={ms.logoutOthersBtnText}>{t('settings.sessions.logoutOthers')}</Text>
                  </Pressable>
                </View>
              ) : null}
              {sessions.map(s => {
                const geo = readSessionGeocode(s);
                return (
                  <SessionCard
                    key={s.id}
                    session={s}
                    ms={ms}
                    localeTag={localeTag}
                    placeLabel={geo ? placeLabels[geo.key] : undefined}
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
      )}
      <SessionDetails
        visible={detailSession !== null}
        session={detailSession}
        onDismiss={() => setDetailSession(null)}
      />
      <ConfirmAlert {...confirmProps} />
    </SafeAreaView>
  );
}

function readSessionGeocode(session: ActiveSession): { key: string; lat: string; lon: string } | null {
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
  return { key: `${latS},${lonS}`, lat: latS, lon: lonS };
}

function SessionCard({
  session,
  ms,
  localeTag,
  placeLabel,
  onOpenDetails,
  onLogoutPress,
  logoutOneSubmittingId,
  logoutOthersSubmitting,
}: {
  session: ActiveSession;
  ms: ReturnType<typeof buildSessionStyles>;
  localeTag: string;
  placeLabel: string | null | 'pending' | undefined;
  onOpenDetails: () => void;
  onLogoutPress: (s: ActiveSession) => void;
  logoutOneSubmittingId: number | null;
  logoutOthersSubmitting: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const geoKey = readSessionGeocode(session)?.key;
  const loginAt = formatSessionDateTime(session.login_at, localeTag);
  const expiresAt = formatSessionDateTime(session.expires_at, localeTag);
  const thisLogoutLoading = logoutOneSubmittingId === session.id;

  let locationText: string | null = null;
  let locationPending = false;
  if (geoKey) {
    if (placeLabel === 'pending' || placeLabel === undefined) {
      locationPending = true;
    } else if (placeLabel === null || placeLabel === '') {
      locationText = t('settings.sessions.locationUnavailable');
    } else {
      locationText = placeLabel;
    }
  }

  return (
    <View style={[ms.card, session.is_current && ms.cardCurrent]}>
      <View style={ms.cardTop}>
        <Text style={ms.deviceName} numberOfLines={2}>
          {session.device_name}
        </Text>
        {session.is_current ? (
          <View style={ms.badge}>
            <Text style={ms.badgeText}>{t('settings.sessions.current')}</Text>
          </View>
        ) : null}
      </View>
      {geoKey ? (
        <Text
          style={locationPending ? ms.cardLocationMuted : ms.cardLocation}
          numberOfLines={3}>
          {locationPending ? t('settings.sessions.locationLoading') : locationText}
        </Text>
      ) : null}
      <Text style={ms.cardMeta}>
        {t('settings.sessions.loginAt')}: {loginAt}
      </Text>
      <Text style={[ms.cardMeta, { marginBottom: 12 }]}>
        {t('settings.sessions.expiresAt')}: {expiresAt}
      </Text>
      <View style={ms.cardActions}>
        {!session.is_current ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.sessions.terminateSession')}
            disabled={logoutOthersSubmitting || thisLogoutLoading}
            onPress={() => onLogoutPress(session)}
            style={({ pressed }) => [
              ms.actionBtn,
              ms.actionBtnDanger,
              pressed && !logoutOthersSubmitting && !thisLogoutLoading && ms.actionBtnPressed,
              (logoutOthersSubmitting || thisLogoutLoading) && { opacity: 0.55 },
            ]}>
            {thisLogoutLoading ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Text style={[ms.actionBtnText, ms.actionBtnTextDanger]}>
                {t('settings.sessions.terminateSession')}
              </Text>
            )}
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.sessions.viewDetails')}
          onPress={onOpenDetails}
          style={({ pressed }) => [ms.actionBtn, ms.actionBtnPrimary, pressed && ms.actionBtnPressed]}>
          <Text style={ms.actionBtnText}>{t('settings.sessions.viewDetails')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
