import type { CSSProperties } from 'react';

/**
 * React Native style objects differ from CSS in two ways this app actually relies on:
 *  - they can be nested arrays (and contain false/null/undefined holes), and
 *  - unit-less numbers mean device-independent pixels.
 *
 * These helpers normalise both so the ported screens can keep passing their existing
 * `style={[a, b]}` / `style={{ width: 64 }}` props unchanged.
 */
export type RNStyle = CSSProperties | false | null | undefined | RNStyle[];

/** Numeric style props that are genuinely unit-less in CSS and must not get `px` appended. */
const UNITLESS = new Set([
  'aspectRatio',
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'opacity',
  'order',
  'zIndex',
  'zoom',
  'WebkitLineClamp',
  'lineClamp',
]);

/** React Native-only props with no CSS meaning on the web. RNW drops these too. */
const DROPPED = new Set(['textAlignVertical', 'includeFontPadding', 'elevation', 'shadowColor', 'shadowOffset', 'shadowOpacity', 'shadowRadius']);

export function flattenStyle(style: RNStyle): CSSProperties {
  if (!style) return {};

  if (Array.isArray(style)) {
    return style.reduce<CSSProperties>((acc, item) => ({ ...acc, ...flattenStyle(item) }), {});
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style)) {
    if (value == null || DROPPED.has(key)) continue;
    out[key] = typeof value === 'number' && !UNITLESS.has(key) ? `${value}px` : value;
  }
  return out as CSSProperties;
}

/** Mirrors react-native's StyleSheet API surface for the parts this app uses. */
export const StyleSheet = {
  create: <T extends Record<string, CSSProperties>>(styles: T): T => styles,
  flatten: flattenStyle,
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  } as CSSProperties,
  absoluteFillObject: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  } as CSSProperties,
  hairlineWidth: 1,
};

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
