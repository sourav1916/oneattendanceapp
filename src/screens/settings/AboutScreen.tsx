import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Image,
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

import { ABOUT_APP, ABOUT_APP_FEATURES } from '@src/constants/aboutApp';
import {
    TAB_SCREEN_SAFE_AREA_EDGES,
    TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';

type Props = NativeStackScreenProps<SettingsStackParamList, 'About'>;

type LinkRowConfig = {
    id: string;
    icon: IconProps['name'];
    labelKey: string;
    value: string;
    accent: string;
    tint: string;
    url: string;
};

function formatAddress(): string {
    const { line1, line2, state, postalCode, country } = ABOUT_APP.address;
    const cityLine = [line2, state, postalCode].filter(Boolean).join(', ');
    return [line1, cityLine, country].filter(Boolean).join('\n');
}

function formatVersionLabel(): string {
    const base = `v${ABOUT_APP.appVersion}`;
    const build = ABOUT_APP.appBuildNumber.trim();
    return build ? `${base} (${build})` : base;
}

function formatCopyrightYear(): string {
    const start = ABOUT_APP.copyrightStartYear;
    const current = new Date().getFullYear();
    return start === current ? `${current}` : `${start}–${current}`;
}

async function openExternalUrl(url: string, onError: () => void): Promise<void> {
    try {
        await Linking.openURL(url);
    } catch {
        onError();
    }
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
    const isDark = scheme === 'dark';
    const screenBg = isDark ? colors.background : '#f1f5f9';
    const cardBg = isDark ? colors.surface : '#ffffff';

    return StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: screenBg,
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
            fontWeight: '700',
            color: colors.text,
            marginLeft: 2,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
        },
        hero: {
            alignItems: 'center',
            borderRadius: 22,
            paddingVertical: 28,
            paddingHorizontal: 20,
            marginBottom: 20,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            ...Platform.select({
                ios: {
                    shadowColor: '#0f172a',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: isDark ? 0.22 : 0.08,
                    shadowRadius: 14,
                },
                android: { elevation: 3 },
            }),
        },
        heroGlow: {
            position: 'absolute',
            top: -40,
            right: -30,
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: isDark ? 'rgba(96, 165, 250, 0.12)' : 'rgba(37, 99, 235, 0.08)',
        },
        logoRing: {
            width: 96,
            height: 96,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            backgroundColor: isDark ? '#0f172a' : '#eff6ff',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(96, 165, 250, 0.25)' : 'rgba(37, 99, 235, 0.15)',
        },
        logo: {
            width: 72,
            height: 72,
        },
        appName: {
            fontSize: 24,
            fontWeight: '800',
            color: colors.text,
            letterSpacing: -0.4,
            textAlign: 'center',
        },
        tagline: {
            marginTop: 8,
            fontSize: 14,
            lineHeight: 21,
            color: colors.textMuted,
            textAlign: 'center',
            maxWidth: 300,
        },
        versionBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 14,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: isDark ? 'rgba(51, 65, 85, 0.65)' : '#f8fafc',
            borderWidth: 1,
            borderColor: colors.border,
        },
        versionText: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.primary,
            letterSpacing: 0.3,
        },
        sectionTitle: {
            fontSize: 13,
            fontWeight: '800',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: colors.textMuted,
            marginBottom: 10,
            marginTop: 4,
        },
        introCard: {
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 20,
        },
        introText: {
            fontSize: 15,
            lineHeight: 23,
            color: colors.text,
        },
        featureGrid: {
            gap: 10,
            marginBottom: 20,
        },
        featureCard: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
        },
        featureIcon: {
            width: 44,
            height: 44,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
        },
        featureBody: {
            flex: 1,
            minWidth: 0,
        },
        featureTitle: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        featureDescription: {
            fontSize: 13,
            lineHeight: 19,
            color: colors.textMuted,
        },
        infoCard: {
            backgroundColor: cardBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 20,
            overflow: 'hidden',
        },
        linkRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 13,
        },
        linkRowBorder: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        linkRowPressed: {
            opacity: 0.88,
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : '#f8fafc',
        },
        linkIcon: {
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        linkBody: {
            flex: 1,
            minWidth: 0,
        },
        linkLabel: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.35,
            marginBottom: 2,
        },
        linkValue: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        linkChevron: {
            opacity: 0.45,
        },
        companyStatIcon: {
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? '#334155' : '#f1f5f9',
        },
        addressBlock: {
            paddingHorizontal: 14,
            paddingBottom: 14,
            paddingTop: 4,
        },
        addressText: {
            fontSize: 14,
            lineHeight: 21,
            color: colors.textMuted,
        },
        footer: {
            alignItems: 'center',
            paddingTop: 4,
            paddingHorizontal: 12,
            gap: 6,
        },
        footerText: {
            fontSize: 13,
            lineHeight: 19,
            color: colors.textMuted,
            textAlign: 'center',
        },
        footerBrand: {
            fontWeight: '700',
            color: colors.text,
        },
    });
}

