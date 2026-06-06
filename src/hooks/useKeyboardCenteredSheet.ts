import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const KEYBOARD_CENTERED_GAP = 8;
export const KEYBOARD_CENTERED_MIN_HEIGHT = 200;
export const KEYBOARD_CENTERED_MAX_HEIGHT = 520;
export const KEYBOARD_CENTERED_MAX_RATIO = 0.85;

export type KeyboardCenteredSheetLayout = {
  wrapStyle: ViewStyle;
  sheetMaxHeight: number;
  fixedSheetHeight?: number;
};

export type KeyboardCenteredSheetOptions = {
  minSheetHeight?: number;
  maxHeight?: number;
  maxHeightRatio?: number;
};

export function resolveKeyboardCenteredSheetLayout(
  windowHeight: number,
  keyboardHeight: number,
  topInset: number,
  bottomInset: number,
  options?: KeyboardCenteredSheetOptions,
): KeyboardCenteredSheetLayout {
  const minSheetHeight = options?.minSheetHeight ?? KEYBOARD_CENTERED_MIN_HEIGHT;
  const maxHeight = options?.maxHeight ?? KEYBOARD_CENTERED_MAX_HEIGHT;
  const maxHeightRatio = options?.maxHeightRatio ?? KEYBOARD_CENTERED_MAX_RATIO;
  const keyboardOpen = keyboardHeight > 0;
  const topGap = topInset + 8;
  const sheetMaxHeight = Math.min(
    maxHeight,
    Math.max(minSheetHeight, windowHeight * maxHeightRatio),
  );

  if (keyboardOpen) {
    const spaceAboveKeyboard = windowHeight - keyboardHeight - KEYBOARD_CENTERED_GAP;
    const fixedSheetHeight = Math.max(
      minSheetHeight,
      Math.min(sheetMaxHeight, spaceAboveKeyboard - topGap),
    );
    return {
      wrapStyle: { justifyContent: 'flex-start', paddingTop: topGap, paddingBottom: 0 },
      sheetMaxHeight,
      fixedSheetHeight,
    };
  }

  return {
    wrapStyle: {
      justifyContent: 'center',
      paddingTop: 0,
      paddingBottom: Math.max(bottomInset, 10),
    },
    sheetMaxHeight,
  };
}

export const keyboardCenteredScrollStyles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollKeyboardOpen: { flex: 1, minHeight: 0 },
});

export function useKeyboardCenteredSheet(
  visible: boolean,
  options?: KeyboardCenteredSheetOptions,
) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const minSheetHeight = options?.minSheetHeight ?? KEYBOARD_CENTERED_MIN_HEIGHT;
  const maxHeight = options?.maxHeight ?? KEYBOARD_CENTERED_MAX_HEIGHT;
  const maxHeightRatio = options?.maxHeightRatio ?? KEYBOARD_CENTERED_MAX_RATIO;

  const layout = useMemo(
    () =>
      resolveKeyboardCenteredSheetLayout(
        windowHeight,
        keyboardHeight,
        insets.top,
        insets.bottom,
        { minSheetHeight, maxHeight, maxHeightRatio },
      ),
    [
      insets.bottom,
      insets.top,
      keyboardHeight,
      maxHeight,
      maxHeightRatio,
      minSheetHeight,
      windowHeight,
    ],
  );

  const sheetSizeStyle = useMemo((): ViewStyle => {
    const base: ViewStyle = { maxHeight: layout.sheetMaxHeight };
    if (layout.fixedSheetHeight != null) {
      return {
        ...base,
        height: layout.fixedSheetHeight,
        maxHeight: layout.fixedSheetHeight,
      };
    }
    return base;
  }, [layout.fixedSheetHeight, layout.sheetMaxHeight]);

  const scrollStyle =
    keyboardHeight > 0
      ? [
          keyboardCenteredScrollStyles.scroll,
          keyboardCenteredScrollStyles.scrollKeyboardOpen,
        ]
      : keyboardCenteredScrollStyles.scroll;

  const scrollViewProps = {
    keyboardShouldPersistTaps: 'handled' as const,
    keyboardDismissMode: 'on-drag' as const,
    showsVerticalScrollIndicator: keyboardHeight > 0,
    bounces: false as const,
  };

  const scrollContentPaddingBottom = Math.max(16, insets.bottom);

  return {
    keyboardHeight,
    insets,
    layout,
    sheetSizeStyle,
    scrollStyle,
    scrollViewProps,
    scrollContentPaddingBottom,
  };
}
