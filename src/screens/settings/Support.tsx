/**
 * @format
 */
import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IconProps } from 'react-native-vector-icons/Icon';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  TAB_SCREEN_SAFE_AREA_EDGES,
  TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import { SUPPORT } from '@src/utils/config';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Support'>;

type SupportKind = 'sales' | 'support' | 'technical';

type TypeVisual = {
  labelKey: string;
  icon: IconProps['name'];
  accent: string;
  tint: string;
};

const TYPE_VISUALS: Record<SupportKind, TypeVisual> = {
  sales: {
    labelKey: 'settings.supportScreen.types.sales',
    icon: 'briefcase-outline',
    accent: '#2563eb',
    tint: '#dbeafe',
  },
  support: {
    labelKey: 'settings.supportScreen.types.support',
    icon: 'headset',
    accent: '#7c3aed',
    tint: '#ede9fe',
  },
  technical: {
    labelKey: 'settings.supportScreen.types.technical',
    icon: 'wrench-outline',
    accent: '#ea580c',
    tint: '#ffedd5',
  },
};

type ChannelConfig = {
  id: 'email' | 'call' | 'whatsapp';
  titleKey: string;
  hintKey: string;
  icon: IconProps['name'];
  accent: string;
  tint: string;
  actionLabelKey: string;
};

const CHANNELS: ChannelConfig[] = [
  {
    id: 'email',
    titleKey: 'settings.supportScreen.channels.email.title',
    hintKey: 'settings.supportScreen.channels.email.hint',
    icon: 'email-outline',
    accent: '#dc2626',
    tint: '#fee2e2',
    actionLabelKey: 'settings.supportScreen.actions.email',
  },
  {
    id: 'call',
    titleKey: 'settings.supportScreen.channels.call.title',
    hintKey: 'settings.supportScreen.channels.call.hint',
    icon: 'phone-outline',
    accent: '#059669',
    tint: '#d1fae5',
    actionLabelKey: 'settings.supportScreen.actions.call',
  },
  {
    id: 'whatsapp',
    titleKey: 'settings.supportScreen.channels.whatsapp.title',
    hintKey: 'settings.supportScreen.channels.whatsapp.hint',
    icon: 'whatsapp',
    accent: '#16a34a',
    tint: '#dcfce7',
    actionLabelKey: 'settings.supportScreen.actions.whatsapp',
  },
];

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Ordered fallbacks — try `openURL` directly (Android 11+ blocks `canOpenURL` without manifest queries). */
function buildLinkCandidates(channel: ChannelConfig['id'], value: string): string[] {
  const trimmed = value.trim();
  switch (channel) {
    case 'email':
      return [`mailto:${trimmed}`];
    case 'call':
      return [`tel:${trimmed.replace(/\s/g, '')}`];
    case 'whatsapp': {
      const digits = normalizePhoneDigits(trimmed);
      return [`whatsapp://send?phone=${digits}`, `https://wa.me/${digits}`];
    }
    default:
      return [trimmed];
  }
}

async function openSupportChannel(
  channel: ChannelConfig['id'],
  value: string,
  onError: () => void,
): Promise<void> {
  const candidates = buildLinkCandidates(channel, value);
  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      /* try next scheme */
    }
  }
  onError();
}

function getChannelValue(
  channel: ChannelConfig['id'],
  type: SupportKind,
): string | undefined {
  if (channel === 'email') {
    return SUPPORT.email.find(e => e.type === type)?.email;
  }
  if (channel === 'call') {
    return SUPPORT.call.find(c => c.type === type)?.call;
  }
  return SUPPORT.whatsapp.find(w => w.type === type)?.whatsapp;
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    fill: { flex: 1 },
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
      paddingTop: 16,
      paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
    },
    hero: {
      borderRadius: 18,
      padding: 20,
      marginBottom: 22,
      overflow: 'hidden',
      backgroundColor: '#4f46e5',
      ...Platform.select({
        ios: {
          shadowColor: '#312e81',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: scheme === 'dark' ? 0.45 : 0.28,
          shadowRadius: 14,
        },
        android: { elevation: 4 },
      }),
    },
    heroOrb: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(255,255,255,0.12)',
      top: -36,
      right: -24,
    },
    heroOrbSmall: {
      position: 'absolute',
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(255,255,255,0.1)',
      bottom: -20,
      left: 12,
    },
    heroIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: '#fff',
      marginBottom: 6,
    },
    heroSubtitle: {
      fontSize: 14,
      lineHeight: 21,
      color: 'rgba(255,255,255,0.9)',
    },
    channelCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: scheme === 'dark' ? 0.18 : 0.05,
          shadowRadius: 6,
        },
        android: { elevation: 1 },
      }),
    },
    channelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    channelIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    channelTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    channelHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
    },
    contactRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    typeBadge: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactBody: {
      flex: 1,
      minWidth: 0,
    },
    typeLabel: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    contactValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    actionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    actionChipLabel: {
      fontSize: 12,
      fontWeight: '700',
    },
    footerNote: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
  });
}

export function SupportScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const showOpenError = useCallback(() => {
    Alert.alert(
      t('settings.supportScreen.errors.title'),
      t('settings.supportScreen.errors.cannotOpen'),
    );
  }, [t]);

  const openChannel = useCallback(
    (channel: ChannelConfig['id'], value: string) => {
      void openSupportChannel(channel, value, showOpenError);
    },
    [showOpenError],
  );

  const contactTypes = useMemo<SupportKind[]>(() => ['sales', 'support', 'technical'], []);

  return (
    <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('settings.supportScreen.back')}
        />
        <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
          {t('settings.supportScreen.title')}
        </Text>
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroOrb} />
          <View style={styles.heroOrbSmall} />
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="lifebuoy" size={28} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>{t('settings.supportScreen.heroTitle')}</Text>
          <Text style={styles.heroSubtitle}>{t('settings.supportScreen.heroSubtitle')}</Text>
        </View>

        {CHANNELS.map(channel => (
          <View key={channel.id} style={styles.channelCard}>
            <View style={styles.channelHeader}>
              <View style={[styles.channelIcon, { backgroundColor: channel.tint }]}>
                <MaterialCommunityIcons name={channel.icon} size={24} color={channel.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.channelTitle}>{t(channel.titleKey)}</Text>
                <Text style={styles.channelHint}>{t(channel.hintKey)}</Text>
              </View>
            </View>

            {contactTypes.map((type, index) => {
              const value = getChannelValue(channel.id, type);
              if (!value) {
                return null;
              }
              const visual = TYPE_VISUALS[type];

              return (
                <View
                  key={`${channel.id}-${type}`}
                  style={[styles.contactRow, index > 0 && styles.contactRowBorder]}>
                  <View style={[styles.typeBadge, { backgroundColor: visual.tint }]}>
                    <MaterialCommunityIcons name={visual.icon} size={20} color={visual.accent} />
                  </View>
                  <View style={styles.contactBody}>
                    <Text style={[styles.typeLabel, { color: visual.accent }]}>
                      {t(visual.labelKey)}
                    </Text>
                    <Text style={styles.contactValue} numberOfLines={2}>
                      {value}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t(channel.actionLabelKey)}, ${value}`}
                    onPress={() => openChannel(channel.id, value)}
                    style={({ pressed }) => [
                      styles.actionChip,
                      { backgroundColor: channel.tint },
                      pressed && { opacity: 0.85 },
                    ]}>
                    <Text style={[styles.actionChipLabel, { color: channel.accent }]}>
                      {t(channel.actionLabelKey)}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color={channel.accent} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}

        <Text style={styles.footerNote}>{t('settings.supportScreen.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
