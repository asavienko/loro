// Music's screens are dark: a light status bar while one is in front (tabs stay mounted, so only
// the focused screen sets it).
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';

export function NightStatusBar() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused ? <StatusBar style="light" /> : null;
}
