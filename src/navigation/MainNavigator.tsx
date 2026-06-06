import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Platform,
  Pressable,
  Text,
  type PressableProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { CompanySelectionGate } from '@src/components/CompanySelectionGate';
import { useAuth } from '@src/context/AuthContext';
import { useThemeColors } from '@src/context/ThemeContext';
import { FaceAttendanceNavigator } from '@src/navigation/FaceAttendanceNavigator';
import { HomeNavigator } from '@src/navigation/HomeNavigator';
import { SettingsNavigator } from '@src/navigation/SettingsNavigator';
import { TabSlideTransition } from '@src/navigation/tabSlideTransition';
import type { MainTabParamList } from '@src/navigation/types';
import { AttendanceScreen } from '@src/screens/attendance/AttendanceScreen';
import { AttendanceManagementScreen } from '@src/screens/company/attendance/AttendanceManagement';
import { canShowFaceAttendanceTab } from '@src/utils/faceAttendanceAccess';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Extra space below tab labels (above system home / Android nav bar inset). */
const TAB_BAR_LABEL_BOTTOM_GAP = 8;

/**
 * Minimum inner height for icon + label row (includes animated lift), excluding
 * `paddingTop` / `paddingBottom`. Must match real content or the bar clips or leaves a gap.
 */
const TAB_BAR_CONTENT_MIN = 58;

const TAB_ICON_SIZE = 22;
/** Active tab icon + label shift upward (px). */
const TAB_ACTIVE_LIFT = 6;

const tabLiftSpring = {
  friction: 9,
  tension: 120,
  useNativeDriver: true as const,
};

/** No Material ripple; active state is the animated lift. */
function TabBarPressable(props: BottomTabBarButtonProps) {
  const { ref: _ignoredRef, ...rest } = props as BottomTabBarButtonProps &
    Record<string, unknown>;
  return (
    <Pressable {...(rest as PressableProps)} android_ripple={null} />
  );
}

function TabBarLiftedIcon({
  iconName,
  focused,
  color,
  size,
}: {
  iconName: string;
  focused: boolean;
  color: string;
  size: number;
}) {
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(lift, {
      ...tabLiftSpring,
      toValue: focused ? -TAB_ACTIVE_LIFT : 0,
    }).start();
  }, [focused, lift]);
  return (
    <Animated.View style={{ transform: [{ translateY: lift }] }}>
      <MaterialCommunityIcons name={iconName} size={size} color={color} />
    </Animated.View>
  );
}

function tabBarIconMci(outlineName: string, solidName: string) {
  return function TabBarIcon({
    focused,
    color,
    size,
  }: {
    focused: boolean;
    color: string;
    size: number;
  }) {
    return (
      <TabBarLiftedIcon
        iconName={focused ? solidName : outlineName}
        focused={focused}
        color={color}
        size={size ?? TAB_ICON_SIZE}
      />
    );
  };
}

function TabBarLiftedLabel({
  focused,
  color,
  children,
}: {
  focused: boolean;
  color: string;
  position: 'below-icon' | 'beside-icon';
  children: string;
}) {
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(lift, {
      ...tabLiftSpring,
      toValue: focused ? -TAB_ACTIVE_LIFT : 0,
    }).start();
  }, [focused, lift]);
  return (
    <Animated.View style={{ transform: [{ translateY: lift }] }}>
      <Text
        numberOfLines={1}
        style={{
          color,
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        }}>
        {children}
      </Text>
    </Animated.View>
  );
}

function tabBarLabelRenderer(props: {
  focused: boolean;
  color: string;
  position: 'below-icon' | 'beside-icon';
  children: string;
}) {
  return <TabBarLiftedLabel {...props} />;
}

type TabStackNavigation = {
  getState: () => {
    routes: Array<{ name: string; state?: { index?: number } }>;
  };
  navigate: (tab: keyof MainTabParamList, params: { screen: string }) => void;
};

/**
 * When the user returns to a tab, pop its nested stack to root if they had opened a sub-screen.
 * Must run on **focus**, not blur: `navigate(tab, …)` on blur re-activates that tab and blocks switching to Attendance/Home.
 */
function nestedStackResetOnTabFocus(tabName: keyof MainTabParamList, rootScreen: string) {
  return ({ navigation }: { navigation: TabStackNavigation }) => ({
    focus: () => {
      const tabRoute = navigation.getState().routes.find(r => r.name === tabName);
      const nestedIndex = tabRoute?.state?.index ?? 0;
      if (nestedIndex > 0) {
        navigation.navigate(tabName, { screen: rootScreen });
      }
    },
  });
}

function MainTabNavigator() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { profileRole, selectedCompany } = useAuth();
  const isOwnerCompany = selectedCompany?.relation === 'owned';
  const showFaceAttendanceTab = useMemo(
    () => canShowFaceAttendanceTab(profileRole, selectedCompany),
    [profileRole, selectedCompany],
  );
  const screenOptions = useMemo((): BottomTabNavigationOptions => {
    const paddingBottom = insets.bottom + TAB_BAR_LABEL_BOTTOM_GAP;
    const paddingTop = Platform.OS === 'ios' ? 8 : 6;
    const height = TAB_BAR_CONTENT_MIN + paddingTop + paddingBottom;
    return {
      ...TabSlideTransition,
      headerShown: false,
      tabBarHideOnKeyboard: true,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarButton: props => <TabBarPressable {...props} />,
      tabBarLabel: tabBarLabelRenderer,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        paddingTop,
        paddingBottom,
        height,
      },
    };
  }, [insets.bottom, colors]);
  return (
    <Tab.Navigator
      /** Bottom inset is applied only via `tabBarStyle.paddingBottom` to avoid double padding with React Navigation’s tab bar. */
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={screenOptions}>
      <Tab.Screen
        name="Home"
        component={HomeNavigator}
        listeners={nestedStackResetOnTabFocus('Home', 'HomeMain')}
        options={{
          title: t('tabs.home'),
          tabBarIcon: tabBarIconMci('home-outline', 'home'),
        }}
      />
      {isOwnerCompany ? (
        <Tab.Screen
          name="AttendanceManagement"
          component={AttendanceManagementScreen}
          options={{
            title: t('tabs.attendanceManagement'),
            tabBarIcon: tabBarIconMci(
              'clipboard-text-clock-outline',
              'clipboard-text-clock',
            ),
          }}
        />
      ) : (
        <Tab.Screen
          name="Attendance"
          component={AttendanceScreen}
          options={{
            title: t('tabs.attendance'),
            tabBarIcon: tabBarIconMci('calendar-clock-outline', 'calendar-clock'),
          }}
        />
      )}
      {showFaceAttendanceTab ? (
        <Tab.Screen
          name="FaceAttendance"
          component={FaceAttendanceNavigator}
          listeners={nestedStackResetOnTabFocus('FaceAttendance', 'FaceAttendanceMain')}
          options={{
            title: t('tabs.faceAttendance'),
            tabBarIcon: tabBarIconMci('face-recognition', 'face-recognition'),
          }}
        />
      ) : null}
      <Tab.Screen
        name="Settings"
        component={SettingsNavigator}
        listeners={nestedStackResetOnTabFocus('Settings', 'SettingsHome')}
        options={{
          title: t('tabs.settings'),
          tabBarIcon: tabBarIconMci('cog-outline', 'cog'),
        }}
      />
    </Tab.Navigator>
  );
}

export function MainNavigator() {
  return (
    <CompanySelectionGate>
      <MainTabNavigator />
    </CompanySelectionGate>
  );
}
