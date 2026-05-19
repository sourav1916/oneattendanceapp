import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import { filterLoginCountries, type LoginCountry } from '@src/utils/loginCountries';

const SHEET_HEIGHT_CAP = 560;
const SHEET_CHROME_HEIGHT = 156;
const MIN_SHEET_HEIGHT = 220;
const MIN_LIST_HEIGHT = 96;

type Props = {
  visible: boolean;
  title: string;
  cancelLabel: string;
  searchPlaceholder?: string;
  selectedCountryCode: string;
  onDismiss: () => void;
  onSelectCountry: (country: LoginCountry) => void;
};

type SheetLayout = {
  wrapStyle: ViewStyle;
  sheetMaxHeight: number;
  listMaxHeight: number;
};

function buildStyles(
  colors: AppThemeColors,
  sheetMaxHeight: number,
  listMaxHeight: number,
) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    sheetWrap: {
      flex: 1,
      paddingHorizontal: 16,
    },
    sheet: {
      width: '100%',
      maxWidth: 400,
      alignSelf: 'center',
      height: sheetMaxHeight,
      maxHeight: sheetMaxHeight,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 10,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    searchInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 11 : 9,
      fontSize: 16,
      color: colors.text,
      marginBottom: 10,
    },
    list: {
      flex: 1,
      maxHeight: listMaxHeight,
    },
    listContent: {
      paddingBottom: 4,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    optionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.secondaryButton,
    },
    optionPressed: {
      opacity: 0.88,
    },
    optionName: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      marginRight: 12,
    },
    optionCode: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textMuted,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 20,
      paddingHorizontal: 8,
    },
    cancelBtn: {
      marginTop: 6,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 10,
    },
    cancelBtnPressed: {
      opacity: 0.75,
    },
    cancelLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}

function resolveSheetLayout(
  windowHeight: number,
  keyboardHeight: number,
  topInset: number,
  bottomInset: number,
): SheetLayout {
  const keyboardOpen = keyboardHeight > 0;
  const topGap = topInset + 8;
  const keyboardGap = 8;

  if (keyboardOpen) {
    const spaceAboveKeyboard = windowHeight - keyboardHeight - keyboardGap;
    const sheetMaxHeight = Math.max(
      MIN_SHEET_HEIGHT,
      Math.min(SHEET_HEIGHT_CAP, spaceAboveKeyboard - topGap),
    );
    const listMaxHeight = Math.max(
      MIN_LIST_HEIGHT,
      sheetMaxHeight - SHEET_CHROME_HEIGHT,
    );

    return {
      wrapStyle: {
        justifyContent: 'flex-start',
        paddingTop: topGap,
        paddingBottom: 0,
      },
      sheetMaxHeight,
      listMaxHeight,
    };
  }

  const sheetMaxHeight = Math.min(
    SHEET_HEIGHT_CAP,
    Math.max(MIN_SHEET_HEIGHT, windowHeight * 0.72),
  );
  const listMaxHeight = Math.max(
    MIN_LIST_HEIGHT,
    sheetMaxHeight - SHEET_CHROME_HEIGHT,
  );

  return {
    wrapStyle: {
      justifyContent: 'center',
      paddingTop: 0,
      paddingBottom: Math.max(bottomInset, 16),
    },
    sheetMaxHeight,
    listMaxHeight,
  };
}

export function CountryCodePicker({
  visible,
  title,
  cancelLabel,
  searchPlaceholder = 'Search country or code',
  selectedCountryCode,
  onDismiss,
  onSelectCountry,
}: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const searchInputRef = useRef<TextInput>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [filteredCountries, setFilteredCountries] = useState<LoginCountry[]>(() =>
    filterLoginCountries(''),
  );

  const layout = useMemo(
    () =>
      resolveSheetLayout(
        windowHeight,
        keyboardHeight,
        insets.top,
        insets.bottom,
      ),
    [windowHeight, keyboardHeight, insets.top, insets.bottom],
  );

  const styles = useMemo(
    () => buildStyles(colors, layout.sheetMaxHeight, layout.listMaxHeight),
    [colors, layout.sheetMaxHeight, layout.listMaxHeight],
  );

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setFilteredCountries(filterLoginCountries(''));
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    const focusTimer = setTimeout(() => searchInputRef.current?.focus(), 250);

    return () => {
      clearTimeout(focusTimer);
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setFilteredCountries(filterLoginCountries(text));
  }, []);

  const renderCountry = useCallback(
    ({ item }: { item: LoginCountry }) => {
      const selected = item.code === selectedCountryCode;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={`${item.name}, ${item.dialCode}`}
          onPress={() => onSelectCountry(item)}
          style={({ pressed }) => [
            styles.option,
            selected && styles.optionSelected,
            pressed && styles.optionPressed,
          ]}>
          <Text style={styles.optionName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.optionCode}>{item.dialCode}</Text>
        </Pressable>
      );
    },
    [onSelectCountry, selectedCountryCode, styles],
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onDismiss}
      statusBarTranslucent>
      <SafeAreaView style={styles.safe} edges={['left', 'right']}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Close country picker"
          onPress={onDismiss}
        />
        <View style={[styles.sheetWrap, layout.wrapStyle]} pointerEvents="box-none">
          <View style={styles.sheet} pointerEvents="auto">
            <Text style={styles.title}>{title}</Text>
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : undefined}
              style={styles.searchInput}
              accessibilityLabel="Search countries"
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={item => item.code}
              renderItem={renderCountry}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              extraData={`${searchQuery}-${selectedCountryCode}-${keyboardHeight}`}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No countries match your search.</Text>
              }
            />
            <Pressable
              accessibilityRole="button"
              onPress={onDismiss}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}>
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
