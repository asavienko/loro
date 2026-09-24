import { PROFILE } from '../content';
import { useStore } from '../state/store';

interface NavigationHeaderProps {
  title?: string;
  /** When set, the header shows Back instead of the profile and points. */
  onBack?: () => void;
  onOpenSettings: () => void;
  /** True while a full-screen overlay covers the app. */
  inert?: boolean;
}

export function NavigationHeader({ title, onBack, onOpenSettings, inert = false }: NavigationHeaderProps) {
  const { state } = useStore();
  const points = state.learner.points;
  return (
    <header inert={inert} className="fixed top-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-b border-surface-container-high pt-[env(safe-area-inset-top)]">
      <div className="h-14 px-4 flex items-center gap-3 max-w-3xl mx-auto">
        {onBack ? (
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full text-on-surface active:bg-surface-container"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              aria-label={`${PROFILE.name}: settings`}
              onClick={onOpenSettings}
              className="w-11 h-11 -ml-1.5 flex items-center justify-center rounded-full shrink-0 active:bg-surface-container"
            >
              <span
                aria-hidden="true"
                className="w-8 h-8 rounded-full bg-primary-container text-on-primary font-serif font-bold flex items-center justify-center"
              >
                {PROFILE.name.charAt(0)}
              </span>
            </button>
            <p
              aria-label={`${points} points`}
              className="flex items-center gap-1 bg-surface-container-low border border-outline-variant/40 px-2.5 h-8 rounded-full text-on-primary-fixed-variant shrink-0"
            >
              <span aria-hidden="true" className="material-symbols-outlined material-symbols-fill text-[16px] text-primary-container">stars</span>
              <span aria-hidden="true" className="text-sm font-bold tabular-nums">{points}</span>
              <span aria-hidden="true" className="text-xs text-secondary font-medium">pts</span>
            </p>
          </>
        )}
        {title && <h1 className="font-serif font-semibold text-lg text-on-surface truncate">{title}</h1>}
      </div>
    </header>
  );
}
