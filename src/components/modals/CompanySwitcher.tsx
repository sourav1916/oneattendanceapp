import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type { StoredSelectedCompany } from '@src/types/company';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.78, 560);

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

function buildSwitcherStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
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
      maxHeight: SHEET_MAX_HEIGHT,
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
    list: {
      flexGrow: 0,
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
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const ms = useMemo(() => buildSwitcherStyles(colors, resolvedScheme), [colors, resolvedScheme]);

  const [displayCompanies, setDisplayCompanies] = useState(companies);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setDisplayCompanies(companies);
  }, [visible, companies]);

  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      visible={visible}
      onRequestClose={onClose}>
      <SafeAreaView style={ms.safe} edges={['top', 'right', 'left', 'bottom']}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close company list"
          style={ms.backdrop}
          onPress={onClose}
        />
        <View style={ms.sheetWrap} pointerEvents="box-none">
          <View style={ms.sheet}>
            <View style={ms.titleRow}>
              <Text style={ms.title} accessibilityRole="header">
                Your companies
              </Text>
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.primary} accessibilityLabel="Updating companies" />
              ) : null}
            </View>
            <Text style={ms.subtitle}>Tap one to switch the active workspace.</Text>
            <FlatList
              data={displayCompanies}
              keyExtractor={item => `switch-${item.id}-${item.relation}`}
              style={ms.list}
              contentContainerStyle={ms.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = item.id === selectedId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${selected ? 'Selected, ' : ''}Company ${item.name}`}
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
                        {item.relation === 'owned' ? 'Owner' : 'Employee'}
                        {item.role ? ` • ${item.role}` : ''}
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
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ pressed }) => [ms.cancelBtn, pressed && ms.cancelBtnPressed]}>
              <Text style={ms.cancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
