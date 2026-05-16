import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { SettingsStackParamList } from '@src/navigation/types';
import { ChangePasswordScreen } from '@src/screens/auth/ChangePassword';
import { ProfileScreen } from '@src/screens/profile/Profile';
import { SessionScreen } from '@src/screens/settings/SessionScreen';
import { SettingsScreen } from '@src/screens/settings/SettingsScreen';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Sessions" component={SessionScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </Stack.Navigator>
  );
}
