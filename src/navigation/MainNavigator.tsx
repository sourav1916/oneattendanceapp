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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompanySelectionGate } from '@src/components/CompanySelectionGate';
import { useThemeColors } from '@src/context/ThemeContext';
import type { MainTabParamList } from '@src/navigation/types';
import { HomeNavigator } from '@src/navigation/HomeNavigator';
import { AttendanceScreen } from '@src/screens/attendance/AttendanceScreen';
import { SettingsNavigator } from '@src/navigation/SettingsNavigator';

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

function MainTabNavigator() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const screenOptions = useMemo((): BottomTabNavigationOptions => {
    const paddingBottom = insets.bottom + TAB_BAR_LABEL_BOTTOM_GAP;
    const paddingTop = Platform.OS === 'ios' ? 8 : 6;
    const height = TAB_BAR_CONTENT_MIN + paddingTop + paddingBottom;
    return {
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
        options={{
          title: t('tabs.home'),
          tabBarIcon: tabBarIconMci('home-outline', 'home'),
        }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{
          title: t('tabs.attendance'),
          tabBarIcon: tabBarIconMci('calendar-clock-outline', 'calendar-clock'),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsNavigator}
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
