import { useEffect, useState } from 'react';
import { waitForVoices } from '../audio/speech';

/**
 * Whether the device's voice list has been checked, and a count that changes whenever the
 * list does. Some devices (often Android Chrome) load their voices well after the first
 * check gives up, so a voice shown as missing appears once it arrives.
 */
export function useVoiceList(): { ready: boolean; version: number } {
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    void waitForVoices().then(() => live && setReady(true));
    const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    const changed = () => {
      setReady(true);
      setVersion((v) => v + 1);
    };
    synth?.addEventListener('voiceschanged', changed);
    return () => {
      live = false;
      synth?.removeEventListener('voiceschanged', changed);
    };
  }, []);
  return { ready, version };
}
