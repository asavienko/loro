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

/** Full-width native-style tab bar above the home indicator. */
export function BottomNavBar({ current, onNavigate, inert = false }: BottomNavBarProps) {
  const c = useCopy();
  return (
    <nav
      inert={inert}
      aria-label={c.nav.main}
      className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-surface-container-high pb-[env(safe-area-inset-bottom)]"
    >
      <div className="h-14 phone-landscape:h-11 grid grid-cols-3 max-w-5xl mx-auto">
        {TABS.map((tab) => {
          const active = tab.id === current;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col phone-landscape:flex-row items-center justify-center gap-0.5 phone-landscape:gap-2 active:bg-surface-container ${
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
