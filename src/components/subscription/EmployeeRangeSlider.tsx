import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { SubscriptionPackage } from '@src/types/subscriptionPackage';
import {
  sliderIndexFromRatio,
  sliderThumbRatio,
} from '@src/utils/subscriptionBilling';

const THUMB_SIZE = 32;
const TRACK_HEIGHT = 8;

const HORIZONTAL_DRAG_THRESHOLD = 6;

export type EmployeeRangeSliderProps = {
  packages: SubscriptionPackage[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  rangeLabel: (pkg: SubscriptionPackage) => string;
  sectionLabel: string;
  hint: string;
  accent: string;
  trackColor: string;
  fillColor: string;
  thumbBorderColor: string;
  labelColor: string;
  labelActiveColor: string;
  hintColor: string;
};

export function EmployeeRangeSlider({
  packages,
  selectedIndex,
  onSelectIndex,
  rangeLabel,
  sectionLabel,
  hint,
  accent,
  trackColor,
  fillColor,
  thumbBorderColor,
  labelColor,
  labelActiveColor,
  hintColor,
}: EmployeeRangeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  const dragRatioRef = useRef<number | null>(null);
  const trackWidthRef = useRef(0);
  const lastNotifiedIndexRef = useRef(selectedIndex);
  const isDraggingRef = useRef(false);
  const dragRafRef = useRef<number | null>(null);

  const onSelectIndexRef = useRef(onSelectIndex);
  onSelectIndexRef.current = onSelectIndex;

  const stepCount = packages.length;

  useEffect(() => {
    lastNotifiedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const flushDragVisual = useCallback(() => {
    if (dragRafRef.current != null) {
      return;
    }
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      setDragRatio(dragRatioRef.current);
    });
  }, []);

  const applyRatio = useCallback(
    (ratio: number, notifyParent: boolean) => {
      const clamped = Math.max(0, Math.min(1, ratio));
      dragRatioRef.current = clamped;
      flushDragVisual();

      if (!notifyParent || stepCount <= 0) {
        return;
      }
      const index = sliderIndexFromRatio(clamped, stepCount);
      if (index !== lastNotifiedIndexRef.current) {
        lastNotifiedIndexRef.current = index;
        onSelectIndexRef.current(index);
      }
    },
    [flushDragVisual, stepCount],
  );

  const updateFromLocationX = useCallback(
    (locationX: number, notifyParent: boolean) => {
      const width = trackWidthRef.current;
      if (width <= 0) {
        return;
      }
      applyRatio(locationX / width, notifyParent);
    },
    [applyRatio],
  );

  const finishDrag = useCallback(() => {
    if (!isDraggingRef.current) {
      return;
    }
    isDraggingRef.current = false;

    const ratio = dragRatioRef.current;
    if (ratio != null && stepCount > 0) {
      const index = sliderIndexFromRatio(ratio, stepCount);
      lastNotifiedIndexRef.current = index;
      onSelectIndexRef.current(index);
    }

    dragRatioRef.current = null;
    if (dragRafRef.current != null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    setDragRatio(null);
  }, [stepCount]);

  const isHorizontalDrag = useCallback(
    (dx: number, dy: number) =>
      Math.abs(dx) > HORIZONTAL_DRAG_THRESHOLD &&
      Math.abs(dx) > Math.abs(dy),
    [],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => stepCount > 0,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          isHorizontalDrag(gestureState.dx, gestureState.dy),
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderTerminationRequest: (_, gestureState) =>
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) ||
          !isHorizontalDrag(gestureState.dx, gestureState.dy),
        onPanResponderGrant: evt => {
          isDraggingRef.current = true;
          updateFromLocationX(evt.nativeEvent.locationX, true);
        },
        onPanResponderMove: evt => {
          updateFromLocationX(evt.nativeEvent.locationX, true);
        },
        onPanResponderRelease: () => {
          finishDrag();
        },
        onPanResponderTerminate: () => {
          finishDrag();
        },
      }),
    [finishDrag, isHorizontalDrag, stepCount, updateFromLocationX],
  );

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    trackWidthRef.current = width;
    setTrackWidth(width);
  }, []);

  const displayRatio =
    dragRatio ?? sliderThumbRatio(selectedIndex, stepCount);

  const thumbTravel = Math.max(0, trackWidth - THUMB_SIZE);
  const thumbLeft = thumbTravel * displayRatio;

  const previewIndex =
    stepCount > 0 ? sliderIndexFromRatio(displayRatio, stepCount) : 0;
  const previewPkg = packages[previewIndex] ?? packages[0];

  if (stepCount === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionLabel, { color: labelColor }]}>
        {sectionLabel}
      </Text>
      <Text style={[styles.rangeValue, { color: labelActiveColor }]}>
        {previewPkg != null ? rangeLabel(previewPkg) : ''}
      </Text>
      <Text style={[styles.hint, { color: hintColor }]}>{hint}</Text>

      <View
        style={styles.trackOuter}
        onLayout={handleTrackLayout}
        collapsable={false}
        {...panResponder.panHandlers}
      >
        <View style={styles.trackInner} pointerEvents="none">
          <View style={[styles.track, { backgroundColor: trackColor }]}>
            <View
              style={[
                styles.trackFill,
                {
                  backgroundColor: fillColor,
                  width: `${displayRatio * 100}%`,
                },
              ]}
            />
          </View>
          {trackWidth > 0 ? (
            <View
              style={[
                styles.thumb,
                {
                  transform: [{ translateX: thumbLeft }],
                  backgroundColor: accent,
                  borderColor: thumbBorderColor,
                },
              ]}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 0,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  rangeValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    marginBottom: 16,
  },
  trackOuter: {
    minHeight: THUMB_SIZE + 24,
    justifyContent: 'center',
    paddingVertical: 8,
    width: '100%',
  },
  trackInner: {
    height: THUMB_SIZE,
    justifyContent: 'center',
    width: '100%',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    top: 0,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});
