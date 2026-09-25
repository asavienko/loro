import type { Tab } from '../nav/routes';
import { useCopy } from '../state/store';
import { Icon, IconName } from './Icon';

const TABS: { id: Tab; icon: IconName }[] = [
  { id: 'home', icon: 'home' },
  { id: 'explore', icon: 'search' },
  { id: 'library', icon: 'library_music' },
];

interface BottomNavBarProps {
  current: Tab;
  onNavigate: (tab: Tab) => void;
  /** True while a full-screen overlay covers the app. */
  inert?: boolean;
}

/**
 * Full-width native-style tab bar above the home indicator; on a wide screen (lg) a navigation
 * rail down the left edge, tabs stacked under the top bar's height (App pads the page for it).
 */
export function BottomNavBar({ current, onNavigate, inert = false }: BottomNavBarProps) {
  const c = useCopy();
  return (
    <nav
      inert={inert}
      aria-label={c.nav.main}
      className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-surface-container-high pb-[env(safe-area-inset-bottom)] lg:inset-y-0 lg:right-auto lg:w-20 lg:border-t-0 lg:border-r lg:pb-0 lg:pt-[calc(4rem+env(safe-area-inset-top))]"
    >
      <div className="h-14 phone-landscape:h-11 grid grid-cols-3 max-w-5xl mx-auto lg:h-auto lg:grid-cols-1 lg:auto-rows-[4.5rem] lg:gap-1">
        {TABS.map((tab) => {
          const active = tab.id === current;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col phone-landscape:flex-row items-center justify-center gap-0.5 phone-landscape:gap-2 lg:gap-1 lg:mx-1.5 lg:rounded-2xl active:bg-surface-container ${
                active ? 'text-primary-container font-bold' : 'text-secondary font-medium'
              }`}
            >
              <Icon name={tab.icon} fill={active} className="text-icon-lg" />
              <span className="text-caption leading-none">{c.nav[tab.id]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
