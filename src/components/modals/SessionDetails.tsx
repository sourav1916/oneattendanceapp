import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { NominatimReverseJson } from '@src/api/nominatimReverseGeocode';
import { reverseGeocodeFull } from '@src/api/nominatimReverseGeocode';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { localeTagForFormatting } from '@src/i18n/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { ActiveSession } from '@src/types/activeSessions';
import { formatSessionDateTime } from '@src/utils/sessionDateFormat';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.78, 560);

type Props = {
    visible: boolean;
    session: ActiveSession | null;
    onDismiss: () => void;
};

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
            maxWidth: 400,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingTop: 16,
            paddingBottom: 12,
            overflow: 'hidden',
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
            paddingHorizontal: 2,
        },
        subtitle: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 10,
            paddingHorizontal: 2,
        },
        badge: {
            alignSelf: 'flex-start',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: colors.primary,
            marginBottom: 12,
        },
        badgeText: {
            fontSize: 11,
            fontWeight: '700',
            color: '#fff',
            textTransform: 'uppercase',
        },
        scroll: {
            flexGrow: 0,
        },
        scrollContent: {
            paddingBottom: 4,
        },
        row: {
            marginBottom: 12,
        },
        label: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginBottom: 4,
        },
        value: {
            fontSize: 15,
            color: colors.text,
            lineHeight: 22,
        },
        valueMuted: {
            fontSize: 14,
            color: colors.textMuted,
            lineHeight: 20,
        },
        cancelBtn: {
            marginTop: 8,
            paddingVertical: 14,
            alignItems: 'center',
            borderRadius: 12,
        },
        cancelBtnPressed: {
            backgroundColor: colors.secondaryButton,
        },
        cancelText: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.primary,
        },
        mapSection: {
            marginTop: 4,
            padding: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: scheme === 'dark' ? '#0f172a' : colors.background,
        },
        skeletonLine: {
            height: 14,
            borderRadius: 8,
            backgroundColor: scheme === 'dark' ? '#334155' : '#e5e7eb',
            marginBottom: 10,
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

    const parts = sessionCoordParts(session);

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
                    accessibilityLabel={t('settings.sessions.detailsClose')}
                    style={styles.backdrop}
                    onPress={onDismiss}
                />
                <View style={styles.sheetWrap} pointerEvents="box-none">
                    <View style={[styles.sheet, { maxHeight: SHEET_MAX_HEIGHT }]}>
                        <Text style={styles.title} accessibilityRole="header">
                            {t('settings.sessions.detailsTitle')}
                        </Text>
                        <Text style={styles.subtitle} numberOfLines={3}>
                            {session.device_name}
                        </Text>
                        {session.is_current ? (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{t('settings.sessions.current')}</Text>
                            </View>
                        ) : null}

                        <ScrollView
                            style={styles.scroll}
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            automaticallyAdjustKeyboardInsets
                            showsVerticalScrollIndicator={false}
                            showsHorizontalScrollIndicator={false}
                            bounces={false}>
                            <View style={styles.row}>
                                <Text style={styles.label}>{t('settings.sessions.ip')}</Text>
                                <Text style={styles.value}>{session.ip_address}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>{t('settings.sessions.loginAt')}</Text>
                                <Text style={styles.value}>
                                    {formatSessionDateTime(session.login_at, localeTag)}
                                </Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>{t('settings.sessions.lastActive')}</Text>
                                <Text style={styles.value}>
                                    {formatSessionDateTime(session.last_active, localeTag)}
                                </Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>{t('settings.sessions.expiresAt')}</Text>
                                <Text style={styles.value}>
                                    {formatSessionDateTime(session.expires_at, localeTag)}
                                </Text>
                            </View>
                            {parts ? (
                                <View style={styles.row}>
                                    <Text style={styles.label}>{t('settings.sessions.coordinates')}</Text>
                                    <Text style={styles.value}>
                                        {parts.lat}, {parts.lon}
                                    </Text>
                                </View>
                            ) : null}

                            <View style={[styles.row, styles.mapSection]}>
                                <Text style={styles.label}>{t('settings.sessions.location')}</Text>
                                {nominatim === 'loading' ? (
                                    <View>
                                        <Animated.View style={[styles.skeletonLine, { opacity: skeletonOpacity }]} />
                                        <Animated.View
                                            style={[styles.skeletonLine, { opacity: skeletonOpacity, width: '78%' }]}
                                        />
                                    </View>
                                ) : nominatim === 'failed' || !nominatim ? (
                                    <Text style={styles.valueMuted}>{t('settings.sessions.locationUnavailable')}</Text>
                                ) : nominatim.display_name ? (
                                    <Text style={styles.value}>{nominatim.display_name}</Text>
                                ) : (
                                    <Text style={styles.valueMuted}>{t('settings.sessions.locationUnavailable')}</Text>
                                )}
                            </View>
                        </ScrollView>

                        <Pressable
                            accessibilityRole="button"
                            onPress={onDismiss}
                            style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}>
                            <Text style={styles.cancelText}>{t('settings.sessions.detailsClose')}</Text>
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}
