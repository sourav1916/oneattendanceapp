import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import { companiesFromProfileRole } from '@src/utils/companiesFromProfileRole';

import { CompanyPicker } from '@src/components/modals/CompanyPicker';

type Props = {
  children: ReactNode;
};

function buildGateStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    loaderOverlay: {
      flex: 1,
      backgroundColor:
        scheme === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(248, 250, 252, 0.96)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    loaderCard: {
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 16,
    },
    loaderLabel: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}

export function CompanySelectionGate({ children }: Props) {
  const {
    hydrated,
    profileRole,
    profileRoleLoading,
    selectedCompany,
    selectCompany,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildGateStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const eligibleCompanies = useMemo(
    () => companiesFromProfileRole(profileRole?.data?.companies ?? {}),
    [profileRole],
  );

  const needsPicker =
    eligibleCompanies.length > 0 &&
    (!selectedCompany ||
      !eligibleCompanies.some(c => c.id === selectedCompany.id));

  const showBlockingLoader =
    hydrated && profileRoleLoading && (profileRole == null || needsPicker);
  const showPicker = hydrated && !profileRoleLoading && needsPicker;

  return (
    <View style={styles.flex}>
      {children}

      <Modal
        transparent
        animationType="fade"
        visible={showBlockingLoader}
        statusBarTranslucent>
        <View
          style={[
            styles.loaderOverlay,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}>
          <View style={styles.loaderCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loaderLabel}>Loading your workspace…</Text>
          </View>
        </View>
      </Modal>

      <CompanyPicker
        visible={showPicker}
        companies={eligibleCompanies}
        onSelectCompany={c => {
          void selectCompany(c);
        }}
      />
    </View>
  );
}
