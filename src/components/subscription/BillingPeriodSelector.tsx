import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import type { AppThemeColors } from '@src/theme/palettes';
import type {
  SubscriptionPackage,
  SubscriptionPeriod,
} from '@src/types/subscriptionPackage';
import {
  formatSubscriptionPrice,
  getAllBillingPeriodSlots,
  type BillingPeriodSlot,
} from '@src/utils/subscriptionBilling';

const ACCENT = '#4f46e5';

const PERIOD_ROW_TOP: SubscriptionPeriod[] = ['monthly', 'quarterly'];
const PERIOD_ROW_BOTTOM: SubscriptionPeriod[] = ['half_yearly', 'yearly'];

type BillingPeriodSelectorProps = {
  pkg: SubscriptionPackage;
  selectedPeriod: SubscriptionPeriod | null;
  onSelectPeriod: (period: SubscriptionPeriod) => void;
  colors: AppThemeColors;
  dark: boolean;
  sectionLabel: string;
};

function buildStyles(colors: AppThemeColors, dark: boolean) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 0,
    },
    sectionLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    rows: {
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    card: {
      flex: 1,
      minWidth: 0,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingVertical: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 108,
    },
    cardSelected: {
      borderColor: ACCENT,
      backgroundColor: dark ? 'rgba(79,70,229,0.18)' : '#eef2ff',
    },
    cardUnavailable: {
      borderColor: dark ? 'rgba(148,163,184,0.35)' : '#e2e8f0',
      borderStyle: 'dashed',
      backgroundColor: dark ? 'rgba(15,23,42,0.45)' : '#f8fafc',
      opacity: 0.92,
    },
    cardPressed: {
      opacity: 0.92,
    },
    discountBadge: {
      position: 'absolute',
      top: -10,
      alignSelf: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: dark ? '#15803d' : '#16a34a',
    },
    discountText: {
      fontSize: 10,
      fontWeight: '800',
      color: '#fff',
    },
    periodLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 6,
    },
    periodLabelSelected: {
      color: ACCENT,
      fontWeight: '700',
    },
    periodLabelUnavailable: {
      color: dark ? '#64748b' : '#94a3b8',
    },
    periodPrice: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    periodPriceSelected: {
      color: ACCENT,
    },
    unavailableIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: dark ? 'rgba(148,163,184,0.15)' : '#f1f5f9',
      marginBottom: 6,
    },
    unavailableLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: dark ? '#64748b' : '#94a3b8',
      textAlign: 'center',
      letterSpacing: 0.2,
    },
    unavailableHint: {
      marginTop: 4,
      fontSize: 9,
      fontWeight: '500',
      color: dark ? '#475569' : '#cbd5e1',
      textAlign: 'center',
      lineHeight: 12,
      paddingHorizontal: 2,
    },
    selectedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: ACCENT,
      marginTop: 8,
    },
    planHint: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: dark ? 'rgba(148,163,184,0.12)' : '#f1f5f9',
      borderWidth: 1,
      borderColor: dark ? 'rgba(148,163,184,0.2)' : '#e2e8f0',
    },
    planHintText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
    allUnavailableBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      backgroundColor: dark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      borderWidth: 1,
      borderColor: dark ? 'rgba(248,113,113,0.35)' : '#fecaca',
    },
    allUnavailableText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: dark ? '#fca5a5' : '#991b1b',
      fontWeight: '600',
    },
  });
}

type PeriodCardProps = {
  slot: BillingPeriodSlot;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof buildStyles>;
  periodTitle: string;
  saveLabel: string | null;
  notAvailableLabel: string;
  notAvailableHint: string;
  dark: boolean;
};

