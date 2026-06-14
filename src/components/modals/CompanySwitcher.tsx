import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { createCompany } from '@src/api/createCompany';
import { CreateCompany, type CreateCompanyFormPayload } from '@src/components/modals/CreateCompany';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type { StoredSelectedCompany } from '@src/types/company';
import { companiesFromProfileRole } from '@src/utils/companiesFromProfileRole';
import { readApiError } from '@src/utils/readApiError';

const SHEET_HEIGHT_CAP = 560;
const MIN_SHEET_HEIGHT = 220;
const MIN_LIST_HEIGHT = 96;
const SHEET_CHROME_WITH_SEARCH = 200;
const SHEET_CHROME_EMPTY = 140;

type SheetLayout = {
  wrapStyle: ViewStyle;
  sheetMaxHeight: number;
  listMaxHeight: number;
};

function resolveSheetLayout(
  windowHeight: number,
  keyboardHeight: number,
  topInset: number,
  bottomInset: number,
  chromeHeight: number,
): SheetLayout {
  const keyboardOpen = keyboardHeight > 0;
  const topGap = topInset + 8;
  const keyboardGap = 8;

  if (keyboardOpen) {
    const spaceAboveKeyboard = windowHeight - keyboardHeight - keyboardGap;
    const sheetMaxHeight = Math.max(
      MIN_SHEET_HEIGHT,
      Math.min(SHEET_HEIGHT_CAP, spaceAboveKeyboard - topGap),
    );
    const listMaxHeight = Math.max(
      MIN_LIST_HEIGHT,
      sheetMaxHeight - chromeHeight,
    );

    return {
      wrapStyle: {
        justifyContent: 'flex-start',
        paddingTop: topGap,
        paddingBottom: 0,
      },
      sheetMaxHeight,
      listMaxHeight,
    };
  }

  const sheetMaxHeight = Math.min(
    SHEET_HEIGHT_CAP,
    Math.max(MIN_SHEET_HEIGHT, windowHeight * 0.78),
  );
  const listMaxHeight = Math.max(
    MIN_LIST_HEIGHT,
    sheetMaxHeight - chromeHeight,
  );

  return {
    wrapStyle: {
      justifyContent: 'center',
      paddingTop: 0,
      paddingBottom: Math.max(bottomInset, 16),
    },
    sheetMaxHeight,
    listMaxHeight,
  };
}

function CompanyLogoChip({
  company,
  ms,
}: {
  company: StoredSelectedCompany;
  ms: ReturnType<typeof buildSwitcherStyles>;
}) {
  const letter = company.name.trim()[0]?.toUpperCase() ?? '?';
  if (company.logo_url) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: company.logo_url }}
        style={ms.logo}
      />
    );
  }
  return (
    <View style={[ms.logo, ms.logoPlaceholder]}>
      <Text style={ms.logoLetter}>{letter}</Text>
    </View>
  );
}

function buildSwitcherStyles(
  colors: AppThemeColors,
  scheme: 'light' | 'dark',
  sheetMaxHeight: number,
  listMaxHeight: number,
) {
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
      height: sheetMaxHeight,
      maxHeight: sheetMaxHeight,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingTop: 16,
      paddingBottom: 12,
      overflow: 'hidden',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
      paddingHorizontal: 2,
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
      marginBottom: 12,
      paddingHorizontal: 2,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      backgroundColor: colors.background,
    },
    searchIcon: {
      marginRight: 6,
    },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 15,
      color: colors.text,
    },
    list: {
      flex: 1,
      maxHeight: listMaxHeight,
    },
    listContent: {
      paddingBottom: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 10,
      marginBottom: 6,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    rowSelected: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#eff6ff',
    },
    rowPressed: {
      opacity: 0.92,
    },
    logo: {
      width: 40,
      height: 40,
      borderRadius: 8,
    },
    logoPlaceholder: {
      backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#dbeafe',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoLetter: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    rowHint: {
      marginTop: 2,
      fontSize: 11,
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    rowChevron: {
      fontSize: 20,
      color: colors.textMuted,
      marginRight: 4,
      fontWeight: '300',
    },
    check: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
      marginRight: 6,
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
    emptyWrap: {
      paddingVertical: 20,
      paddingHorizontal: 8,
      alignItems: 'center',
      gap: 16,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
    },
    createBtn: {
      alignSelf: 'stretch',
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    createBtnPressed: {
      opacity: 0.9,
    },
    createBtnLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
  });
}

