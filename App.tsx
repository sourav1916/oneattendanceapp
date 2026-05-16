/**
 * @format
 */

import '@src/i18n';

import {
  NavigationContainer,
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from '@react-navigation/native';
import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@src/context/AuthContext';
import { ThemeProvider, useAppTheme } from '@src/context/ThemeContext';
import { hydrateLanguageFromPreference } from '@src/i18n';
import { AuthNavigator } from '@src/navigation/AuthNavigator';
import { MainNavigator } from '@src/navigation/MainNavigator';

function RootNavigation() {
  const { hydrated, token } = useAuth();
  const { colors, resolvedScheme } = useAppTheme();
  const isDark = resolvedScheme === 'dark';

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {!hydrated ? (
        <View style={[styles.boot, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : token ? (
        <MainNavigator />
      ) : (
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}>
          <AuthNavigator />
        </KeyboardAvoidingView>
      )}
    </>
  );
}

function ThemedNavigation() {
  const { resolvedScheme, colors } = useAppTheme();
  const navTheme = useMemo(() => {
    const base =
      resolvedScheme === 'dark' ? NavigationDarkTheme : NavigationDefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    };
  }, [resolvedScheme, colors]);

  return (
    <NavigationContainer theme={navTheme}>
      <RootNavigation />
    </NavigationContainer>
  );
}

function AppBody() {
  const { colors } = useAppTheme();

  useEffect(() => {
    void hydrateLanguageFromPreference();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AuthProvider>
        <ThemedNavigation />
      </AuthProvider>
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppBody />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;
