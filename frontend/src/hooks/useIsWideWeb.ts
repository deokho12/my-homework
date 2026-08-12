import { useWindowDimensions } from '@/primitives';

export const WIDE_WEB_BREAKPOINT = 768;

export function useIsWideWeb() {
  const { width } = useWindowDimensions();
  return width >= WIDE_WEB_BREAKPOINT;
}
