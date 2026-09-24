// How much of the layout viewport the on-screen keyboard covers. Chrome on
// Android resizes the page itself (interactive-widget=resizes-content in
// index.html); iOS Safari overlays the keyboard, and only the visual viewport
// shrinks, so a bottom sheet's fields and button would sit under it.
import { useEffect, useState } from 'react';

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}
