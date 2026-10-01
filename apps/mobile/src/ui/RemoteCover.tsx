// A drawn cover from the API (plan 106): the SVG a set, album, song or phrase got from Claude or the
// server's pattern, filling its frame (a square, or a phrase's picture of another shape, cropped to
// fit). Covers are shapes and colours only (the server renders them from a checked spec), so there is
// nothing in one to read aloud.
import { useState } from 'react';
import { View, ViewStyle } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { apiUrl } from '@shared/api/client';
import { colors } from './theme';

export function RemoteCover({ url, px, height = px, rounded = 16, style, fallback }: { url: string; px: number; height?: number; rounded?: number; style?: ViewStyle; fallback?: React.ReactNode }) {
  // The address that failed: a new one (a new cover drawn) is tried afresh.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (failedUrl === url && fallback) return <>{fallback}</>;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[{ width: px, height, borderRadius: rounded, overflow: 'hidden', backgroundColor: colors.surfaceContainer }, style]}
    >
      <SvgUri uri={apiUrl(url)} width={px} height={height} preserveAspectRatio="xMidYMid slice" onError={() => setFailedUrl(url)} />
    </View>
  );
}
