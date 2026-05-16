import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { updateProfile } from '@src/api/updateProfile';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { UploadableFile } from '@src/utils/FileUpload';
import { uploadFileToOneSaas } from '@src/utils/FileUpload';
import {
  buildChangedProfileUpdatePayload,
  onlyDigits,
  type PictureSubmitState,
  type ProfileEditSnapshot,
  validateProfilePhoneChange,
  validateProfileUpdatePayload,
} from '@src/utils/profileEditForm';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Profile'>;

type DisplayProfile = {
  name: string;
  email: string;
  mobile: string;
  profilePictureUrl: string;
};

type DraftProfile = {
  name: string;
  phoneRaw: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
    }
  }
  return '';
}

function readProfileData(user: unknown): DisplayProfile {
  const row = asRecord(user);
  return {
    name: firstString(row?.name),
    email: firstString(row?.email),
    mobile: firstString(row?.mobile, row?.phone, row?.phone_number),
    profilePictureUrl: firstString(
      row?.profile_picture,
      row?.profile_image,
      row?.profile_image_url,
      row?.avatar,
      row?.avatar_url,
      row?.image_url,
      row?.image,
    ),
  };
}

function toEditSnapshot(display: DisplayProfile): ProfileEditSnapshot {
  return {
    name: display.name.trim(),
    email: display.email.trim(),
    phoneDigits: onlyDigits(display.mobile),
    profilePictureUrl: display.profilePictureUrl.trim(),
  };
}

