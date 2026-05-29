import { HeaderBackButton } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { deleteEmployeeFaceEnroll } from '@src/api/deleteEmployeeFaceEnroll';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import {
  StatusAlert,
  useStatusAlert,
} from '@src/components/modals/StatusAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useFaceEnrollList } from '@src/hooks/useFaceEnrollList';
import {
  TAB_SCREEN_SAFE_AREA_EDGES,
  TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { FaceEnrollListItem } from '@src/types/faceEnrollList';
import { API_ENDPOINT } from '@src/utils/config';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'FaceEnrollList'>;

const SKELETON_ROWS = 6;
const ACCENT = '#7c3aed';

function resolveProfilePictureUrl(path: string | null): string | null {
  if (path == null || path.trim() === '') {
    return null;
  }
  const p = path.trim();
  if (p.startsWith('http://') || p.startsWith('https://')) {
    return p;
  }
  return `${API_ENDPOINT}${p.startsWith('/') ? '' : '/'}${p}`;
}

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

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const dark = scheme === 'dark';
  const barBg = dark ? '#334155' : colors.secondaryButton;

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
      fontWeight: '700',
      color: colors.text,
      marginLeft: 2,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      marginBottom: 10,
      minHeight: 44,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 10 : 8,
      fontSize: 15,
      color: colors.text,
    },
    clearBtn: { padding: 4 },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: dark ? 0.2 : 0.05,
          shadowRadius: 3,
        },
        android: { elevation: 1 },
      }),
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardMain: { flex: 1, minWidth: 0 },
    avatar: {
      backgroundColor: dark ? 'rgba(124,58,237,0.25)' : '#ede9fe',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarText: { fontWeight: '700', color: ACCENT },
    avatarInitials: { fontWeight: '700', color: ACCENT, fontSize: 16 },
    name: { fontSize: 16, fontWeight: '700', color: colors.text },
    code: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '600',
      color: ACCENT,
    },
    subline: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textMuted,
    },
    badge: {
      alignSelf: 'flex-start',
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeInline: {
      alignSelf: 'flex-start',
      marginTop: 0,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },
    badgeEnrolled: {
      backgroundColor: dark ? 'rgba(34,197,94,0.15)' : '#f0fdf4',
      borderColor: dark ? 'rgba(34,197,94,0.35)' : '#bbf7d0',
    },
    badgePending: {
      backgroundColor: dark ? 'rgba(251,191,36,0.12)' : '#fffbeb',
      borderColor: dark ? 'rgba(251,191,36,0.35)' : '#fde68a',
    },
    badgeText: { fontSize: 11, fontWeight: '700' },
    badgeTextEnrolled: {
      color: dark ? '#4ade80' : '#15803d',
    },
    badgeTextPending: {
      color: dark ? '#fbbf24' : '#b45309',
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      gap: 10,
      flexWrap: 'wrap',
    },
    cardActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
      justifyContent: 'flex-end',
    },
    enrollBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: ACCENT,
    },
    enrollBtnPressed: { opacity: 0.9 },
    enrollBtnLabel: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    checkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: dark ? 'rgba(34,197,94,0.18)' : '#ecfdf5',
      borderWidth: 1,
      borderColor: dark ? 'rgba(74,222,128,0.45)' : '#86efac',
    },
    checkBtnPressed: { opacity: 0.9 },
    checkBtnLabel: {
      color: dark ? '#4ade80' : '#15803d',
      fontSize: 13,
      fontWeight: '700',
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: dark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
      borderWidth: 1,
      borderColor: dark ? 'rgba(248,113,113,0.45)' : '#fecaca',
    },
    deleteBtnPressed: { opacity: 0.9 },
    deleteBtnDisabled: { opacity: 0.5 },
    deleteBtnLabel: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '700',
    },
    centerBox: {
      paddingVertical: 40,
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 24,
    },
    muted: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
    error: {
      fontSize: 14,
      color: colors.danger,
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    retryLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
    footerBox: { paddingVertical: 16, alignItems: 'center' },
    skCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    skRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    skCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: barBg,
    },
    skFill: { flex: 1 },
    skBar: {
      height: 14,
      borderRadius: 7,
      backgroundColor: barBg,
      marginBottom: 8,
    },
    skBarShort: {
      height: 12,
      borderRadius: 6,
      width: '55%',
      backgroundColor: barBg,
    },
    skMeta: {
      marginTop: 12,
      height: 12,
      borderRadius: 6,
      width: '40%',
      backgroundColor: barBg,
    },
  });
}

function FaceEnrollListSkeleton({
  styles,
  count = SKELETON_ROWS,
}: {
  styles: ReturnType<typeof buildStyles>;
  count?: number;
}) {
  const pulse = useRef(new Animated.Value(0.38)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.92,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);

  return (
    <Animated.View style={{ opacity: pulse }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.skCard}>
          <View style={styles.skRow}>
            <View style={styles.skCircle} />
            <View style={styles.skFill}>
              <View style={styles.skBar} />
              <View style={styles.skBarShort} />
            </View>
          </View>
          <View style={styles.skMeta} />
        </View>
      ))}
    </Animated.View>
  );
}

