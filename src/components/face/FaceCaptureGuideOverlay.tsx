import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, Mask, Rect } from 'react-native-svg';

import {
  FACE_GUIDE_HEIGHT,
  FACE_GUIDE_OFFSET_UP,
  FACE_GUIDE_RADIUS_X,
  FACE_GUIDE_RADIUS_Y,
  FACE_GUIDE_WIDTH,
} from '@src/constants/faceCaptureLayout';

const GUIDE_STROKE_IDLE = 'rgba(255,255,255,0.9)';
const GUIDE_STROKE_READY = '#4ade80';
const GUIDE_STROKE_MULTIPLE = '#fbbf24';
const VIGNETTE_FILL = 'rgba(0,0,0,0.62)';

type Props = {
  width: number;
  height: number;
  faceReady: boolean;
  multipleFaces: boolean;
};

export function FaceCaptureGuideOverlay({
  width,
  height,
  faceReady,
  multipleFaces,
}: Props) {
  const styles = useMemo(() => StyleSheet.create({ root: StyleSheet.absoluteFill }), []);

  if (width <= 0 || height <= 0) {
    return null;
  }

  const cx = width / 2;
  const cy = height / 2 + FACE_GUIDE_OFFSET_UP;
  const strokeColor = multipleFaces
    ? GUIDE_STROKE_MULTIPLE
    : faceReady
      ? GUIDE_STROKE_READY
      : GUIDE_STROKE_IDLE;
  const strokeWidth = faceReady && !multipleFaces ? 3 : 2;

  return (
    <View style={styles.root} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <Mask id="faceCaptureHole">
            <Rect x={0} y={0} width={width} height={height} fill="white" />
            <Ellipse
              cx={cx}
              cy={cy}
              rx={FACE_GUIDE_RADIUS_X}
              ry={FACE_GUIDE_RADIUS_Y}
              fill="black"
            />
          </Mask>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={VIGNETTE_FILL}
          mask="url(#faceCaptureHole)"
        />
        <Ellipse
          cx={cx}
          cy={cy}
          rx={FACE_GUIDE_RADIUS_X}
          ry={FACE_GUIDE_RADIUS_Y}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
      </Svg>
    </View>
  );
}
