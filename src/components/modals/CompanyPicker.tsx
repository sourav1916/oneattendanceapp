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
  ms: ReturnType<typeof buildPickerStyles>;
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

function buildPickerStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: colors.overlay,
      paddingHorizontal: 20,
    },
    sheet: {
      borderRadius: 16,
      backgroundColor: colors.surface,
      paddingVertical: 20,
      paddingHorizontal: 16,
      maxHeight: '88%',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
        },
        android: { elevation: 8 },
      }),
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 16,
    },
    list: {
      flexGrow: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    rowPressed: {
      opacity: 0.9,
      backgroundColor: colors.secondaryButton,
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 10,
    },
    logoPlaceholder: {
      backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#dbeafe',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoLetter: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    rowHint: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    rowChevron: {
      fontSize: 22,
      color: colors.textMuted,
      marginRight: 4,
      fontWeight: '300',
    },
  });
}

type Props = {
  visible: boolean;
  companies: StoredSelectedCompany[];
  onSelectCompany: (company: StoredSelectedCompany) => void;
};

export function CompanyPicker({ visible, companies, onSelectCompany }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const ms = useMemo(() => buildPickerStyles(colors, resolvedScheme), [colors, resolvedScheme]);

  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      visible={visible}
      onRequestClose={() => {
        /* non-dismissible until selection */
      }}>
      <View style={[ms.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={ms.sheet}>
          <Text style={ms.title}>Select a company</Text>
          <Text style={ms.subtitle}>
            Choose which organization you are working with right now.
          </Text>
          <FlatList
            data={companies}
            keyExtractor={item => `company-${item.id}-${item.relation}`}
            style={ms.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select company ${item.name}`}
                onPress={() => onSelectCompany(item)}
                style={({ pressed }) => [ms.row, pressed && ms.rowPressed]}>
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
                <Text style={ms.rowChevron}>›</Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
