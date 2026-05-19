import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    type TextStyle,
    View,
    type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';

export type ConfirmAlertButtonVariant =
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'outline'
    | 'ghost';

export type ConfirmAlertButton = {
    /** Stable key when list order changes */
    key?: string;
    text: string;
    onPress?: () => void;
    variant?: ConfirmAlertButtonVariant;
    disabled?: boolean;
    /** Overrides variant background */
    backgroundColor?: string;
    /** Overrides variant text color */
    textColor?: string;
    borderColor?: string;
    /** Used when `buttonLayout` is `row` */
    flex?: number;
    /** When false, only `onPress` runs; dialog stays open (default: true) */
    closeOnPress?: boolean;
};

export type ConfirmAlertProps = {
    visible: boolean;
    /** Called when dialog should close: backdrop (if enabled), hardware back, or after you call dismiss from a button. */
    onDismiss: () => void;

    dismissOnBackdropPress?: boolean;
    dismissOnHardwareBack?: boolean;

    /** When false, title row is hidden even if `title` is set */
    showTitle?: boolean;
    title?: string;

    /** When false, message row is hidden even if `message` is set */
    showMessage?: boolean;
    message?: string;

    /** Extra content (icons, inputs). Default: between title and message. */
    children?: React.ReactNode;
    /** Where `children` is rendered relative to title/message */
    childrenPlacement?: 'aboveTitle' | 'betweenTitleAndMessage' | 'belowMessage';

    titleTextStyle?: TextStyle;
    messageTextStyle?: TextStyle;

    buttons: ConfirmAlertButton[];

    /** `auto`: row if ≤2 buttons, else column */
    buttonLayout?: 'row' | 'column' | 'auto';

    overlayStyle?: ViewStyle;
    cardStyle?: ViewStyle;
    maxDialogWidth?: number;

    backdropAccessibilityLabel?: string;
};

const defaultDismissOnBackdrop = true;
const defaultDismissOnHardwareBack = true;

function resolveVariantStyle(
    variant: ConfirmAlertButtonVariant | undefined,
    colors: AppThemeColors,
): { container: ViewStyle; label: TextStyle } {
    switch (variant ?? 'primary') {
        case 'secondary':
            return {
                container: {
                    backgroundColor: colors.secondaryButton,
                    borderWidth: 1,
                    borderColor: colors.border,
                },
                label: { color: colors.text },
            };
        case 'danger':
            return {
                container: { backgroundColor: colors.danger },
                label: { color: '#fff' },
            };
        case 'outline':
            return {
                container: {
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.primary,
                },
                label: { color: colors.primary },
            };
        case 'ghost':
            return {
                container: { backgroundColor: 'transparent' },
                label: { color: colors.primary },
            };
        case 'primary':
        default:
            return {
                container: { backgroundColor: colors.primary },
                label: { color: '#fff' },
            };
    }
}

function buildConfirmStyles(colors: AppThemeColors) {
    return StyleSheet.create({
        root: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
            backgroundColor: colors.overlay,
        },
        card: {
            width: '100%',
            borderRadius: 16,
            backgroundColor: colors.surface,
            paddingHorizontal: 22,
            paddingTop: 22,
            paddingBottom: 18,
            zIndex: 2,
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.12,
                    shadowRadius: 20,
                },
                android: { elevation: 12 },
            }),
        },
        title: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 10,
            textAlign: 'center',
        },
        childrenWrap: {
            marginBottom: 10,
        },
        messageScroll: {
            maxHeight: 220,
            marginBottom: 18,
        },
        message: {
            fontSize: 15,
            lineHeight: 22,
            color: colors.textMuted,
            textAlign: 'center',
        },
        btnRow: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 4,
        },
        btnColumnWrap: {
            flexDirection: 'column',
        },
        btnBase: {
            borderRadius: 12,
            paddingVertical: 13,
            paddingHorizontal: 14,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 48,
        },
        btnColumn: {
            width: '100%',
        },
        btnPressed: {
            opacity: 0.88,
        },
        btnDisabled: {
            opacity: 0.45,
        },
        btnLabel: {
            fontSize: 16,
            fontWeight: '600',
            textAlign: 'center',
        },
    });
}

