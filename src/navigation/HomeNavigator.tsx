import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { HomeStackParamList } from '@src/navigation/types';
import { CompanyListScreen } from '@src/screens/company/CompanyList';
import { StaffListScreen } from '@src/screens/company/StaffList';
import { StaffManagementScreen } from '@src/screens/company/StaffManagement';
import { HomeScreen } from '@src/screens/home/HomeScreen';
import { LeaveRequestScreen } from '@src/screens/home/LeaveRequest';
import { MyCalendarScreen } from '@src/screens/report/Calendar';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen name="MyCalendar" component={MyCalendarScreen} />
      <Stack.Screen name="CompanyList" component={CompanyListScreen} />
      <Stack.Screen name="StaffManagement" component={StaffManagementScreen} />
      <Stack.Screen name="StaffList" component={StaffListScreen} />
    </Stack.Navigator>
  );
}
