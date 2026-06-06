import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';

import {
  YEAR_ITEM_HEIGHT,
  YEAR_LIST_PAD,
  YEAR_LIST_VIEW_HEIGHT,
  YEAR_ROW_HEIGHT,
  indexFromScrollOffset,
} from '@src/components/modals/yearWheelPickerUtils';

type Props = {
  years: number[];
  selectedYear: number;
  onSelectedYearChange: (year: number) => void;
  resetToken: number;
};

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';
  return StyleSheet.create({
    wrap: {
      height: YEAR_LIST_VIEW_HEIGHT,
      position: 'relative',
      overflow: 'hidden',
    },
    list: {
      flex: 1,
    },
    content: {
      paddingVertical: YEAR_LIST_PAD,
    },
    centerBand: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: YEAR_LIST_PAD,
      height: YEAR_ITEM_HEIGHT,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(96,165,250,0.55)' : 'rgba(37,99,235,0.45)',
      backgroundColor: isDark ? 'rgba(59,130,246,0.18)' : 'rgba(37,99,235,0.1)',
      pointerEvents: 'none',
      zIndex: 2,
    },
    fadeTop: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: YEAR_LIST_PAD,
      backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.72)',
      pointerEvents: 'none',
      zIndex: 1,
    },
    fadeBottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: YEAR_LIST_PAD,
      backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.72)',
      pointerEvents: 'none',
      zIndex: 1,
    },
    row: {
      height: YEAR_ROW_HEIGHT,
      justifyContent: 'center',
    },
    item: {
      height: YEAR_ITEM_HEIGHT,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemPressed: {
      opacity: 0.75,
    },
    text: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textMuted,
    },
    textCentered: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
  });
}

export function YearWheelPicker({
  years,
  selectedYear,
  onSelectedYearChange,
  resetToken,
}: Props) {
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const listRef = useRef<FlatList<number>>(null);
  const isUserScrollingRef = useRef(false);
  const selectedYearRef = useRef(selectedYear);

  selectedYearRef.current = selectedYear;

  const maxIndex = years.length - 1;

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      if (index < 0 || index > maxIndex) {
        return;
      }
      listRef.current?.scrollToOffset({
        offset: index * YEAR_ROW_HEIGHT,
        animated,
      });
    },
    [maxIndex],
  );

  const scrollToYear = useCallback(
    (year: number, animated: boolean) => {
      const index = years.indexOf(year);
      if (index >= 0) {
        scrollToIndex(index, animated);
      }
    },
    [scrollToIndex, years],
  );

  const syncSelectionFromOffset = useCallback(
    (offsetY: number) => {
      const index = indexFromScrollOffset(offsetY, maxIndex);
      const year = years[index];
      if (year != null && year !== selectedYearRef.current) {
        onSelectedYearChange(year);
      }
    },
    [maxIndex, onSelectedYearChange, years],
  );

  useEffect(() => {
    isUserScrollingRef.current = false;
    requestAnimationFrame(() => {
      scrollToYear(selectedYearRef.current, false);
    });
  }, [resetToken, scrollToYear]);

  const handleLayout = useCallback(() => {
    scrollToYear(selectedYearRef.current, false);
  }, [scrollToYear]);

  const handleScrollBeginDrag = useCallback(() => {
    isUserScrollingRef.current = true;
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!isUserScrollingRef.current) {
        return;
      }
      syncSelectionFromOffset(event.nativeEvent.contentOffset.y);
    },
    [syncSelectionFromOffset],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isUserScrollingRef.current = false;
      syncSelectionFromOffset(event.nativeEvent.contentOffset.y);
    },
    [syncSelectionFromOffset],
  );

  const handleYearPress = useCallback(
    (year: number) => {
      isUserScrollingRef.current = false;
      scrollToYear(year, true);
      onSelectedYearChange(year);
    },
    [onSelectedYearChange, scrollToYear],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: YEAR_ROW_HEIGHT,
      offset: YEAR_ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: number }) => {
      const isCentered = item === selectedYear;
      return (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isCentered }}
            onPress={() => handleYearPress(item)}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
            <Text style={[styles.text, isCentered && styles.textCentered]}>{item}</Text>
          </Pressable>
        </View>
      );
    },
    [handleYearPress, selectedYear, styles],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.fadeTop} />
      <View style={styles.fadeBottom} />
      <View style={styles.centerBand} />
      <FlatList
        ref={listRef}
        data={years}
        keyExtractor={String}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        style={styles.list}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
        decelerationRate="normal"
        snapToInterval={YEAR_ROW_HEIGHT}
        snapToAlignment="start"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onLayout={handleLayout}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
      />
    </View>
  );
}
