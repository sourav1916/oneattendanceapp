import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
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
import type { IconProps } from 'react-native-vector-icons/Icon';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ChangeEmailModal } from '@src/components/modals/ChangeEmailModal';
import { ChangePhoneModal } from '@src/components/modals/ChangePhoneModal';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import { readProfileData } from '@src/utils/profileDisplay';
import { onlyDigits } from '@src/utils/profileEditForm';
import { resolveMediaUrl } from '@src/utils/resolveMediaUrl';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Profile'>;

const CONTACT_ICONS: Record<
  'email' | 'phone' | 'whatsapp' | 'profession',
  { icon: IconProps['name']; accent: string; tint: string }
> = {
  email: { icon: 'email-outline', accent: '#2563eb', tint: '#dbeafe' },
  phone: { icon: 'phone-outline', accent: '#059669', tint: '#d1fae5' },
  whatsapp: { icon: 'whatsapp', accent: '#16a34a', tint: '#dcfce7' },
  profession: { icon: 'briefcase-outline', accent: '#7c3aed', tint: '#ede9fe' },
};

function ProfileHeroSkeleton({ colors }: { colors: AppThemeColors }) {
  const opacity = useRef(new Animated.Value(0.32)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.28, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  const bone = (w: number | `${number}%`, h: number, r: number, mb = 0) => (
    <Animated.View
      style={{
        width: w,
        height: h,
        borderRadius: r,
        marginBottom: mb,
        backgroundColor: colors.border,
        opacity,
      }}
    />
  );
  return (
    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
      {bone(112, 112, 56, 18)}
      {bone('72%', 22, 8, 10)}
      {bone('88%', 14, 6, 8)}
      {bone('42%', 14, 6, 22)}
      {bone('100%', 50, 14, 0)}
    </View>
  );
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
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
    scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 },
    sectionEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 10,
      marginLeft: 2,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 24,
      paddingTop: 22,
      paddingBottom: 22,
      paddingHorizontal: 20,
      marginBottom: 16,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: scheme === 'dark' ? 0.4 : 0.1,
          shadowRadius: 20,
        },
        android: { elevation: 4 },
      }),
    },
    heroAccent: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
      opacity: 0.85,
      marginBottom: 18,
    },
    avatarRing: {
      padding: 4,
      borderRadius: 60,
      borderWidth: 2,
      borderColor: scheme === 'dark' ? `${colors.primary}55` : `${colors.primary}44`,
      marginBottom: 16,
    },
    avatarPressable: {
      borderRadius: 60,
    },
    avatarCircle: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarInitial: { color: '#fff', fontSize: 38, fontWeight: '700' },
    heroName: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6, textAlign: 'center' },
    heroEmail: { fontSize: 15, color: colors.textMuted, marginBottom: 4, textAlign: 'center' },
    heroPhone: { fontSize: 15, color: colors.textMuted, textAlign: 'center' },
    editBtn: {
      marginTop: 20,
      minHeight: 50,
      paddingHorizontal: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
    },
    editBtnLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
    detailCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 4,
      marginBottom: 12,
      overflow: 'hidden',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 14,
    },
    detailRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    detailIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center',
    },
    previewClose: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 12 : 8,
      right: 16,
      zIndex: 2,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    detailBody: { flex: 1, minWidth: 0 },
    detailLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 2 },
    detailValue: { fontSize: 15, fontWeight: '600', color: colors.text },
    detailChangeBtn: {
      paddingVertical: 6,
      paddingHorizontal: 4,
      marginLeft: 4,
    },
    detailChangeLink: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}

