import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { HomeStackParamList } from '@src/navigation/types';
import { AttendanceManagementScreen } from '@src/screens/company/AttendanceManagement';
import { CompanyInvitesScreen } from '@src/screens/company/CompanyInvites';
import { CompanyListScreen } from '@src/screens/company/CompanyList';
import { InvitePackagesScreen } from '@src/screens/company/InvitePackages';
import { PermissionManagementScreen } from '@src/screens/company/PermissionManagement';
import { CompanyLedgerScreen } from '@src/screens/company/CompanyLedger';
import { CreateEmployeeScreen } from '@src/screens/company/CreateEmployee';
import { EmployeeListScreen } from '@src/screens/company/EmployeeList';
import { FaceAttendanceScreen } from '@src/screens/company/FaceAttendance';
import { FaceEnrollScreen } from '@src/screens/company/FaceEnroll';
import { EmployeeManagementScreen } from '@src/screens/company/EmployeeManagement';
import { LeaveManagementScreen } from '@src/screens/company/LeaveManagement';
import { LeaveBalanceScreen } from '@src/screens/company/LeaveBalance';
import { LeaveConfigScreen } from '@src/screens/company/LeaveConfig';
import { LeaveRequestsScreen } from '@src/screens/company/LeaveRequests';
import { EmployeeProfileScreen } from '@src/screens/company/EmployeeProfile';
import { HomeScreen } from '@src/screens/home/HomeScreen';
import { LedgerScreen } from '@src/screens/home/Ledger';
import { LeaveRequestScreen } from '@src/screens/home/LeaveRequest';
import { OnboardingRequestScreen } from '@src/screens/home/OnboardingRequest';
import { MyCalendarScreen } from '@src/screens/report/Calendar';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Ledger" component={LedgerScreen} />
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
      <Stack.Screen
        name="LeaveManagement"
        component={LeaveManagementScreen}
      />
      <Stack.Screen name="LeaveRequests" component={LeaveRequestsScreen} />
      <Stack.Screen name="LeaveBalance" component={LeaveBalanceScreen} />
      <Stack.Screen name="LeaveConfig" component={LeaveConfigScreen} />
      <Stack.Screen name="EmployeeList" component={EmployeeListScreen} />
      <Stack.Screen name="FaceEnroll" component={FaceEnrollScreen} />
      <Stack.Screen name="FaceAttendance" component={FaceAttendanceScreen} />
      <Stack.Screen name="CompanyLedger" component={CompanyLedgerScreen} />
      <Stack.Screen name="CreateEmployee" component={CreateEmployeeScreen} />
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