function PeriodCard({
  slot,
  selected,
  onPress,
  styles,
  periodTitle,
  saveLabel,
  notAvailableLabel,
  notAvailableHint,
  dark,
}: PeriodCardProps) {
  if (!slot.available) {
    return (
      <View
        style={[styles.card, styles.cardUnavailable]}
        accessibilityRole="text"
        accessibilityLabel={`${periodTitle}, ${notAvailableLabel}`}
      >
        <Text style={[styles.periodLabel, styles.periodLabelUnavailable]}>
          {periodTitle}
        </Text>
        <View style={styles.unavailableIconWrap}>
          <MaterialCommunityIcons
            name="minus-circle-outline"
            size={18}
            color={dark ? '#64748b' : '#94a3b8'}
          />
        </View>
        <Text style={styles.unavailableLabel}>{notAvailableLabel}</Text>
        <Text style={styles.unavailableHint} numberOfLines={2}>
          {notAvailableHint}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      {saveLabel != null ? (
        <View style={styles.discountBadge}>
          <Text style={styles.discountText} numberOfLines={1}>
            {saveLabel}
          </Text>
        </View>
      ) : null}
      <Text
        style={[styles.periodLabel, selected && styles.periodLabelSelected]}
        numberOfLines={2}
      >
        {periodTitle}
      </Text>
      <Text
        style={[styles.periodPrice, selected && styles.periodPriceSelected]}
        numberOfLines={1}
      >
        {formatSubscriptionPrice(slot.price ?? 0)}
      </Text>
      {selected ? <View style={styles.selectedDot} /> : null}
    </Pressable>
  );
}

type PeriodRowProps = {
  slots: BillingPeriodSlot[];
  order: SubscriptionPeriod[];
  selectedPeriod: SubscriptionPeriod | null;
  onSelectPeriod: (period: SubscriptionPeriod) => void;
  styles: ReturnType<typeof buildStyles>;
  periodTitle: (key: BillingPeriodSlot['labelKey']) => string;
  saveLabelFor: (slot: BillingPeriodSlot) => string | null;
  notAvailableLabel: string;
  notAvailableHint: string;
  dark: boolean;
};

function PeriodRow({
  slots,
  order,
  selectedPeriod,
  onSelectPeriod,
  styles,
  periodTitle,
  saveLabelFor,
  notAvailableLabel,
  notAvailableHint,
  dark,
}: PeriodRowProps) {
  const byKey = useMemo(
    () => new Map(slots.map(slot => [slot.key, slot])),
    [slots],
  );

  return (
    <View style={styles.row}>
      {order.map(key => {
        const slot = byKey.get(key);
        if (slot == null) {
          return null;
        }
        return (
          <PeriodCard
            key={slot.key}
            slot={slot}
            selected={selectedPeriod === slot.key}
            onPress={() => onSelectPeriod(slot.key)}
            styles={styles}
            periodTitle={periodTitle(slot.labelKey)}
            saveLabel={saveLabelFor(slot)}
            notAvailableLabel={notAvailableLabel}
            notAvailableHint={notAvailableHint}
            dark={dark}
          />
        );
      })}
    </View>
  );
}

export function BillingPeriodSelector({
  pkg,
  selectedPeriod,
  onSelectPeriod,
  colors,
  dark,
  sectionLabel,
}: BillingPeriodSelectorProps) {
  const { t } = useTranslation();
  const styles = useMemo(() => buildStyles(colors, dark), [colors, dark]);

  const slots = useMemo(() => getAllBillingPeriodSlots(pkg), [pkg]);
  const hasAnyAvailable = slots.some(slot => slot.available);
  const hasUnavailable = slots.some(slot => !slot.available);

  const periodTitle = useCallback(
    (key: BillingPeriodSlot['labelKey']) => t(key),
    [t],
  );

  const saveLabelFor = useCallback(
    (slot: BillingPeriodSlot) =>
      slot.discountPercent != null
        ? t('settings.subscriptionScreen.saveDiscount', {
            percent: slot.discountPercent,
          })
        : null,
    [t],
  );

  const handleSelectPeriod = useCallback(
    (period: SubscriptionPeriod) => {
      const slot = slots.find(s => s.key === period);
      if (slot?.available) {
        onSelectPeriod(period);
      }
    },
    [onSelectPeriod, slots],
  );

  const notAvailableLabel = t(
    'settings.subscriptionScreen.periodNotAvailable',
  );
  const notAvailableHint = t(
    'settings.subscriptionScreen.periodNotAvailableForPlan',
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>{sectionLabel}</Text>

      {!hasAnyAvailable ? (
        <View style={styles.allUnavailableBanner}>
          <MaterialCommunityIcons
            name="calendar-remove-outline"
            size={22}
            color={dark ? '#fca5a5' : '#dc2626'}
          />
          <Text style={styles.allUnavailableText}>
            {t('settings.subscriptionScreen.noPeriodsForPlan')}
          </Text>
        </View>
      ) : (
        <View style={styles.rows}>
          <PeriodRow
            slots={slots}
            order={PERIOD_ROW_TOP}
            selectedPeriod={selectedPeriod}
            onSelectPeriod={handleSelectPeriod}
            styles={styles}
            periodTitle={periodTitle}
            saveLabelFor={saveLabelFor}
            notAvailableLabel={notAvailableLabel}
            notAvailableHint={notAvailableHint}
            dark={dark}
          />
          <PeriodRow
            slots={slots}
            order={PERIOD_ROW_BOTTOM}
            selectedPeriod={selectedPeriod}
            onSelectPeriod={handleSelectPeriod}
            styles={styles}
            periodTitle={periodTitle}
            saveLabelFor={saveLabelFor}
            notAvailableLabel={notAvailableLabel}
            notAvailableHint={notAvailableHint}
            dark={dark}
          />
        </View>
      )}

      {hasAnyAvailable && hasUnavailable ? (
        <View style={styles.planHint}>
          <MaterialCommunityIcons
            name="information-outline"
            size={16}
            color={colors.textMuted}
          />
          <Text style={styles.planHintText}>
            {t('settings.subscriptionScreen.periodAvailabilityHint')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
