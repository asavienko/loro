import type { ReactNode } from 'react';
import type { SetView } from '../state/catalog';
import { Icon } from './Icon';
import { SetCover } from './SetCover';

interface SetRowProps {
  /** A set, or a stand-in with no id (History's mixed queue): its title is then in the UI language. */
  set: Pick<SetView, 'title' | 'topicId' | 'coverIcon'> & Partial<Pick<SetView, 'id' | 'targetLang'>>;
  /** One line under the title, e.g. "5 phrases · 3 learned · 2 due". */
  meta: string;
  onOpen: () => void;
  /** A row that leads nowhere (a set since deleted): shown, not tappable. */
  disabled?: boolean;
  /** A control after the row, such as a 44 px play button; without one, an openable row ends in a chevron. */
  action?: ReactNode;
}

/** A set as a flat list row, like a track row: cover, serif title, meta. No box around it. */
export function SetRow({ set, meta, onOpen, disabled = false, action }: SetRowProps) {
  return (
    <div className="-mx-2 flex items-center gap-1">
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className="flex-1 min-w-0 min-h-16 px-2 py-2 flex items-center gap-3 text-left rounded-2xl active:bg-surface-container"
      >
        <SetCover set={set} size="sm" className="w-14 h-14 rounded-xl shrink-0" />
        <span className="flex-1 min-w-0">
          <span lang={set.targetLang} className="block font-serif text-row font-semibold text-on-surface truncate">
            {set.title}
          </span>
          <span className="block text-label text-secondary">{meta}</span>
        </span>
        {!action && !disabled && <Icon name="chevron_right" className="text-icon text-secondary" />}
      </button>
      {action && <span className="shrink-0 pr-2">{action}</span>}
    </div>
  );
}