function draftFromSnapshot(s: ProfileEditSnapshot): DraftProfile {
  return {
    name: s.name,
    phoneRaw: s.phoneDigits,
  };
}

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
    rolePill: {
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
      marginBottom: 12,
    },
    rolePillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
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
    loadingRow: { marginTop: 14 },
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
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: scheme === 'dark' ? '#334155' : '#eff6ff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailIconGlyph: { fontSize: 18 },
    detailBody: { flex: 1, minWidth: 0 },
    detailLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 2 },
    detailValue: { fontSize: 15, fontWeight: '600', color: colors.text },
    confirmSuccessIconOuter: {
      alignItems: 'center',
      marginBottom: 6,
    },
    confirmSuccessIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: scheme === 'dark' ? '#14532d' : '#dcfce7',
    },
    confirmSuccessIconGlyph: {
      fontSize: 28,
      color: scheme === 'dark' ? '#4ade80' : '#16a34a',
    },
    modalRoot: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    modalTitle: { fontSize: 17, fontWeight: '600', color: colors.text, flex: 1, marginLeft: 4 },
    modalHeaderSpacer: { width: 72 },
    modalHeaderBtn: { paddingVertical: 8, paddingHorizontal: 10 },
    modalHeaderBtnLabel: { fontSize: 16, color: colors.primary, fontWeight: '600' },
    modalHeaderBtnMuted: { color: colors.textMuted, fontWeight: '600' },
    modalBody: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
    photoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 12,
    },
    photoPreview: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoPreviewImg: { width: '100%', height: '100%' },
    photoPreviewLetter: { fontSize: 22, fontWeight: '700', color: colors.textMuted },
    photoActions: { flex: 1, gap: 8 },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: 'center',
    },
    secondaryBtnLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    dangerOutlineBtn: { borderColor: colors.danger },
    dangerOutlineLabel: { color: colors.danger },
    fieldBlock: { marginBottom: 14 },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      minHeight: Platform.OS === 'ios' ? 48 : 44,
      fontSize: 15,
      color: colors.text,
    },
    errorBanner: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: scheme === 'dark' ? '#450a0a' : '#fef2f2',
      borderWidth: 1,
      borderColor: scheme === 'dark' ? '#7f1d1d' : '#fecaca',
    },
    errorText: { fontSize: 14, color: colors.danger, lineHeight: 20 },
    saveBtn: {
      marginTop: 8,
      marginBottom: 20,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    saveBtnDisabled: { opacity: 0.55 },
    saveBtnLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
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
    refreshProfileRole,
    applySessionFromProfileUpdate,
    applySessionDisplayFromProfile,
  } = useAuth();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const ps = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);
  const { props: confirmProps, present } = useConfirmAlert();

  const displayProfile = useMemo((): DisplayProfile => {
    const user = profileRole?.data?.user;
    const fetched = readProfileData(user);
    const cached = cachedUserProfile;
    return {
      name: fetched.name || cached?.name?.trim() || authName?.trim() || '',
      email: fetched.email || cached?.email?.trim() || authEmail?.trim() || '',
      mobile: fetched.mobile || cached?.phone?.trim() || '',
      profilePictureUrl:
        fetched.profilePictureUrl || cached?.profilePictureUrl?.trim() || '',
    };
  }, [authEmail, authName, cachedUserProfile, profileRole?.data?.user]);

  const [editOpen, setEditOpen] = useState(false);
  const editInitialRef = useRef<ProfileEditSnapshot>(toEditSnapshot(displayProfile));
  const [draft, setDraft] = useState<DraftProfile>(draftFromSnapshot(editInitialRef.current));
  /** Local pick kept after failed upload so preview stays and user can pick again to retry. Cleared on success. */
  const [pendingAvatarFile, setPendingAvatarFile] = useState<UploadableFile | null>(null);
  /** URL returned by upload API immediately after a successful pick. Sent on Save via update-profile. */
  const [pendingAvatarUploadedUrl, setPendingAvatarUploadedUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarPickSeqRef = useRef(0);
  const [wantsRemovePhoto, setWantsRemovePhoto] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const showProfileSkeleton =
    profileRoleLoading && !profileRole?.data?.user && !cachedUserProfile;

  const accountRoleLabel = useMemo(() => {
    const role = profileRole?.role?.trim();
    if (role) {
      return role.replace(/_/g, ' ');
    }
    return t('settings.profile.memberLabel', 'Member');
  }, [profileRole?.role, t]);

  const presentProfileSuccess = useCallback(() => {
    present({
      title: t('settings.profile.successTitle'),
      message: t('settings.profile.successMessage'),
      showMessage: true,
      children: (
        <View style={ps.confirmSuccessIconOuter}>
          <View style={ps.confirmSuccessIconWrap}>
            <Text style={ps.confirmSuccessIconGlyph}>✓</Text>
          </View>
        </View>
      ),
      buttons: [{ text: t('settings.profile.successButton'), variant: 'primary' }],
    });
  }, [present, ps.confirmSuccessIconGlyph, ps.confirmSuccessIconOuter, ps.confirmSuccessIconWrap, t]);

  const confirmRemovePhoto = useCallback(() => {
    present({
      title: t('settings.profile.removePhotoConfirmTitle'),
      message: t('settings.profile.removePhotoConfirmMessage'),
      buttons: [
        { key: 'cancel', text: t('settings.alerts.cancel'), variant: 'secondary' },
        {
          key: 'remove',
          text: t('settings.profile.removePhotoConfirmAction'),
          variant: 'danger',
          onPress: () => {
            setModalError(null);
            avatarPickSeqRef.current += 1;
            setPendingAvatarFile(null);
            setPendingAvatarUploadedUrl(null);
            setAvatarUploading(false);
            setWantsRemovePhoto(true);
          },
        },
      ],
    });
  }, [present, t]);

  const openEdit = useCallback(() => {
    const snap = toEditSnapshot(displayProfile);
    editInitialRef.current = snap;
    setDraft(draftFromSnapshot(snap));
    setPendingAvatarFile(null);
    setPendingAvatarUploadedUrl(null);
    setAvatarUploading(false);
    avatarPickSeqRef.current += 1;
    setWantsRemovePhoto(false);
    setModalError(null);
    setEditOpen(true);
  }, [displayProfile]);

  const closeEdit = useCallback(() => {
    setEditOpen(false);
    setModalError(null);
    setPendingAvatarFile(null);
    setPendingAvatarUploadedUrl(null);
    setAvatarUploading(false);
    avatarPickSeqRef.current += 1;
    setWantsRemovePhoto(false);
    setSaving(false);
  }, []);

  useEffect(() => {
    refreshProfileRole().catch(() => {});
  }, [refreshProfileRole]);

  const modalPreviewUri = useMemo(() => {
    if (wantsRemovePhoto) {
      return null;
    }
    if (pendingAvatarUploadedUrl?.trim()) {
      return pendingAvatarUploadedUrl.trim();
    }
    if (pendingAvatarFile?.uri) {
      return pendingAvatarFile.uri;
    }
    return displayProfile.profilePictureUrl.trim() || null;
  }, [
    displayProfile.profilePictureUrl,
    pendingAvatarFile,
    pendingAvatarUploadedUrl,
    wantsRemovePhoto,
  ]);

  const choosePhoto = useCallback(async () => {
    setModalError(null);
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });
    if (result.didCancel || !result.assets?.length) {
      return;
    }
    const asset = result.assets[0];
    const uri = asset.uri;
    if (!uri) {
      return;
    }
    const mime = asset.type?.trim() || 'image/jpeg';
    const fileName = asset.fileName?.trim() || `profile-${Date.now()}.jpg`;
    const file: UploadableFile = { uri, mimeType: mime, fileName };
    const seq = ++avatarPickSeqRef.current;
    setWantsRemovePhoto(false);
    setPendingAvatarUploadedUrl(null);
    setPendingAvatarFile(file);
    setAvatarUploading(true);
    try {
      const url = await uploadFileToOneSaas(file);
      if (avatarPickSeqRef.current !== seq) {
        return;
      }
      setPendingAvatarUploadedUrl(url);
      setPendingAvatarFile(null);
      present({
        title: t('settings.profile.uploadSuccessTitle'),
        message: t('settings.profile.uploadSuccessMessage'),
        showMessage: true,
        children: (
          <View style={ps.confirmSuccessIconOuter}>
            <View style={ps.confirmSuccessIconWrap}>
              <Text style={ps.confirmSuccessIconGlyph}>✓</Text>
            </View>
          </View>
        ),
        buttons: [{ text: t('settings.profile.successButton'), variant: 'primary' }],
      });
    } catch (err) {
      if (avatarPickSeqRef.current !== seq) {
        return;
      }
      setModalError(readApiError(err));
    } finally {
      if (avatarPickSeqRef.current === seq) {
        setAvatarUploading(false);
      }
    }
  }, [present, ps.confirmSuccessIconGlyph, ps.confirmSuccessIconOuter, ps.confirmSuccessIconWrap, t]);

  const handleSave = useCallback(async () => {
    const initial = editInitialRef.current;
    setModalError(null);

    const phoneErr = validateProfilePhoneChange(initial, draft);
    if (phoneErr) {
      setModalError(phoneErr);
      return;
    }

    setSaving(true);
    try {
      const picture: PictureSubmitState = pendingAvatarUploadedUrl?.trim()
        ? { kind: 'setUrl', url: pendingAvatarUploadedUrl.trim() }
        : wantsRemovePhoto
          ? { kind: 'removed' }
          : { kind: 'unchanged' };

      const payload = buildChangedProfileUpdatePayload(initial, draft, picture);
      const validationErr = validateProfileUpdatePayload(draft, payload);
      if (validationErr) {
        setModalError(validationErr);
        return;
      }
      if (!payload) {
        setModalError(t('settings.profile.errors.noChanges'));
        return;
      }

      const data = await updateProfile(payload);
      await applySessionFromProfileUpdate(data);
      const role = await refreshProfileRole();
      if (role?.data?.user) {
        const synced = readProfileData(role.data.user);
        await applySessionDisplayFromProfile({
          ...(synced.name.trim() ? { name: synced.name.trim() } : {}),
          ...(synced.email.trim() ? { email: synced.email.trim() } : {}),
        });
      }
      closeEdit();
      presentProfileSuccess();
    } catch (err) {
      setModalError(readApiError(err));
    } finally {
      setSaving(false);
    }
  }, [
    applySessionDisplayFromProfile,
    applySessionFromProfileUpdate,
    closeEdit,
    draft,
    pendingAvatarUploadedUrl,
    presentProfileSuccess,
    refreshProfileRole,
    t,
    wantsRemovePhoto,
  ]);

  const displayName = displayProfile.name.trim() || t('settings.profile.title');
  const displayEmail = displayProfile.email.trim();
  const displayPhone = onlyDigits(displayProfile.mobile);
  const initialLetter = (displayName[0] || displayEmail[0] || '?').toUpperCase();
  const showHeroAvatar = Boolean(displayProfile.profilePictureUrl.trim());

  const avatarPhotoDirty =
    wantsRemovePhoto ||
    Boolean(pendingAvatarUploadedUrl?.trim()) ||
    Boolean(pendingAvatarFile);
  const otherFieldsDirty =
    draft.name.trim() !== editInitialRef.current.name.trim() ||
    onlyDigits(draft.phoneRaw) !== editInitialRef.current.phoneDigits;
  const draftDirty = otherFieldsDirty || avatarPhotoDirty;
  /** Block save while a new photo is uploading, or when only a failed photo pick is pending (retry or change other fields to save). */
  const saveBlockedByAvatar =
    avatarUploading ||
    (Boolean(pendingAvatarFile) &&
      !pendingAvatarUploadedUrl?.trim() &&
      !wantsRemovePhoto &&
      !otherFieldsDirty);

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
                    <View style={ps.avatarCircle}>
                      {showHeroAvatar ? (
                        <Image
                          source={{ uri: displayProfile.profilePictureUrl }}
                          style={ps.avatarImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={ps.avatarInitial}>{initialLetter}</Text>
                      )}
                    </View>
                  </View>
                  <View style={ps.rolePill}>
                    <Text style={ps.rolePillText}>{accountRoleLabel}</Text>
                  </View>
                  <Text style={ps.heroName} numberOfLines={2}>
                    {displayName}
                  </Text>
                  <Text style={ps.heroEmail} numberOfLines={1}>
                    {displayEmail || t('settings.profile.emailPlaceholder')}
                  </Text>
                  {displayPhone ? (
                    <Text style={ps.heroPhone} numberOfLines={1}>
                      {displayPhone}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={openEdit}
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
                    <View style={ps.detailIcon}>
                      <Text style={ps.detailIconGlyph}>✉</Text>
                    </View>
                    <View style={ps.detailBody}>
                      <Text style={ps.detailLabel}>{t('settings.profile.emailLabel')}</Text>
                      <Text style={ps.detailValue} numberOfLines={1}>
                        {displayEmail || '—'}
                      </Text>
                    </View>
                  </View>
                  <View style={[ps.detailRow, ps.detailRowBorder]}>
                    <View style={ps.detailIcon}>
                      <Text style={ps.detailIconGlyph}>☎</Text>
                    </View>
                    <View style={ps.detailBody}>
                      <Text style={ps.detailLabel}>{t('settings.profile.phoneLabel')}</Text>
                      <Text style={ps.detailValue} numberOfLines={1}>
                        {displayPhone || '—'}
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>

      <Modal visible={editOpen} animationType="slide" onRequestClose={closeEdit}>
        <SafeAreaView style={ps.modalRoot} edges={['top', 'left', 'right']}>
          <View style={ps.modalHeader}>
            <Pressable
              onPress={closeEdit}
              style={ps.modalHeaderBtn}
              disabled={saving}
              accessibilityRole="button">
              <Text style={[ps.modalHeaderBtnLabel, ps.modalHeaderBtnMuted]}>
                {t('settings.alerts.cancel')}
              </Text>
            </Pressable>
            <Text style={ps.modalTitle}>{t('settings.profile.modalTitle')}</Text>
            <View style={ps.modalHeaderSpacer} />
          </View>

          <KeyboardAvoidingView
            style={ps.fill}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={ps.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {modalError ? (
                <View style={ps.errorBanner}>
                  <Text style={ps.errorText}>{modalError}</Text>
                </View>
              ) : null}

              <View style={ps.photoRow}>
                <View style={ps.photoPreview}>
                  {modalPreviewUri ? (
                    <Image source={{ uri: modalPreviewUri }} style={ps.photoPreviewImg} resizeMode="cover" />
                  ) : (
                    <Text style={ps.photoPreviewLetter}>
                      {(
                        draft.name.trim()[0] ||
                        displayProfile.email.trim()[0] ||
                        '?'
                      ).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={ps.photoActions}>
                  <Pressable
                    onPress={() => {
                      choosePhoto().catch(() => {});
                    }}
                    style={ps.secondaryBtn}
                    disabled={avatarUploading}
                    accessibilityRole="button">
                    <Text style={ps.secondaryBtnLabel}>
                      {avatarUploading ? t('settings.profile.uploadingPhoto') : t('settings.profile.choosePhoto')}
                    </Text>
                  </Pressable>
                  {(editInitialRef.current.profilePictureUrl ||
                    pendingAvatarFile ||
                    pendingAvatarUploadedUrl) &&
                  !wantsRemovePhoto ? (
                    <Pressable
                      onPress={confirmRemovePhoto}
                      style={[ps.secondaryBtn, ps.dangerOutlineBtn]}
                      accessibilityRole="button">
                      <Text style={[ps.secondaryBtnLabel, ps.dangerOutlineLabel]}>
                        {t('settings.profile.removePhoto')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={ps.fieldBlock}>
                <Text style={ps.label}>{t('settings.profile.nameLabel')}</Text>
                <TextInput
                  style={ps.input}
                  value={draft.name}
                  onChangeText={v => {
                    setModalError(null);
                    setDraft(d => ({ ...d, name: v }));
                  }}
                  placeholder={t('settings.profile.namePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={ps.fieldBlock}>
                <Text style={ps.label}>{t('settings.profile.emailLabel')}</Text>
                <TextInput
                  style={[ps.input, { opacity: 0.85 }]}
                  value={displayProfile.email}
                  editable={false}
                  placeholder={t('settings.profile.emailPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={ps.fieldBlock}>
                <Text style={ps.label}>{t('settings.profile.phoneLabel')}</Text>
                <TextInput
                  style={ps.input}
                  value={draft.phoneRaw}
                  onChangeText={v => {
                    setModalError(null);
                    setDraft(d => ({ ...d, phoneRaw: onlyDigits(v) }));
                  }}
                  placeholder={t('settings.profile.phonePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
              </View>

              <Pressable
                onPress={() => {
                  handleSave().catch(() => {});
                }}
                style={[
                  ps.saveBtn,
                  (!draftDirty || saving || saveBlockedByAvatar) && ps.saveBtnDisabled,
                ]}
                disabled={!draftDirty || saving || saveBlockedByAvatar}
                accessibilityRole="button">
                {saving ? <ActivityIndicator color="#fff" /> : null}
                <Text style={ps.saveBtnLabel}>
                  {saving ? t('settings.profile.saving') : t('settings.profile.save')}
                </Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <ConfirmAlert {...confirmProps} />
    </>
  );
}
