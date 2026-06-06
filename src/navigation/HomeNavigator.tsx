import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { HomeStackParamList } from '@src/navigation/types';
import { AttendanceManagementScreen } from '@src/screens/company/attendance/AttendanceManagement';
import { FaceAttendanceScreen } from '@src/screens/company/attendance/FaceAttendance';
import { CompanyInvitesScreen } from '@src/screens/company/employee/CompanyInvites';
import { CreateEmployeeScreen } from '@src/screens/company/employee/CreateEmployee';
import { EmployeeListScreen } from '@src/screens/company/employee/EmployeeList';
import { EmployeeManagementScreen } from '@src/screens/company/employee/EmployeeManagement';
import { EmployeeProfileScreen } from '@src/screens/company/employee/EmployeeProfile';
import { FaceEnrollScreen } from '@src/screens/company/employee/FaceEnroll';
import { PayrollManagementScreen } from '@src/screens/company/employee/PayrollManagement';
import { PermissionManagementScreen } from '@src/screens/company/employee/PermissionManagement';
import { ShiftManagementScreen } from '@src/screens/company/employee/ShiftManagement';
import { LeaveBalanceScreen } from '@src/screens/company/leave/LeaveBalance';
import { LeaveConfigScreen } from '@src/screens/company/leave/LeaveConfig';
import { LeaveManagementScreen } from '@src/screens/company/leave/LeaveManagement';
import { LeaveRequestsScreen } from '@src/screens/company/leave/LeaveRequests';
import { CompanyListScreen } from '@src/screens/company/CompanyList';
import { InvitePackagesScreen } from '@src/screens/company/employee/InvitePackages';
import { CompanyLedgerScreen } from '@src/screens/company/CompanyLedger';
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
      <Stack.Screen name="PayrollManagement" component={PayrollManagementScreen} />
      <Stack.Screen name="ShiftManagement" component={ShiftManagementScreen} />
      <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} />
      <Stack.Screen
        name="OnboardingRequest"
        component={OnboardingRequestScreen}
      />
    </Stack.Navigator>
  );
}
