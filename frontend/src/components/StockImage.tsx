import { ImageOff } from 'lucide-react';
import { useState } from 'react';

import { Image, StyleSheet, View, type RNStyle } from '@/primitives';

/** brand-600 — brand-50 대체 상자 위에서 4.8:1 이다. */
const FALLBACK_ICON_COLOR = '#17847a';

interface StockImageProps {
  uri: string;
  /** Required for accessibility/SEO — describes the photo content, not just the subject. */
  alt: string;
  style?: RNStyle;
  contentFit?: 'cover' | 'contain';
  borderRadius?: number;
}

/**
 * Wraps <img> with a skeleton while loading and a branded fallback box if the image
 * fails to load — e.g. a hospital hasn't uploaded a photo yet in production. Layout
 * (via `style`) stays identical across loading/error/loaded states so nothing shifts.
 */
export function StockImage({ uri, alt, style, contentFit = 'cover', borderRadius }: StockImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  const radiusStyle = borderRadius != null ? { borderRadius, overflow: 'hidden' as const } : null;

  return (
    <View style={[style, radiusStyle]}>
      {status !== 'error' ? (
        <Image
          source={{ uri }}
          alt={alt}
          style={{ ...StyleSheet.absoluteFill, width: '100%', height: '100%' }}
          contentFit={contentFit}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      ) : (
        <View
          className="items-center justify-center bg-brand-50"
          style={StyleSheet.absoluteFill}
          accessibilityLabel={alt}
        >
          {/* 🦷 이모지였다 (SYS-22). "사진이 없다" 를 말하는 자리라 치아보다 이쪽이 정확하다. */}
          <ImageOff size={28} color={FALLBACK_ICON_COLOR} aria-hidden />
        </View>
      )}

      {status === 'loading' ? (
        <View className="bg-neutral-200" style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  );
}
