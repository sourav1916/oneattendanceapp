import Svg, { Path } from 'react-native-svg';

export type SocialBrand = 'google' | 'facebook' | 'twitter' | 'microsoft';

type Props = {
  brand: SocialBrand;
  /** Icon box size (square). */
  size?: number;
  /** When true, renders a muted monochrome variant (e.g. disabled providers). */
  disabled?: boolean;
  /** Used for monochrome brands (e.g. X) on dark backgrounds. */
  darkMode?: boolean;
};

const MUTED = '#94a3b8';

/**
 * Brand marks with official colors (not theme tint).
 * Paths from Simple Icons (CC0) where noted.
 */
export function SocialLoginIcon({
  brand,
  size = 28,
  disabled = false,
  darkMode = false,
}: Props) {
  const s = size;

  if (brand === 'microsoft') {
    if (disabled) {
      return (
        <Svg width={s} height={s} viewBox="0 0 11 11" accessibilityElementsHidden>
          <Path fill={MUTED} d="M0 0h5v5H0z" />
          <Path fill={MUTED} d="M6 0h5v5H6z" />
          <Path fill={MUTED} d="M0 6h5v5H0z" />
          <Path fill={MUTED} d="M6 6h5v5H6z" />
        </Svg>
      );
    }
    return (
      <Svg width={s} height={s} viewBox="0 0 11 11" accessibilityElementsHidden>
        <Path fill="#f25022" d="M0 0h5v5H0z" />
        <Path fill="#7fba00" d="M6 0h5v5H6z" />
        <Path fill="#00a4ef" d="M0 6h5v5H0z" />
        <Path fill="#ffb900" d="M6 6h5v5H6z" />
      </Svg>
    );
  }

  if (brand === 'google') {
    if (disabled) {
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" accessibilityElementsHidden>
          <Path
            fill={MUTED}
            d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
          />
        </Svg>
      );
    }
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24" accessibilityElementsHidden>
        <Path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <Path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <Path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <Path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </Svg>
    );
  }

  if (brand === 'facebook') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24" accessibilityElementsHidden>
        <Path
          fill={disabled ? MUTED : '#1877F2'}
          d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
        />
      </Svg>
    );
  }

  // X (Twitter)
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill={disabled ? MUTED : darkMode ? '#f1f5f9' : '#0f172a'}
        d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"
      />
    </Svg>
  );
}
