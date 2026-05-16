import { useMemo } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type { StoredSelectedCompany } from '@src/types/company';

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
    overlay: {
      flex: 1,
      justifyContent: 'flex-start',
      paddingTop: 56,
      backgroundColor: colors.overlay,
      paddingHorizontal: 12,
    },
    sheet: {
      zIndex: 1,
      borderRadius: 14,
      backgroundColor: colors.surface,
      paddingVertical: 14,
      paddingHorizontal: 12,
      maxHeight: '72%',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: { elevation: 10 },
      }),
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
      paddingHorizontal: 6,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
      marginBottom: 12,
      paddingHorizontal: 6,
    },
    list: {
      flexGrow: 0,
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
    closeBtn: {
      marginTop: 8,
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 24,
    },
    closeBtnPressed: {
      opacity: 0.7,
    },
    closeBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}

type Props = {
  visible: boolean;
  companies: StoredSelectedCompany[];
  selectedId: number | null;
  onSelectCompany: (company: StoredSelectedCompany) => void;
  onClose: () => void;
};

export function CompanySwitcher({
  visible,
  companies,
  selectedId,
  onSelectCompany,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const ms = useMemo(() => buildSwitcherStyles(colors, resolvedScheme), [colors, resolvedScheme]);

  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      visible={visible}
      onRequestClose={onClose}>
      <View style={[ms.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close company list"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={ms.sheet}>
          <Text style={ms.title}>Your companies</Text>
          <Text style={ms.subtitle}>Tap one to switch the active workspace.</Text>
          <FlatList
            data={companies}
            keyExtractor={item => `switch-${item.id}-${item.relation}`}
            style={ms.list}
            keyboardShouldPersistTaps="handled"
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
            style={({ pressed }) => [ms.closeBtn, pressed && ms.closeBtnPressed]}>
            <Text style={ms.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
