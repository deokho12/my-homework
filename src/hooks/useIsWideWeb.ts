import { Platform, useWindowDimensions } from 'react-native';

export const WIDE_WEB_BREAKPOINT = 768;

export function useIsWideWeb() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_WEB_BREAKPOINT;
}