function FeatureCard({
    icon,
    title,
    description,
    accent,
    tint,
    styles,
    scheme,
}: {
    icon: IconProps['name'];
    title: string;
    description: string;
    accent: string;
    tint: string;
    styles: ReturnType<typeof buildStyles>;
    scheme: 'light' | 'dark';
}) {
    const iconBg = scheme === 'dark' ? `${accent}22` : tint;

    return (
        <View style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: iconBg }]}>
                <MaterialCommunityIcons name={icon} size={22} color={accent} />
            </View>
            <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDescription}>{description}</Text>
            </View>
        </View>
    );
}

function LinkRow({
    row,
    styles,
    scheme,
    onPress,
    showBorder,
}: {
    row: LinkRowConfig;
    styles: ReturnType<typeof buildStyles>;
    scheme: 'light' | 'dark';
    onPress: () => void;
    showBorder: boolean;
}) {
    const { t } = useTranslation();
    const iconBg = scheme === 'dark' ? `${row.accent}22` : row.tint;

    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [
                styles.linkRow,
                showBorder && styles.linkRowBorder,
                pressed && styles.linkRowPressed,
            ]}>
            <View style={[styles.linkIcon, { backgroundColor: iconBg }]}>
                <MaterialCommunityIcons name={row.icon} size={20} color={row.accent} />
            </View>
            <View style={styles.linkBody}>
                <Text style={styles.linkLabel}>{t(row.labelKey)}</Text>
                <Text style={styles.linkValue} numberOfLines={2}>
                    {row.value}
                </Text>
            </View>
            <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color="#94a3b8"
                style={styles.linkChevron}
            />
        </Pressable>
    );
}

