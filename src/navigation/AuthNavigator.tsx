import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { AuthStackParamList } from '@src/navigation/types';
import { ForgotPasswordScreen } from '@src/screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '@src/screens/auth/LoginScreen';
import { RegisterScreen } from '@src/screens/auth/RegisterScreen';
import { VerifyEmailOtpScreen } from '@src/screens/auth/VerifyEmailOtpScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
      />
      <Stack.Screen name="VerifyEmailOtp" component={VerifyEmailOtpScreen} />
    </Stack.Navigator>
  );
}