type Props = {
  visible: boolean;
  /** Current list from auth state (last profile-role / storage-hydrated session). */
  companies: StoredSelectedCompany[];
  selectedId: number | null;
  refreshing?: boolean;
  onSelectCompany: (company: StoredSelectedCompany) => void;
  onClose: () => void;
};

export function CompanySwitcher({
  visible,
  companies,
  selectedId,
  refreshing = false,
  onSelectCompany,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { refreshProfileRole } = useAuth();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [displayCompanies, setDisplayCompanies] = useState(companies);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isEmpty = displayCompanies.length === 0;

  const chromeHeight = isEmpty ? SHEET_CHROME_EMPTY : SHEET_CHROME_WITH_SEARCH;

  const layout = useMemo(
    () =>
      resolveSheetLayout(
        windowHeight,
        keyboardHeight,
        insets.top,
        insets.bottom,
        chromeHeight,
      ),
    [chromeHeight, insets.bottom, insets.top, keyboardHeight, windowHeight],
  );

  const ms = useMemo(
    () => buildSwitcherStyles(colors, resolvedScheme, layout.sheetMaxHeight, layout.listMaxHeight),
    [colors, layout.listMaxHeight, layout.sheetMaxHeight, resolvedScheme],
  );
  const { props: statusAlertProps, presentSuccess, presentError } = useStatusAlert();

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return displayCompanies;
    }
    return displayCompanies.filter(c =>
      c.name.trim().toLowerCase().includes(q),
    );
  }, [displayCompanies, searchQuery]);

  const relationLabel = useCallback(
    (relation: StoredSelectedCompany['relation']) =>
      relation === 'owned' ? t('modals.company.owner') : t('modals.company.employee'),
    [t],
  );

  useEffect(() => {
    if (visible) {
      setDisplayCompanies(companies);
      setSearchQuery('');
    } else {
      setKeyboardHeight(0);
    }
  }, [visible, companies]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const openCreateCompany = useCallback(() => {
    setCreateOpen(true);
    onClose();
  }, [onClose]);

  const handleCreateSubmit = useCallback(
    async (payload: CreateCompanyFormPayload) => {
      const res = await createCompany(payload);
      if (!res.success) {
        throw new Error(
          res.message?.trim() || t('home.companyList.createModal.errors.createFailed'),
        );
      }

      const role = await refreshProfileRole({ silent: true });
      const next = companiesFromProfileRole(role?.data?.companies ?? {});
      const nameKey = payload.name.trim().toLowerCase();
      const match =
        next.find(c => c.name.trim().toLowerCase() === nameKey) ??
        next.find(c => c.relation === 'owned') ??
        next[0];

      if (match) {
        onSelectCompany(match);
      }

      presentSuccess({
        title: t('home.companyList.createModal.successTitle'),
        message: res.message?.trim() || t('home.companyList.createModal.successTitle'),
        showMessage: true,
        buttonText: t('settings.alerts.ok'),
      });
    },
    [onSelectCompany, presentSuccess, refreshProfileRole, t],
  );

  const onCreateSubmit = useCallback(
    (payload: CreateCompanyFormPayload) => {
      return handleCreateSubmit(payload).catch((e: unknown) => {
        presentError({
          title: t('home.companyList.createModal.title'),
          message:
            e instanceof Error && e.message
              ? e.message
              : readApiError(e) || t('home.companyList.createModal.errors.createFailed'),
          buttonText: t('settings.alerts.ok'),
        });
        throw e;
      });
    },
    [handleCreateSubmit, presentError, t],
  );

  return (
    <>
      <Modal
        animationType="fade"
        transparent
        statusBarTranslucent
        visible={visible}
        onRequestClose={onClose}>
        <SafeAreaView style={ms.safe} edges={['top', 'left', 'right']}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('modals.companySwitcher.closeList')}
            style={ms.backdrop}
            onPress={onClose}
          />
          <View style={[ms.sheetWrap, layout.wrapStyle]} pointerEvents="box-none">
            <View style={ms.sheet} pointerEvents="auto">
              <View style={ms.titleRow}>
                <Text style={ms.title} accessibilityRole="header">
                  {t('home.companySwitcher.title')}
                </Text>
                {refreshing ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    accessibilityLabel={t('modals.companySwitcher.updating')}
                  />
                ) : null}
              </View>

              {!isEmpty ? (
                <Text style={ms.subtitle}>{t('home.companySwitcher.subtitle')}</Text>
              ) : null}

              {!isEmpty ? (
                <View style={ms.searchWrap}>
                  <MaterialCommunityIcons
                    name="magnify"
                    size={20}
                    color={colors.textMuted}
                    style={ms.searchIcon}
                  />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={t('home.companySwitcher.searchPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    style={ms.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : undefined}
                    accessibilityLabel={t('home.companySwitcher.searchPlaceholder')}
                  />
                </View>
              ) : null}

              <FlatList
                data={filteredCompanies}
                keyExtractor={item => `switch-${item.id}-${item.relation}`}
                style={ms.list}
                contentContainerStyle={ms.listContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                extraData={`${searchQuery}-${keyboardHeight}`}
                ListEmptyComponent={
                  !refreshing ? (
                    isEmpty ? (
                      <View style={ms.emptyWrap}>
                        <Text style={ms.emptyTitle}>{t('home.companySwitcher.emptyTitle')}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('home.companySwitcher.createCompany')}
                          onPress={openCreateCompany}
                          style={({ pressed }) => [
                            ms.createBtn,
                            pressed && ms.createBtnPressed,
                          ]}>
                          <Text style={ms.createBtnLabel}>
                            {t('home.companySwitcher.createCompany')}
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={ms.emptyWrap}>
                        <Text style={ms.emptyTitle}>
                          {t('home.companySwitcher.emptySearch')}
                        </Text>
                      </View>
                    )
                  ) : null
                }
                renderItem={({ item }) => {
                  const selected = item.id === selectedId;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={
                        selected
                          ? `${t('modals.company.selectedPrefix')}${t('modals.company.companyRow', { name: item.name })}`
                          : t('modals.company.companyRow', { name: item.name })
                      }
                      onPress={() => {
                        onSelectCompany(item);
                        onClose();
                      }}
                      style={({ pressed }) => [
                        ms.row,
                        selected && ms.rowSelected,
                        pressed && ms.rowPressed,
                      ]}>
                      <CompanyLogoChip company={item} ms={ms} />
                      <View style={ms.rowText}>
                        <Text style={ms.rowTitle} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={ms.rowHint} numberOfLines={1}>
                          {relationLabel(item.relation)}
                        </Text>
                      </View>
                      {selected ? (
                        <Text style={ms.check}>✓</Text>
                      ) : (
                        <Text style={ms.rowChevron}>›</Text>
                      )}
                    </Pressable>
                  );
                }}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('modals.common.close')}
                onPress={onClose}
                style={({ pressed }) => [ms.cancelBtn, pressed && ms.cancelBtnPressed]}>
                <Text style={ms.cancelText}>{t('settings.alerts.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <CreateCompany
        visible={createOpen}
        onDismiss={() => setCreateOpen(false)}
        onSubmit={onCreateSubmit}
      />
      <StatusAlert {...statusAlertProps} />
    </>
  );
}
