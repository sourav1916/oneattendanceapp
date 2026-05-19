import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Animated, Dimensions, Easing } from 'react-native';

const TAB_SLIDE_WIDTH = Dimensions.get('window').width;

type TabSlideInterpolationProps = {
  current: { progress: Animated.Value };
};

/**
 * Horizontal slide between tabs: moving to a tab on the right slides in from the right;
 * moving to a tab on the left slides in from the left.
 *
 * `current.progress`: -1 = left of active, 0 = active, 1 = right of active.
 */
export function forTabSlide({ current }: TabSlideInterpolationProps) {
  return {
    sceneStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-TAB_SLIDE_WIDTH, 0, TAB_SLIDE_WIDTH],
          }),
        },
      ],
    },
  };
}

/** Tab transition preset — spread into bottom tab `screenOptions`. */
export const TabSlideTransition: Pick<
  BottomTabNavigationOptions,
  'transitionSpec' | 'sceneStyleInterpolator'
> = {
  transitionSpec: {
    animation: 'timing',
    config: {
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    },
  },
  sceneStyleInterpolator: forTabSlide,
};
