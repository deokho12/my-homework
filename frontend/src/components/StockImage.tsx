import { useState } from 'react';

import { Image, StyleSheet, Text, View, type RNStyle } from '@/primitives';

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
          <Text className="text-2xl text-brand-600">🦷</Text>
        </View>
      )}

      {status === 'loading' ? (
        <View className="bg-neutral-200" style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  );
}
