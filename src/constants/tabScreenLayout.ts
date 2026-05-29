import type { Edge } from 'react-native-safe-area-context';

/**
 * Screens inside a bottom-tab navigator should not use the bottom safe-area edge;
 * MainNavigator already applies `insets.bottom` on the tab bar.
 * @see SettingsScreen
 */
export const TAB_SCREEN_SAFE_AREA_EDGES: Edge[] = ['top', 'left', 'right'];

export const TAB_SCREEN_SCROLL_PADDING_BOTTOM = 32;
