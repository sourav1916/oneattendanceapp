import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  expanded: boolean;
  children: React.ReactNode;
  duration?: number;
  contentStyle?: StyleProp<ViewStyle>;
};

export function ExpandableAnimatedSection({
  expanded,
  children,
  duration = 220,
  contentStyle,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration,
      useNativeDriver: false,
    }).start();
  }, [duration, expanded, progress]);

  const animatedHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.7, 1],
  });

  return (
    <Animated.View style={[styles.container, { height: animatedHeight, opacity }]}>
      <View
        style={[styles.measure, contentStyle]}
        onLayout={event => {
          const next = event.nativeEvent.layout.height;
          if (next > 0 && next !== contentHeight) {
            setContentHeight(next);
          }
        }}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
});
