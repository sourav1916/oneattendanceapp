import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { HomeStackParamList } from '@src/navigation/types';
import { HomeScreen } from '@src/screens/home/HomeScreen';
import { LeaveRequestScreen } from '@src/screens/home/LeaveRequest';
import { StaffManagementScreen } from '@src/screens/company/StaffManagement';
import { StaffListScreen } from '@src/screens/company/StaffList';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen name="StaffManagement" component={StaffManagementScreen} />
      <Stack.Screen name="StaffList" component={StaffListScreen} />
    </Stack.Navigator>
  );
}