function ConfirmAlertButtonView({
    btn,
    layout,
    onDismiss,
    colors,
    sheetStyles,
}: {
    btn: ConfirmAlertButton;
    layout: 'row' | 'column';
    onDismiss: () => void;
    colors: AppThemeColors;
    sheetStyles: ReturnType<typeof buildConfirmStyles>;
}) {
    const preset = resolveVariantStyle(btn.variant, colors);
    const containerStyle: ViewStyle = {
        ...preset.container,
        ...(btn.backgroundColor ? { backgroundColor: btn.backgroundColor } : null),
        ...(btn.borderColor
            ? { borderColor: btn.borderColor, borderWidth: StyleSheet.hairlineWidth }
            : btn.variant === 'ghost'
                ? {}
                : {}),
        ...(layout === 'column'
            ? { alignSelf: 'stretch', width: '100%' as const }
            : { flex: typeof btn.flex === 'number' ? btn.flex : 1 }),
    };

    const labelStyle: TextStyle = {
        ...preset.label,
        ...(btn.textColor ? { color: btn.textColor } : null),
    };

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={btn.text}
            accessibilityState={{ disabled: !!btn.disabled }}
            disabled={btn.disabled}
            onPress={() => {
                btn.onPress?.();
                if (btn.closeOnPress !== false) {
                    onDismiss();
                }
            }}
            style={({ pressed }) => [
                sheetStyles.btnBase,
                layout === 'column' && sheetStyles.btnColumn,
                containerStyle,
                pressed && !btn.disabled && sheetStyles.btnPressed,
                btn.disabled && sheetStyles.btnDisabled,
            ]}>
            <Text style={[sheetStyles.btnLabel, labelStyle]} numberOfLines={2}>
                {btn.text}
            </Text>
        </Pressable>
    );
}

