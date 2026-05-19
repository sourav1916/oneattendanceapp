import { HeaderBackButton } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { UploadableFile } from '@src/utils/FileUpload';
import { uploadFileToOneSaas } from '@src/utils/FileUpload';
import {
  draftFromSnapshot,
  readProfileData,
  toEditSnapshot,
  type DraftProfile,
} from '@src/utils/profileDisplay';
import {
  buildChangedProfileUpdatePayload,
  onlyDigits,
  partialUserFromUpdatePayload,
  type PictureSubmitState,
  type ProfileEditSnapshot,
  validateProfilePhoneChange,
  validateProfileUpdatePayload,
} from '@src/utils/profileEditForm';
import { readApiError } from '@src/utils/readApiError';
import { resolveMediaUrl } from '@src/utils/resolveMediaUrl';

type Props = NativeStackScreenProps<SettingsStackParamList, 'EditProfile'>;

function buildEditStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
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
    body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 36 },
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

export function EditProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const {
    name: authName,
    email: authEmail,
    profileRole,
    profileRoleUser,
    cachedUserProfile,
    refreshProfileRole,
    applySessionFromProfileUpdate,
  } = useAuth();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const es = useMemo(() => buildEditStyles(colors, resolvedScheme), [colors, resolvedScheme]);
  const { props: confirmProps, present } = useConfirmAlert();
  const { props: statusAlertProps, presentError, presentSuccess } = useStatusAlert();

  const showProfileUpdateSuccess = useCallback(
    (apiMessage: string) => {
      const text = apiMessage.trim() || t('settings.profile.successMessage');
      presentSuccess({
        title: t('settings.profile.successTitle'),
        message: text,
        showMessage: true,
        buttonText: t('settings.profile.successButton'),
        dismissIconA11y: t('settings.profile.successDismissA11y'),
        onAfterDismiss: () => navigation.goBack(),
      });
    },
    [navigation, presentSuccess, t],
  );

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
    };
  }, [authEmail, authName, cachedUserProfile, profileRole?.data?.user, profileRoleUser]);

  const editInitialRef = useRef<ProfileEditSnapshot>(toEditSnapshot(displayProfile));
  const [draft, setDraft] = useState<DraftProfile>(() =>
    draftFromSnapshot(editInitialRef.current),
  );
  const [pendingAvatarFile, setPendingAvatarFile] = useState<UploadableFile | null>(null);
  const [pendingAvatarUploadedUrl, setPendingAvatarUploadedUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarPickSeqRef = useRef(0);
  /** Prevents `useFocusEffect` reset while the image library is open or upload is in flight. */
  const photoSessionActiveRef = useRef(false);
  const [wantsRemovePhoto, setWantsRemovePhoto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    const snap = toEditSnapshot(displayProfile);
    editInitialRef.current = snap;
    setDraft(draftFromSnapshot(snap));
    setPendingAvatarFile(null);
    setPendingAvatarUploadedUrl(null);
    setAvatarUploading(false);
    avatarPickSeqRef.current += 1;
    setWantsRemovePhoto(false);
    setFormError(null);
    setSaving(false);
  }, [displayProfile]);

  useFocusEffect(
    useCallback(() => {
      if (photoSessionActiveRef.current) {
        return;
      }
      resetForm();
    }, [resetForm]),
  );

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
            setFormError(null);
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

  const previewUri = useMemo(() => {
    if (wantsRemovePhoto) {
      return null;
    }
    if (pendingAvatarUploadedUrl?.trim()) {
      return resolveMediaUrl(pendingAvatarUploadedUrl.trim());
    }
    if (pendingAvatarFile?.uri) {
      return pendingAvatarFile.uri;
    }
    const existing = displayProfile.profilePictureUrl.trim();
    return existing ? resolveMediaUrl(existing) : null;
  }, [
    displayProfile.profilePictureUrl,
    pendingAvatarFile,
    pendingAvatarUploadedUrl,
    wantsRemovePhoto,
  ]);

  const choosePhoto = useCallback(async () => {
    setFormError(null);
    photoSessionActiveRef.current = true;
    let pickerResult;
    try {
      pickerResult = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.9,
      });
    } finally {
      photoSessionActiveRef.current = false;
    }
    if (!pickerResult || pickerResult.didCancel || !pickerResult.assets?.length) {
      return;
    }
    const asset = pickerResult.assets[0];
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
    photoSessionActiveRef.current = true;
    try {
      const url = await uploadFileToOneSaas(file);
      if (avatarPickSeqRef.current !== seq) {
        return;
      }
      setPendingAvatarUploadedUrl(url);
      setPendingAvatarFile(null);
    } catch (err) {
      if (avatarPickSeqRef.current !== seq) {
        return;
      }
      const errMsg = readApiError(err);
      setFormError(errMsg);
      presentError({
        title: t('settings.profile.uploadErrorTitle'),
        message: errMsg,
        buttonText: t('settings.profile.successButton'),
        dismissIconA11y: t('settings.profile.uploadErrorDismissA11y'),
      });
    } finally {
      photoSessionActiveRef.current = false;
      if (avatarPickSeqRef.current === seq) {
        setAvatarUploading(false);
      }
    }
  }, [presentError, t]);

  const handleSave = useCallback(async () => {
    const initial = editInitialRef.current;
    setFormError(null);

    const phoneErr = validateProfilePhoneChange(initial, draft);
    if (phoneErr) {
      setFormError(phoneErr);
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
        setFormError(validationErr);
        return;
      }
      if (!payload) {
        setFormError(t('settings.profile.errors.noChanges'));
        return;
      }

      const { user, message } = await updateProfile(payload);
      await applySessionFromProfileUpdate(user ?? partialUserFromUpdatePayload(payload));
      try {
        await refreshProfileRole({ silent: true });
      } catch {
        // Profile was saved; cache patch above + success alert still apply.
      }
      showProfileUpdateSuccess(message);
    } catch (err) {
      setFormError(readApiError(err));
    } finally {
      setSaving(false);
    }
  }, [
    applySessionFromProfileUpdate,
    draft,
    navigation,
    pendingAvatarUploadedUrl,
    refreshProfileRole,
    showProfileUpdateSuccess,
    t,
    wantsRemovePhoto,
  ]);

  const avatarPhotoDirty =
    wantsRemovePhoto ||
    Boolean(pendingAvatarUploadedUrl?.trim()) ||
    Boolean(pendingAvatarFile);
  const otherFieldsDirty =
    draft.name.trim() !== editInitialRef.current.name.trim() ||
    onlyDigits(draft.phoneRaw) !== editInitialRef.current.phoneDigits;
  const draftDirty = otherFieldsDirty || avatarPhotoDirty;
  const saveBlockedByAvatar =
    avatarUploading ||
    (Boolean(pendingAvatarFile) &&
      !pendingAvatarUploadedUrl?.trim() &&
      !wantsRemovePhoto &&
      !otherFieldsDirty);

  return (
    <>
      <SafeAreaView style={es.safe} edges={['top', 'left', 'right']}>
        <View style={es.fill}>
          <View style={es.stackHeader}>
            <HeaderBackButton
              onPress={() => navigation.goBack()}
              tintColor={colors.text}
              label={t('settings.profile.back')}
            />
            <Text style={es.stackHeaderTitle}>{t('settings.profile.modalTitle')}</Text>
          </View>

          <KeyboardAvoidingView
            style={es.fill}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={es.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {formError ? (
                <View style={es.errorBanner}>
                  <Text style={es.errorText}>{formError}</Text>
                </View>
              ) : null}

              <View style={es.photoRow}>
                <View style={es.photoPreview}>
                  {previewUri ? (
                    <Image
                      key={previewUri}
                      source={{ uri: previewUri }}
                      style={es.photoPreviewImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={es.photoPreviewLetter}>
                      {(
                        draft.name.trim()[0] ||
                        displayProfile.email.trim()[0] ||
                        '?'
                      ).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={es.photoActions}>
                  <Pressable
                    onPress={() => {
                      choosePhoto().catch(() => {});
                    }}
                    style={es.secondaryBtn}
                    disabled={avatarUploading}
                    accessibilityRole="button">
                    <Text style={es.secondaryBtnLabel}>
                      {avatarUploading
                        ? t('settings.profile.uploadingPhoto')
                        : t('settings.profile.choosePhoto')}
                    </Text>
                  </Pressable>
                  {(editInitialRef.current.profilePictureUrl ||
                    pendingAvatarFile ||
                    pendingAvatarUploadedUrl) &&
                  !wantsRemovePhoto ? (
                    <Pressable
                      onPress={confirmRemovePhoto}
                      style={[es.secondaryBtn, es.dangerOutlineBtn]}
                      accessibilityRole="button">
                      <Text style={[es.secondaryBtnLabel, es.dangerOutlineLabel]}>
                        {t('settings.profile.removePhoto')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={es.fieldBlock}>
                <Text style={es.label}>{t('settings.profile.nameLabel')}</Text>
                <TextInput
                  style={es.input}
                  value={draft.name}
                  onChangeText={v => {
                    setFormError(null);
                    setDraft(d => ({ ...d, name: v }));
                  }}
                  placeholder={t('settings.profile.namePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={es.fieldBlock}>
                <Text style={es.label}>{t('settings.profile.emailLabel')}</Text>
                <TextInput
                  style={[es.input, { opacity: 0.85 }]}
                  value={displayProfile.email}
                  editable={false}
                  placeholder={t('settings.profile.emailPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={es.fieldBlock}>
                <Text style={es.label}>{t('settings.profile.phoneLabel')}</Text>
                <TextInput
                  style={es.input}
                  value={draft.phoneRaw}
                  onChangeText={v => {
                    setFormError(null);
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
                  es.saveBtn,
                  (!draftDirty || saving || saveBlockedByAvatar) && es.saveBtnDisabled,
                ]}
                disabled={!draftDirty || saving || saveBlockedByAvatar}
                accessibilityRole="button">
                {saving ? <ActivityIndicator color="#fff" /> : null}
                <Text style={es.saveBtnLabel}>
                  {saving ? t('settings.profile.saving') : t('settings.profile.save')}
                </Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>

      <ConfirmAlert {...confirmProps} />
      <StatusAlert {...statusAlertProps} />
    </>
  );
}
