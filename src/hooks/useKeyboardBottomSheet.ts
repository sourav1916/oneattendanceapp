import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const KEYBOARD_SHEET_GAP = 8;
export const KEYBOARD_SHEET_MIN_HEIGHT = 280;
export const KEYBOARD_SHEET_MAX_RATIO = 0.92;

export type KeyboardBottomSheetLayout = {
  wrapStyle: ViewStyle;
  sheetHeight?: number;
  sheetMaxHeight: number;
};

export type KeyboardBottomSheetOptions = {
  minSheetHeight?: number;
  maxHeightRatio?: number;
  keyboardGap?: number;
};

export function resolveKeyboardBottomSheetLayout(
  windowHeight: number,
  keyboardHeight: number,
  topInset: number,
  options?: KeyboardBottomSheetOptions,
): KeyboardBottomSheetLayout {
  const minSheetHeight = options?.minSheetHeight ?? KEYBOARD_SHEET_MIN_HEIGHT;
  const maxHeightRatio = options?.maxHeightRatio ?? KEYBOARD_SHEET_MAX_RATIO;
  const keyboardGap = options?.keyboardGap ?? KEYBOARD_SHEET_GAP;
  const keyboardOpen = keyboardHeight > 0;
  const sheetMaxHeight = Math.min(
    windowHeight * maxHeightRatio,
    windowHeight - topInset - 24,
  );

  if (keyboardOpen) {
    const available = windowHeight - keyboardHeight - keyboardGap - topInset;
    const sheetHeight = Math.max(minSheetHeight, Math.min(sheetMaxHeight, available));
    return {
      wrapStyle: {
        justifyContent: 'flex-end',
        paddingTop: 24,
        paddingBottom: keyboardHeight,
      },
      sheetHeight,
      sheetMaxHeight,
    };
  }

  return {
    wrapStyle: { justifyContent: 'flex-end', paddingTop: 48, paddingBottom: 0 },
    sheetMaxHeight,
  };
}

export const keyboardBottomSheetScrollStyles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollKeyboardOpen: { flex: 1, minHeight: 0 },
});

export function useKeyboardBottomSheet(
  visible: boolean,
  options?: KeyboardBottomSheetOptions,
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

  const minSheetHeight = options?.minSheetHeight ?? KEYBOARD_SHEET_MIN_HEIGHT;
  const maxHeightRatio = options?.maxHeightRatio ?? KEYBOARD_SHEET_MAX_RATIO;
  const keyboardGap = options?.keyboardGap ?? KEYBOARD_SHEET_GAP;

  const layout = useMemo(
    () =>
      resolveKeyboardBottomSheetLayout(windowHeight, keyboardHeight, insets.top, {
        minSheetHeight,
        maxHeightRatio,
        keyboardGap,
      }),
    [insets.top, keyboardHeight, keyboardGap, maxHeightRatio, minSheetHeight, windowHeight],
  );

  const sheetSizeStyle = useMemo(
    (): ViewStyle => ({
      maxHeight: layout.sheetMaxHeight,
      ...(layout.sheetHeight != null ? { height: layout.sheetHeight } : null),
    }),
    [layout.sheetHeight, layout.sheetMaxHeight],
  );

  const scrollStyle =
    keyboardHeight > 0
      ? [
          keyboardBottomSheetScrollStyles.scroll,
          keyboardBottomSheetScrollStyles.scrollKeyboardOpen,
        ]
      : keyboardBottomSheetScrollStyles.scroll;

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
