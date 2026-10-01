import { useWindowDimensions } from 'react-native';
import { isCompact } from '@shared/ui/room';

/** The window, and whether it is compact for its text size (`@shared/ui/room`). */
export function useRoom() {
  const { width, height, fontScale } = useWindowDimensions();
  return { width, height, fontScale, compact: isCompact(width, fontScale) };
}