export function AboutScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const styles = useMemo(
        () => buildStyles(colors, resolvedScheme),
        [colors, resolvedScheme],
    );

    const showOpenError = useCallback(() => {
        Alert.alert(
            t('settings.aboutScreen.errors.title'),
            t('settings.aboutScreen.errors.cannotOpen'),
        );
    }, [t]);

    const openUrl = useCallback(
        (url: string) => {
            openExternalUrl(url, showOpenError).catch(() => { });
        },
        [showOpenError],
    );

    const companyRows = useMemo<LinkRowConfig[]>(
        () => [
            {
                id: 'website',
                icon: 'web',
                labelKey: 'settings.aboutScreen.company.website',
                value: ABOUT_APP.companyWebsite.replace(/^https?:\/\//, ''),
                accent: '#2563eb',
                tint: '#dbeafe',
                url: ABOUT_APP.companyWebsite,
            },
            {
                id: 'portal',
                icon: 'monitor-dashboard',
                labelKey: 'settings.aboutScreen.company.portal',
                value: ABOUT_APP.productPortalUrl.replace(/^https?:\/\//, ''),
                accent: '#7c3aed',
                tint: '#ede9fe',
                url: ABOUT_APP.productPortalUrl,
            },
            {
                id: 'email',
                icon: 'email-outline',
                labelKey: 'settings.aboutScreen.company.email',
                value: ABOUT_APP.contactEmail,
                accent: '#dc2626',
                tint: '#fee2e2',
                url: `mailto:${ABOUT_APP.contactEmail}`,
            },
            {
                id: 'phone',
                icon: 'phone-outline',
                labelKey: 'settings.aboutScreen.company.phone',
                value: ABOUT_APP.contactPhone,
                accent: '#059669',
                tint: '#d1fae5',
                url: `tel:${ABOUT_APP.contactPhone.replace(/\s/g, '')}`,
            },
        ],
        [],
    );

    const legalRows = useMemo<LinkRowConfig[]>(
        () => [
            {
                id: 'privacy',
                icon: 'shield-lock-outline',
                labelKey: 'settings.aboutScreen.legal.privacy',
                value: t('settings.aboutScreen.legal.openDocument'),
                accent: '#6366f1',
                tint: '#e0e7ff',
                url: ABOUT_APP.legal.privacyPolicyUrl,
            },
            {
                id: 'terms',
                icon: 'file-document-outline',
                labelKey: 'settings.aboutScreen.legal.terms',
                value: t('settings.aboutScreen.legal.openDocument'),
                accent: '#0891b2',
                tint: '#cffafe',
                url: ABOUT_APP.legal.termsOfServiceUrl,
            },
        ],
        [t],
    );

    return (
        <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
            <View style={styles.stackHeader}>
                <HeaderBackButton
                    onPress={() => navigation.goBack()}
                    tintColor={colors.primary}
                    displayMode="minimal"
                    accessibilityLabel={t('settings.aboutScreen.back')}
                />
                <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                    {t('settings.aboutScreen.title')}
                </Text>
            </View>

            <ScrollView
                style={styles.fill}
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <View style={styles.heroGlow} pointerEvents="none" />
                    <View style={styles.logoRing}>
                        <Image
                            accessibilityIgnoresInvertColors
                            source={require('../../assets/images/logo_512x512.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.appName}>{ABOUT_APP.appDisplayName}</Text>
                    <Text style={styles.tagline}>{ABOUT_APP.appTagline}</Text>
                    <View style={styles.versionBadge}>
                        <MaterialCommunityIcons name="tag-outline" size={14} color={colors.primary} />
                        <Text style={styles.versionText}>{formatVersionLabel()}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>{t('settings.aboutScreen.sections.overview')}</Text>
                <View style={styles.introCard}>
                    <Text style={styles.introText}>{t('settings.aboutScreen.overviewBody')}</Text>
                </View>

                <Text style={styles.sectionTitle}>{t('settings.aboutScreen.sections.features')}</Text>
                <View style={styles.featureGrid}>
                    {ABOUT_APP_FEATURES.map(feature => (
                        <FeatureCard
                            key={feature.titleKey}
                            icon={feature.icon}
                            title={t(feature.titleKey)}
                            description={t(feature.descriptionKey)}
                            accent={feature.accent}
                            tint={feature.tint}
                            styles={styles}
                            scheme={resolvedScheme}
                        />
                    ))}
                </View>

                <Text style={styles.sectionTitle}>{t('settings.aboutScreen.sections.company')}</Text>
                <View style={styles.infoCard}>
                    <View style={styles.linkRow}>
                        <View style={styles.companyStatIcon}>
                            <MaterialCommunityIcons name="domain" size={20} color="#64748b" />
                        </View>
                        <View style={styles.linkBody}>
                            <Text style={styles.linkLabel}>{t('settings.aboutScreen.company.legalName')}</Text>
                            <Text style={styles.linkValue}>{ABOUT_APP.companyLegalName}</Text>
                        </View>
                    </View>
                    {companyRows.map(row => (
                        <LinkRow
                            key={row.id}
                            row={row}
                            styles={styles}
                            scheme={resolvedScheme}
                            showBorder
                            onPress={() => openUrl(row.url)}
                        />
                    ))}
                    <View style={[styles.addressBlock, styles.linkRowBorder]}>
                        <Text style={styles.linkLabel}>{t('settings.aboutScreen.company.address')}</Text>
                        <Text style={styles.addressText}>{formatAddress()}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>{t('settings.aboutScreen.sections.legal')}</Text>
                <View style={styles.infoCard}>
                    {legalRows.map((row, index) => (
                        <LinkRow
                            key={row.id}
                            row={row}
                            styles={styles}
                            scheme={resolvedScheme}
                            showBorder={index > 0}
                            onPress={() => openUrl(row.url)}
                        />
                    ))}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        {t('settings.aboutScreen.footer.madeBy', { brand: ABOUT_APP.companyBrandName })}
                    </Text>
                    <Text style={styles.footerText}>
                        © {formatCopyrightYear()}{' '}
                        <Text style={styles.footerBrand}>{ABOUT_APP.companyLegalName}</Text>
                    </Text>
                    <Text style={styles.footerText}>{t('settings.aboutScreen.footer.rights')}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
