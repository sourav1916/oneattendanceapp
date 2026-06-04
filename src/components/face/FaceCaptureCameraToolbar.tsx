import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type { FaceCaptureCameraPosition } from '@src/storage/faceCaptureStorage';

type Props = {
  cameraPosition: FaceCaptureCameraPosition;
  hasTorch: boolean;
  torchOn: boolean;
  disabled?: boolean;
  onToggleCamera: () => void;
  onToggleTorch: () => void;
};

export function FaceCaptureCameraToolbar({
  cameraPosition,
  hasTorch,
  torchOn,
  disabled = false,
  onToggleCamera,
  onToggleTorch,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          position: 'absolute',
          top: 12,
          right: 12,
          flexDirection: 'row',
          gap: 8,
          zIndex: 2,
        },
        btn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.25)',
        },
        btnActive: {
          backgroundColor: 'rgba(13,148,136,0.75)',
          borderColor: 'rgba(255,255,255,0.5)',
        },
        btnDisabled: { opacity: 0.4 },
      }),
    [],
  );

  const flipLabel =
    cameraPosition === 'front'
      ? t('home.faceCapture.useBackCamera')
      : t('home.faceCapture.useFrontCamera');

  return (
    <View style={styles.row} pointerEvents="box-none">
      {hasTorch ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            torchOn
              ? t('home.faceCapture.flashOff')
              : t('home.faceCapture.flashOn')
          }
          disabled={disabled}
          onPress={onToggleTorch}
          style={({ pressed }) => [
            styles.btn,
            torchOn && styles.btnActive,
            disabled && styles.btnDisabled,
            pressed && !disabled && { opacity: 0.85 },
          ]}
        >
          <MaterialCommunityIcons
            name={torchOn ? 'flashlight' : 'flashlight-off'}
            size={22}
            color="#fff"
          />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={flipLabel}
        disabled={disabled}
        onPress={onToggleCamera}
        style={({ pressed }) => [
          styles.btn,
          disabled && styles.btnDisabled,
          pressed && !disabled && { opacity: 0.85 },
        ]}
      >
        <MaterialCommunityIcons
          name="camera-flip-outline"
          size={24}
          color="#fff"
        />
      </Pressable>
    </View>
  );
}
