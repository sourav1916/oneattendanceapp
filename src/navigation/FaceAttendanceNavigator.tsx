import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { FaceAttendanceFlowParamList } from '@src/navigation/types';
import { FaceAttendanceScreen } from '@src/screens/company/attendance/FaceAttendance';
import { FaceEnrollScreen } from '@src/screens/company/employee/FaceEnroll';

const Stack = createNativeStackNavigator<FaceAttendanceFlowParamList>();

export function FaceAttendanceNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FaceAttendanceMain" component={FaceAttendanceScreen} />
      <Stack.Screen name="FaceEnroll" component={FaceEnrollScreen} />
    </Stack.Navigator>
  );
}
