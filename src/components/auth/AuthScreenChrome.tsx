import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { buildAuthScreenStyles } from '@src/theme/authScreenVisuals';

type Props = {
  children: ReactNode;
};

/** Layered neutral background for login / register screens. */
export function AuthScreenChrome({ children }: Props) {
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const { styles } = buildAuthScreenStyles(colors, resolvedScheme);

  return (
    <View style={styles.flex}>
      <View style={styles.bgDecor} pointerEvents="none">
        <View style={styles.bgBase} />
        <View style={styles.bgGlow} />
        <View style={styles.bgWash} />
      </View>
      {children}
    </View>
  );
}
