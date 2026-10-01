// A drag isn't a tap. On a phone, a gesture that takes over cancels the press under the finger; in a
// browser the click still arrives when the button is let go, on whatever moved along under the
// pointer (a card swiped, a window pulled). While a drag is on, that click is caught before it lands.
import { Platform } from 'react-native';

let release: (() => void) | null = null;

/** A drag began: the click that ends it presses nothing. */
export function holdClicks(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || release) return;
  const swallow = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', swallow, true);
  release = () => window.removeEventListener('click', swallow, true);
}

/** The drag ended: once its click has had time to arrive, clicks press again. */
export function releaseClicks(): void {
  if (!release) return;
  const done = release;
  release = null;
  setTimeout(done, 0);
}
