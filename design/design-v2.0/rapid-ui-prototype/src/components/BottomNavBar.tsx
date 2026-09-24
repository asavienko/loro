export type Tab = 'home' | 'explore' | 'library';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'explore', label: 'Explore', icon: 'search' },
  { id: 'library', label: 'Library', icon: 'library_music' },
];

interface BottomNavBarProps {
  current: Tab;
  onNavigate: (tab: Tab) => void;
  /** True while a full-screen overlay covers the app. */
  inert?: boolean;
}

/** Full-width native-style tab bar above the home indicator. */
export function BottomNavBar({ current, onNavigate, inert = false }: BottomNavBarProps) {
  return (
    <nav
      inert={inert}
      aria-label="Main"
      className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-surface-container-high pb-[env(safe-area-inset-bottom)]"
    >
      <div className="h-14 grid grid-cols-3 max-w-3xl mx-auto">
        {TABS.map((tab) => {
          const active = tab.id === current;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 active:bg-surface-container ${
                active ? 'text-primary-container font-bold' : 'text-secondary font-medium'
              }`}
            >
              <span aria-hidden="true" className={`material-symbols-outlined text-[24px] ${active ? 'material-symbols-fill' : ''}`}>
                {tab.icon}
              </span>
              <span className="text-[11px] leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
