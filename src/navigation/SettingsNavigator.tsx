import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { SettingsStackParamList } from '@src/navigation/types';
import { ChangePasswordScreen } from '@src/screens/auth/ChangePassword';
import { EditProfileScreen } from '@src/screens/profile/EditProfile';
import { ProfileScreen } from '@src/screens/profile/Profile';
import { MyCalendarScreen } from '@src/screens/report/Calendar';
import { AboutScreen } from '@src/screens/settings/AboutScreen';
import { SessionScreen } from '@src/screens/settings/SessionScreen';
import { SettingsScreen } from '@src/screens/settings/SettingsScreen';
import { SubscriptionScreen } from '@src/screens/settings/Subscription';
import { SupportScreen } from '@src/screens/settings/Support';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Sessions" component={SessionScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="MyCalendar" component={MyCalendarScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
    </Stack.Navigator>
  );
}