export function ConfirmAlert({
    visible,
    onDismiss,
    dismissOnBackdropPress = defaultDismissOnBackdrop,
    dismissOnHardwareBack = defaultDismissOnHardwareBack,
    showTitle,
    title,
    showMessage,
    message,
    children,
    childrenPlacement = 'betweenTitleAndMessage',
    titleTextStyle,
    messageTextStyle,
    buttons,
    buttonLayout = 'auto',
    overlayStyle,
    cardStyle,
    maxDialogWidth = 340,
    backdropAccessibilityLabel = 'Close dialog',
}: ConfirmAlertProps) {
    const insets = useSafeAreaInsets();
    const colors = useThemeColors();
    const sheetStyles = useMemo(() => buildConfirmStyles(colors), [colors]);

    const hasTitleText = Boolean(title?.trim());
    const hasMessageText = Boolean(message?.trim());

    const showTitleRow =
        showTitle !== false && hasTitleText && (showTitle === true || showTitle === undefined);
    const showMessageRow =
        showMessage !== false &&
        hasMessageText &&
        (showMessage === true || showMessage === undefined);

    const layout: 'row' | 'column' = useMemo(() => {
        if (buttonLayout === 'row' || buttonLayout === 'column') {
            return buttonLayout;
        }
        return buttons.length > 2 ? 'column' : 'row';
    }, [buttonLayout, buttons.length]);

    const safeButtons = buttons.length > 0 ? buttons : [{ text: 'OK', variant: 'primary' as const }];

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => {
                if (dismissOnHardwareBack) {
                    onDismiss();
                }
            }}>
            <View
                style={[
                    sheetStyles.root,
                    {
                        paddingTop: insets.top,
                        paddingBottom: insets.bottom,
                    },
                    overlayStyle,
                ]}>
                {dismissOnBackdropPress ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={backdropAccessibilityLabel}
                        style={StyleSheet.absoluteFill}
                        onPress={onDismiss}
                    />
                ) : (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none" />
                )}

                <View
                    style={[sheetStyles.card, { maxWidth: maxDialogWidth }, cardStyle]}
                    pointerEvents="box-none"
                    accessibilityViewIsModal>
                    {children && childrenPlacement === 'aboveTitle' ? (
                        <View style={sheetStyles.childrenWrap}>{children}</View>
                    ) : null}

                    {showTitleRow ? (
                        <Text
                            style={[sheetStyles.title, titleTextStyle]}
                            accessibilityRole="header">
                            {title!.trim()}
                        </Text>
                    ) : null}

                    {children && childrenPlacement === 'betweenTitleAndMessage' ? (
                        <View style={sheetStyles.childrenWrap}>{children}</View>
                    ) : null}

                    {showMessageRow ? (
                        <ScrollView
                            style={sheetStyles.messageScroll}
                            keyboardShouldPersistTaps="handled"
                            automaticallyAdjustKeyboardInsets
                            showsVerticalScrollIndicator={false}
                            showsHorizontalScrollIndicator={false}>
                            <Text style={[sheetStyles.message, messageTextStyle]}>{message!.trim()}</Text>
                        </ScrollView>
                    ) : null}

                    {children && childrenPlacement === 'belowMessage' ? (
                        <View style={sheetStyles.childrenWrap}>{children}</View>
                    ) : null}

                    <View style={[sheetStyles.btnRow, layout === 'column' && sheetStyles.btnColumnWrap]}>
                        {safeButtons.map((btn, index) => (
                            <ConfirmAlertButtonView
                                key={btn.key ?? `${btn.text}-${index}`}
                                btn={btn}
                                layout={layout}
                                onDismiss={onDismiss}
                                colors={colors}
                                sheetStyles={sheetStyles}
                            />
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export type ConfirmAlertPresentConfig = Omit<
    ConfirmAlertProps,
    'visible' | 'onDismiss' | 'buttons'
> & {
    /** Defaults to a single primary “OK” when omitted */
    buttons?: ConfirmAlertButton[];
    /** Runs once after the dialog closes (backdrop, hardware back, or any button with `closeOnPress`) */
    onAfterDismiss?: () => void;
};

const defaultPresentFields: Omit<
    ConfirmAlertPresentConfig,
    'buttons' | 'onAfterDismiss'
> = {
    dismissOnBackdropPress: true,
    dismissOnHardwareBack: true,
    showTitle: undefined,
    showMessage: undefined,
    buttonLayout: 'auto',
};

/**
 * Imperative-friendly state for mounting a single `<ConfirmAlert />` near the root of a screen.
 *
 * @example
 * const { props, present, dismiss } = useConfirmAlert();
 * return (
 *   <>
 *     <YourScreen />
 *     <ConfirmAlert {...props} />
 *   </>
 * );
 */
export function useConfirmAlert() {
    const [visible, setVisible] = useState(false);
    const afterDismissRef = useRef<(() => void) | undefined>(undefined);
    const [payload, setPayload] = useState<Omit<ConfirmAlertPresentConfig, 'onAfterDismiss'>>({
        buttons: [{ text: 'OK', variant: 'primary' }],
    });

    const dismiss = useCallback(() => {
        setVisible(false);
        const cb = afterDismissRef.current;
        afterDismissRef.current = undefined;
        if (cb) {
            setTimeout(cb, 0);
        }
    }, []);

    const present = useCallback((next: ConfirmAlertPresentConfig) => {
        const { onAfterDismiss, ...rest } = next;
        afterDismissRef.current = onAfterDismiss;
        setPayload({
            ...defaultPresentFields,
            ...rest,
            buttons: rest.buttons?.length ? rest.buttons : [{ text: 'OK', variant: 'primary' }],
        });
        setVisible(true);
    }, []);

    const props = useMemo((): ConfirmAlertProps => {
        const { buttons: rawButtons, ...rest } = payload;
        const buttons =
            rawButtons && rawButtons.length > 0
                ? rawButtons
                : [{ text: 'OK', variant: 'primary' as const }];
        return {
            visible,
            onDismiss: dismiss,
            ...rest,
            buttons,
        };
    }, [visible, dismiss, payload]);

    return { props, present, dismiss, visible };
}