export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const {
    name: authName,
    email: authEmail,
    profileRole,
    profileRoleLoading,
    cachedUserProfile,
    profileRoleUser,
    refreshProfileRole,
  } = useAuth();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const ps = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);

  const displayProfile = useMemo(() => {
    const user = profileRole?.data?.user ?? profileRoleUser;
    const fetched = readProfileData(user);
    const cached = cachedUserProfile;
    return {
      name: fetched.name || cached?.name?.trim() || authName?.trim() || '',
      email: fetched.email || cached?.email?.trim() || authEmail?.trim() || '',
      mobile: fetched.mobile || cached?.phone?.trim() || '',
      profilePictureUrl:
        fetched.profilePictureUrl || cached?.profilePictureUrl?.trim() || '',
      profession: fetched.profession,
      whatsapp: fetched.whatsapp,
    };
  }, [authEmail, authName, cachedUserProfile, profileRole?.data?.user, profileRoleUser]);

  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [changePhoneOpen, setChangePhoneOpen] = useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);

  const showProfileSkeleton =
    profileRoleLoading && !profileRole?.data?.user && !cachedUserProfile;

  useEffect(() => {
    refreshProfileRole({ silent: true }).catch(() => {});
  }, [refreshProfileRole]);

  const displayName = displayProfile.name.trim() || t('settings.profile.title');
  const displayEmail = displayProfile.email.trim();
  const displayPhone = onlyDigits(displayProfile.mobile);
  const displayWhatsapp = onlyDigits(displayProfile.whatsapp);
  const displayProfession = displayProfile.profession.trim();
  const initialLetter = (displayName[0] || displayEmail[0] || '?').toUpperCase();
  const heroAvatarUri = resolveMediaUrl(displayProfile.profilePictureUrl);
  const showHeroAvatar = Boolean(heroAvatarUri);

  const openImagePreview = useCallback(() => {
    if (showHeroAvatar) {
      setImagePreviewOpen(true);
    }
  }, [showHeroAvatar]);

  const closeImagePreview = useCallback(() => {
    setImagePreviewOpen(false);
  }, []);

  return (
    <>
      <SafeAreaView style={ps.safe} edges={['top', 'left', 'right']}>
        <View style={ps.fill}>
          <View style={ps.stackHeader}>
            <HeaderBackButton
              onPress={() => navigation.goBack()}
              tintColor={colors.text}
              label={t('settings.profile.back')}
            />
            <Text style={ps.stackHeaderTitle}>{t('settings.profile.title')}</Text>
          </View>

          <ScrollView
            contentContainerStyle={ps.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={ps.sectionEyebrow}>{t('settings.profile.accountSection', 'Account')}</Text>

            <View style={[ps.heroCard, { alignItems: 'center' }]}>
              {showProfileSkeleton ? (
                <ProfileHeroSkeleton colors={colors} />
              ) : (
                <>
                  <View style={ps.heroAccent} />
                  <View style={ps.avatarRing}>
                    <Pressable
                      onPress={openImagePreview}
                      disabled={!showHeroAvatar}
                      style={({ pressed }) => [
                        ps.avatarPressable,
                        showHeroAvatar && pressed && { opacity: 0.88 },
                      ]}
                      accessibilityRole={showHeroAvatar ? 'button' : 'image'}
                      accessibilityLabel={
                        showHeroAvatar
                          ? t('settings.profile.previewPhoto', 'Preview profile photo')
                          : undefined
                      }>
                      <View style={ps.avatarCircle}>
                        {showHeroAvatar ? (
                          <Image
                            source={{ uri: heroAvatarUri }}
                            style={ps.avatarImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={ps.avatarInitial}>{initialLetter}</Text>
                        )}
                      </View>
                    </Pressable>
                  </View>
                  <Text style={ps.heroName} numberOfLines={2}>
                    {displayName}
                  </Text>
                  <Text style={ps.heroEmail} numberOfLines={1}>
                    {displayEmail || t('settings.profile.emailPlaceholder')}
                  </Text>
                  {displayProfession ? (
                    <Text style={ps.heroPhone} numberOfLines={1}>
                      {displayProfession}
                    </Text>
                  ) : null}
                  {displayPhone ? (
                    <Text style={ps.heroPhone} numberOfLines={1}>
                      {displayPhone}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => navigation.navigate('EditProfile')}
                    style={ps.editBtn}
                    disabled={profileRoleLoading}
                    accessibilityRole="button">
                    <Text style={ps.editBtnLabel}>{t('settings.profile.editProfile')}</Text>
                  </Pressable>
                </>
              )}
            </View>

            {!showProfileSkeleton ? (
              <>
                <Text style={ps.sectionEyebrow}>
                  {t('settings.profile.detailsSection', 'Contact details')}
                </Text>
                <View style={ps.detailCard}>
                  <View style={ps.detailRow}>
                    <View
                      style={[
                        ps.detailIcon,
                        { backgroundColor: CONTACT_ICONS.email.tint },
                      ]}>
                      <MaterialCommunityIcons
                        name={CONTACT_ICONS.email.icon}
                        size={24}
                        color={CONTACT_ICONS.email.accent}
                      />
                    </View>
                    <View style={ps.detailBody}>
                      <Text style={ps.detailLabel}>{t('settings.profile.emailLabel')}</Text>
                      <Text style={ps.detailValue} numberOfLines={1}>
                        {displayEmail || '—'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setChangeEmailOpen(true)}
                      style={({ pressed }) => [ps.detailChangeBtn, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.profile.changeEmailA11y')}>
                      <Text style={ps.detailChangeLink}>
                        {t('settings.profile.changeEmailLink')}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={[ps.detailRow, ps.detailRowBorder]}>
                    <View
                      style={[
                        ps.detailIcon,
                        { backgroundColor: CONTACT_ICONS.phone.tint },
                      ]}>
                      <MaterialCommunityIcons
                        name={CONTACT_ICONS.phone.icon}
                        size={24}
                        color={CONTACT_ICONS.phone.accent}
                      />
                    </View>
                    <View style={ps.detailBody}>
                      <Text style={ps.detailLabel}>{t('settings.profile.phoneLabel')}</Text>
                      <Text style={ps.detailValue} numberOfLines={1}>
                        {displayPhone || '—'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setChangePhoneOpen(true)}
                      style={({ pressed }) => [ps.detailChangeBtn, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.profile.changePhoneA11y')}>
                      <Text style={ps.detailChangeLink}>
                        {t('settings.profile.changePhoneLink')}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={[ps.detailRow, ps.detailRowBorder]}>
                    <View
                      style={[
                        ps.detailIcon,
                        { backgroundColor: CONTACT_ICONS.whatsapp.tint },
                      ]}>
                      <MaterialCommunityIcons
                        name={CONTACT_ICONS.whatsapp.icon}
                        size={24}
                        color={CONTACT_ICONS.whatsapp.accent}
                      />
                    </View>
                    <View style={ps.detailBody}>
                      <Text style={ps.detailLabel}>{t('settings.profile.whatsappLabel')}</Text>
                      <Text style={ps.detailValue} numberOfLines={1}>
                        {displayWhatsapp || '—'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => navigation.navigate('EditProfile')}
                      style={({ pressed }) => [ps.detailChangeBtn, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.profile.changeWhatsappA11y')}>
                      <Text style={ps.detailChangeLink}>
                        {t('settings.profile.changePhoneLink')}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={[ps.detailRow, ps.detailRowBorder]}>
                    <View
                      style={[
                        ps.detailIcon,
                        { backgroundColor: CONTACT_ICONS.profession.tint },
                      ]}>
                      <MaterialCommunityIcons
                        name={CONTACT_ICONS.profession.icon}
                        size={24}
                        color={CONTACT_ICONS.profession.accent}
                      />
                    </View>
                    <View style={ps.detailBody}>
                      <Text style={ps.detailLabel}>{t('settings.profile.professionLabel')}</Text>
                      <Text style={ps.detailValue} numberOfLines={1}>
                        {displayProfession || '—'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => navigation.navigate('EditProfile')}
                      style={({ pressed }) => [ps.detailChangeBtn, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.profile.changeProfessionA11y')}>
                      <Text style={ps.detailChangeLink}>
                        {t('settings.profile.changePhoneLink')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>

      <Modal
        visible={imagePreviewOpen}
        animationType="fade"
        transparent
        onRequestClose={closeImagePreview}>
        <Pressable style={ps.previewBackdrop} onPress={closeImagePreview}>
          <SafeAreaView style={ps.fill} edges={['top', 'bottom']}>
            <Pressable
              style={ps.previewClose}
              onPress={closeImagePreview}
              accessibilityRole="button"
              accessibilityLabel={t('settings.profile.closePreview', 'Close preview')}>
              <MaterialCommunityIcons name="close" size={26} color="#fff" />
            </Pressable>
            <Pressable style={ps.fill} onPress={e => e.stopPropagation()}>
              <Image
                source={{ uri: heroAvatarUri }}
                style={ps.previewImage}
                resizeMode="contain"
                accessibilityRole="image"
              />
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Modal>

      <ChangeEmailModal
        visible={changeEmailOpen}
        currentEmail={displayEmail}
        registeredPhoneDigits={displayPhone}
        onDismiss={() => setChangeEmailOpen(false)}
        onRequestAddPhone={() => {
          setChangeEmailOpen(false);
          setChangePhoneOpen(true);
        }}
      />

      <ChangePhoneModal
        visible={changePhoneOpen}
        currentPhoneDigits={displayPhone}
        registeredEmail={displayEmail}
        onDismiss={() => setChangePhoneOpen(false)}
      />
    </>
  );
}
