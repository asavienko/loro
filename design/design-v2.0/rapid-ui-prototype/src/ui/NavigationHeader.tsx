import { useEffect, useState } from 'react';
import { points as pointsOf } from '../state/selectors';
import { useCopy, useStore } from '../state/store';
import { Icon } from './Icon';

interface NavigationHeaderProps {
  title?: string;
  /** When set, the header shows Back instead of the profile and points. */
  onBack?: () => void;
  onOpenSettings: () => void;
  /** True while a full-screen overlay covers the app. */
  inert?: boolean;
  /** Shown once the page has scrolled past its own title (the set page). */
  scrolledTitle?: string;
  /** Match a page in the narrower reading column (the set page), so Back lines up with it. */
  narrow?: boolean;
}

const TITLE_SCROLL_PX = 140;

function useScrolledPast(px: number, active: boolean): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!active) return;
    const onScroll = () => setPast(window.scrollY > px);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [px, active]);
  return active && past;
}

export function NavigationHeader({ title, onBack, onOpenSettings, inert = false, scrolledTitle, narrow = false }: NavigationHeaderProps) {
  const past = useScrolledPast(TITLE_SCROLL_PX, Boolean(scrolledTitle));
  const c = useCopy();
  const { state } = useStore();
  const points = pointsOf(state.learner);
  const name = state.learner.profile.name;
  return (
    <header inert={inert} className="fixed top-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-b border-surface-container-high pt-[env(safe-area-inset-top)]">
      <div className={`h-14 px-4 flex items-center gap-3 mx-auto ${narrow ? 'max-w-3xl' : 'max-w-5xl'}`}>
        {onBack ? (
          <button
            type="button"
            aria-label={c.common.back}
            onClick={onBack}
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full text-on-surface active:bg-surface-container"
          >
            <Icon name="arrow_back" className="text-icon-lg" />
          </button>
        ) : (
          <>
            <button
              type="button"
              aria-label={c.nav.settings(name)}
              onClick={onOpenSettings}
              className="w-11 h-11 -ml-1.5 flex items-center justify-center rounded-full shrink-0 active:bg-surface-container"
            >
              <span aria-hidden="true" className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-serif font-bold flex items-center justify-center">
                {name ? name.charAt(0).toLocaleUpperCase() : <Icon name="person" className="text-icon-md" />}
              </span>
            </button>
            <p
              data-testid="points"
              className="flex items-center gap-1 bg-surface-container-low border border-outline-variant/40 px-2.5 h-8 rounded-full text-on-primary-fixed-variant shrink-0"
            >
              <span className="sr-only">{c.nav.points(points)}</span>
              <Icon name="stars" fill className="text-icon-xs text-primary-container" />
              <span aria-hidden="true" className="text-body font-bold tabular-nums">{new Intl.NumberFormat(c.locale).format(points)}</span>
              <span aria-hidden="true" className="text-label text-secondary font-medium">{c.nav.pointsShort}</span>
            </p>
          </>
        )}
        {title && <h1 className="font-serif font-semibold text-lg text-on-surface truncate">{title}</h1>}
        {scrolledTitle && (
          <p aria-hidden={!past} className={`font-serif font-semibold text-lg text-on-surface truncate transition-opacity ${past ? 'opacity-100' : 'opacity-0'}`}>
            {scrolledTitle}
          </p>
        )}
      </div>
    </header>
  );
}
