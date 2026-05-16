export type { AppThemeColors } from '@src/theme/palettes';
export { lightTheme, darkTheme } from '@src/theme/palettes';

import { lightTheme } from '@src/theme/palettes';

/** @deprecated Use `useThemeColors()` from `@src/context/ThemeContext` for dynamic theming. */
export const authTheme = lightTheme;
