import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { HomeStackParamList } from '@src/navigation/types';
import { AttendanceManagementScreen } from '@src/screens/company/AttendanceManagement';
import { CompanyInvitesScreen } from '@src/screens/company/CompanyInvites';
import { CompanyListScreen } from '@src/screens/company/CompanyList';
import { InvitePackagesScreen } from '@src/screens/company/InvitePackages';
import { PermissionManagementScreen } from '@src/screens/company/PermissionManagement';
import { EmployeeListScreen } from '@src/screens/company/EmployeeList';
import { FaceEnrollCaptureScreen } from '@src/screens/company/FaceEnrollCapture';
import { FaceEnrollListScreen } from '@src/screens/company/FaceEnrollList';
import { EmployeeManagementScreen } from '@src/screens/company/EmployeeManagement';
import { EmployeeProfileScreen } from '@src/screens/company/EmployeeProfile';
import { HomeScreen } from '@src/screens/home/HomeScreen';
import { LeaveRequestScreen } from '@src/screens/home/LeaveRequest';
import { OnboardingRequestScreen } from '@src/screens/home/OnboardingRequest';
import { MyCalendarScreen } from '@src/screens/report/Calendar';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="LeaveRequest" component={LeaveRequestScreen} />
      <Stack.Screen name="MyCalendar" component={MyCalendarScreen} />
      <Stack.Screen name="CompanyList" component={CompanyListScreen} />
      <Stack.Screen
        name="AttendanceManagement"
        component={AttendanceManagementScreen}
      />
      <Stack.Screen
        name="EmployeeManagement"
        component={EmployeeManagementScreen}
      />
      <Stack.Screen name="EmployeeList" component={EmployeeListScreen} />
      <Stack.Screen name="FaceEnrollList" component={FaceEnrollListScreen} />
      <Stack.Screen
        name="FaceEnrollCapture"
        component={FaceEnrollCaptureScreen}
      />
      <Stack.Screen name="InvitePackages" component={InvitePackagesScreen} />
      <Stack.Screen name="CompanyInvites" component={CompanyInvitesScreen} />
      <Stack.Screen
        name="PermissionManagement"
        component={PermissionManagementScreen}
      />
      <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} />
      <Stack.Screen
        name="OnboardingRequest"
        component={OnboardingRequestScreen}
      />
    </Stack.Navigator>
  );
}
