import { useEffect, useState } from 'react';
import { points as pointsOf } from '../state/selectors';
import { useCopy, useStore } from '../state/store';
import { btnIcon } from './button';
import { Icon } from './Icon';

interface NavigationHeaderProps {
  /** The page's h1, between the avatar and the points. */
  title?: string;
  /** The title's language when it is the one being learned (Home's greeting): serif italic, as that language always is. */
  titleLang?: string;
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

export function NavigationHeader({ title, titleLang, onBack, onOpenSettings, inert = false, scrolledTitle, narrow = false }: NavigationHeaderProps) {
  const past = useScrolledPast(TITLE_SCROLL_PX, Boolean(scrolledTitle));
  const c = useCopy();
  const { state } = useStore();
  const points = pointsOf(state.learner);
  const name = state.learner.profile.name;
  return (
    // A size container: at large text the points drop their "pts" (the star and the screen-reader
    // text keep the meaning) and the gaps close up before the title is cut.
    <header inert={inert} className="@container fixed top-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-b border-surface-container-high pt-[env(safe-area-inset-top)]">
      <div className={`h-14 px-4 flex items-center gap-3 @max-[18rem]:gap-2 mx-auto ${narrow ? 'max-w-3xl' : 'max-w-5xl'}`}>
        {/* Keyed apart: reusing one button for both would keep focus on it after Back, and
            App's focus return (to the card that opened the page) only steps in from <body>. */}
        {onBack ? (
          <button key="back" type="button" aria-label={c.common.back} onClick={onBack} className={`${btnIcon} -ml-2 text-on-surface`}>
            <Icon name="arrow_back" className="text-icon-lg" />
          </button>
        ) : (
          <button key="profile" type="button" aria-label={c.nav.settings(name)} onClick={onOpenSettings} className={`${btnIcon} -ml-1.5`}>
            <span aria-hidden="true" className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-serif font-bold flex items-center justify-center">
              {name ? name.charAt(0).toLocaleUpperCase() : <Icon name="person" className="text-icon-md" />}
            </span>
          </button>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <h1 lang={titleLang} className={`font-serif text-heading text-on-surface truncate ${titleLang ? 'italic font-medium' : 'font-semibold'}`}>
              {title}
            </h1>
          )}
          {scrolledTitle && (
            <p aria-hidden={!past} className={`font-serif font-semibold text-heading text-on-surface truncate transition-opacity ${past ? 'opacity-100' : 'opacity-0'}`}>
              {scrolledTitle}
            </p>
          )}
        </div>
        {!onBack && (
          <p data-testid="points" className="shrink-0 -mr-1 h-8 px-2.5 rounded-full bg-surface-container-low text-on-primary-fixed-variant flex items-center gap-1">
            <span className="sr-only">{c.nav.points(points)}</span>
            <Icon name="stars" fill className="text-icon-xs text-primary-container" />
            <span aria-hidden="true" className="text-body font-bold tabular-nums">{new Intl.NumberFormat(c.locale).format(points)}</span>
            <span aria-hidden="true" className="text-label text-secondary font-medium @max-[18rem]:hidden">{c.nav.pointsShort(points)}</span>
          </p>
        )}
      </div>
    </header>
  );
}
