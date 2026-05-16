import Svg, { Path } from 'react-native-svg';

export type SocialBrand = 'google' | 'facebook' | 'twitter' | 'microsoft';

type Props = {
  brand: SocialBrand;
  /** Icon box size (square). */
  size?: number;
  /** Primary fill for single-path brands; Microsoft uses fixed brand colors. */
  color: string;
};

/**
 * SVG brand marks (no icon fonts). Paths from Simple Icons (CC0), except
 * Microsoft four-square layout (official colors).
 */
export function SocialLoginIcon({ brand, size = 28, color }: Props) {
  const s = size;

  if (brand === 'microsoft') {
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
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24" accessibilityElementsHidden>
        <Path
          fill={color}
          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
        />
      </Svg>
    );
  }

  if (brand === 'facebook') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24" accessibilityElementsHidden>
        <Path
          fill={color}
          d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
        />
      </Svg>
    );
  }

  // X (Twitter)
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill={color}
        d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"
      />
    </Svg>
  );
}