function AvatarView({
  uri,
  name,
  styles,
}: {
  uri: string | null;
  name: string;
  styles: ReturnType<typeof buildStyles>;
}) {
  const sizeStyle = useMemo(
    () => ({ width: 48, height: 48, borderRadius: 24 }),
    [],
  );
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, sizeStyle]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.avatar, sizeStyle]}>
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
    </View>
  );
}

type RowProps = {
  item: FaceEnrollListItem;
  styles: ReturnType<typeof buildStyles>;
  enrolledLabel: string;
  notEnrolledLabel: string;
  setFaceLabel: string;
  checkFaceLabel: string;
  deleteFaceLabel: string;
  deleting: boolean;
  onSetFace?: () => void;
  onCheckFace?: () => void;
  onDeleteFace?: () => void;
};

const FaceEnrollRow = React.memo(function FaceEnrollRow({
  item,
  styles,
  enrolledLabel,
  notEnrolledLabel,
  setFaceLabel,
  checkFaceLabel,
  deleteFaceLabel,
  deleting,
  onSetFace,
  onCheckFace,
  onDeleteFace,
}: RowProps) {
  const uri = resolveProfilePictureUrl(item.profile_picture);
  const contact = item.email?.trim() || item.phone?.trim() || '—';
  const showSetFace = !item.face_enrolled && onSetFace != null;
  const showCheckFace = item.face_enrolled && onCheckFace != null;
  const showDeleteFace = item.face_enrolled && onDeleteFace != null;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <AvatarView uri={uri} name={item.name} styles={styles} />
        <View style={styles.cardMain}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.code} numberOfLines={1}>
            {item.employee_code}
          </Text>
          <Text style={styles.subline} numberOfLines={1}>
            {contact}
          </Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <View
          style={[
            styles.badgeInline,
            item.face_enrolled ? styles.badgeEnrolled : styles.badgePending,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              item.face_enrolled
                ? styles.badgeTextEnrolled
                : styles.badgeTextPending,
            ]}
          >
            {item.face_enrolled ? enrolledLabel : notEnrolledLabel}
          </Text>
        </View>
        {showSetFace ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={setFaceLabel}
            onPress={onSetFace}
            style={({ pressed }) => [
              styles.enrollBtn,
              pressed && styles.enrollBtnPressed,
            ]}
          >
            <MaterialCommunityIcons
              name="face-recognition"
              size={18}
              color="#fff"
            />
            <Text style={styles.enrollBtnLabel}>{setFaceLabel}</Text>
          </Pressable>
        ) : null}
        {showCheckFace || showDeleteFace ? (
          <View style={styles.cardActions}>
            {showCheckFace ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={checkFaceLabel}
                disabled={deleting}
                onPress={onCheckFace}
                style={({ pressed }) => [
                  styles.checkBtn,
                  deleting && styles.deleteBtnDisabled,
                  pressed && !deleting && styles.checkBtnPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="face-recognition"
                  size={18}
                  color={styles.checkBtnLabel.color}
                />
                <Text style={styles.checkBtnLabel}>{checkFaceLabel}</Text>
              </Pressable>
            ) : null}
            {showDeleteFace ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={deleteFaceLabel}
                disabled={deleting}
                onPress={onDeleteFace}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  deleting && styles.deleteBtnDisabled,
                  pressed && !deleting && styles.deleteBtnPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={18}
                  color={styles.deleteBtnLabel.color}
                />
                <Text style={styles.deleteBtnLabel}>{deleteFaceLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
});

export function FaceEnrollListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id ?? null;
  const { props: statusProps, presentError, presentSuccess } = useStatusAlert();
  const { props: confirmProps, present: presentConfirm, dismiss: dismissConfirm } =
    useConfirmAlert();
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<number | null>(
    null,
  );

  const {
    employees,
    loading,
    loadingMore,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    tryLoadMore,
    retry,
  } = useFaceEnrollList({
    companyId,
    onError: useCallback(
      (msg: string) =>
        presentError({
          title: t('home.faceEnrollList.apiError'),
          message: msg,
        }),
      [presentError, t],
    ),
  });

  const skipFocusRefreshRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (skipFocusRefreshRef.current) {
        skipFocusRefreshRef.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );

  const openFaceCapture = useCallback(
    (item: FaceEnrollListItem, captureMode: 'enroll' | 'check') => {
      navigation.navigate('FaceEnrollCapture', {
        employeeId: item.employee_id,
        employeeName: item.name,
        mode: captureMode,
      });
    },
    [navigation],
  );

  const confirmDeleteFace = useCallback(
    (item: FaceEnrollListItem) => {
      if (companyId == null || deletingEmployeeId != null) {
        return;
      }
      presentConfirm({
        title: t('home.faceEnrollList.deleteFaceModal.title'),
        message: t('home.faceEnrollList.deleteFaceModal.message', {
          name: item.name,
        }),
        buttons: [
          {
            text: t('home.faceEnrollList.deleteFaceModal.cancel'),
            variant: 'secondary',
          },
          {
            text: t('home.faceEnrollList.deleteFaceModal.confirm'),
            variant: 'danger',
            closeOnPress: false,
            onPress: () => {
              setDeletingEmployeeId(item.employee_id);
              deleteEmployeeFaceEnroll(companyId, {
                employee_id: item.employee_id,
              })
                .then(res => {
                  if (!res.success) {
                    presentError({
                      title: t('home.faceEnrollList.deleteFaceModal.errorTitle'),
                      message:
                        res.message?.trim() ||
                        t('home.faceEnrollList.apiError'),
                    });
                    return;
                  }
                  presentSuccess({
                    title: t('home.faceEnrollList.deleteFaceModal.successTitle'),
                    message: t(
                      'home.faceEnrollList.deleteFaceModal.successMessage',
                      { name: item.name },
                    ),
                  });
                  refresh();
                })
                .catch(err => {
                  presentError({
                    title: t('home.faceEnrollList.deleteFaceModal.errorTitle'),
                    message: readApiError(err),
                  });
                })
                .finally(() => {
                  setDeletingEmployeeId(null);
                  dismissConfirm();
                });
            },
          },
        ],
      });
    },
    [
      companyId,
      deletingEmployeeId,
      dismissConfirm,
      presentConfirm,
      presentError,
      presentSuccess,
      refresh,
      t,
    ],
  );

  const renderItem = useCallback(
    ({ item }: { item: FaceEnrollListItem }) => (
      <FaceEnrollRow
        item={item}
        styles={styles}
        enrolledLabel={t('home.faceEnrollList.enrolled')}
        notEnrolledLabel={t('home.faceEnrollList.notEnrolled')}
        setFaceLabel={t('home.faceEnrollList.setFace')}
        checkFaceLabel={t('home.faceEnrollList.checkFace')}
        deleteFaceLabel={t('home.faceEnrollList.deleteFace')}
        deleting={deletingEmployeeId === item.employee_id}
        onSetFace={
          item.face_enrolled
            ? undefined
            : () => openFaceCapture(item, 'enroll')
        }
        onCheckFace={
          item.face_enrolled
            ? () => openFaceCapture(item, 'check')
            : undefined
        }
        onDeleteFace={
          item.face_enrolled ? () => confirmDeleteFace(item) : undefined
        }
      />
    ),
    [
      confirmDeleteFace,
      deletingEmployeeId,
      openFaceCapture,
      styles,
      t,
    ],
  );

  const keyExtractor = useCallback(
    (item: FaceEnrollListItem) => String(item.employee_id),
    [],
  );

  const listHeader = useMemo(
    () => (
      <View>
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('home.faceEnrollList.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable
              style={styles.clearBtn}
              onPress={() => setSearch('')}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
        {loading ? <FaceEnrollListSkeleton styles={styles} /> : null}
      </View>
    ),
    [colors.textMuted, loading, search, setSearch, styles, t],
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerBox}>
          <ActivityIndicator color={ACCENT} />
        </View>
      );
    }
    return null;
  }, [loadingMore, styles.footerBox]);

  const listEmpty = useMemo(() => {
    if (loading) {
      return null;
    }
    if (companyId == null) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.muted}>
            {t('home.faceEnrollList.noCompany')}
          </Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={retry}
            accessibilityRole="button"
          >
            <Text style={styles.retryLabel}>
              {t('home.faceEnrollList.retry')}
            </Text>
          </Pressable>
        </View>
      );
    }
    if (employees.length === 0) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons
            name="face-recognition"
            size={40}
            color={colors.textMuted}
          />
          <Text style={styles.muted}>{t('home.faceEnrollList.empty')}</Text>
        </View>
      );
    }
    return null;
  }, [companyId, employees.length, error, loading, retry, styles, t, colors.textMuted]);

  return (
    <SafeAreaView
      style={styles.safe}
      edges={TAB_SCREEN_SAFE_AREA_EDGES}
    >
      <View style={styles.stackHeader}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          tintColor={colors.primary}
          displayMode="minimal"
          accessibilityLabel={t('home.faceEnrollList.back')}
        />
        <Text
          style={styles.stackHeaderTitle}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {t('home.faceEnrollList.title')}
        </Text>
      </View>

      <FlatList
        style={styles.fill}
        contentContainerStyle={styles.listContent}
        data={loading ? [] : employees}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={listEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
        onEndReached={tryLoadMore}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
      <StatusAlert {...statusProps} />
      <ConfirmAlert {...confirmProps} />
    </SafeAreaView>
  );
}
