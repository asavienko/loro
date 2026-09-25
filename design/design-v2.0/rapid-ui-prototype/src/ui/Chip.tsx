import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'role' | 'className' | 'children'> & {
  children: ReactNode;
  /** On: ink, not terracotta (terracotta fill means play). */
  selected?: boolean;
  /** A tab in a tablist (pass id, aria-controls, tabIndex and onKeyDown); otherwise a toggle with aria-pressed. */
  role?: 'tab';
  /** An active filter that a tap removes: ink with an ×, and no pressed state. Name it with aria-label. */
  removable?: boolean;
};

/**
 * A filter chip: a 36 px pill inside a 44 px target, so a row of them stays light while every
 * one is easy to hit. It doesn't wrap its label: in a scrolling row it scrolls, never squeezes.
 */
export function Chip({ children, selected = false, role, removable = false, ...rest }: ChipProps) {
  const on = selected || removable;
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === 'tab' ? selected : undefined}
      aria-pressed={role === 'tab' || removable ? undefined : selected}
      className="chip min-h-11 inline-flex items-center rounded-full forced-colors:border-0"
      {...rest}
    >
      <span
        className={`min-h-9 inline-flex items-center gap-1 rounded-full border text-body font-semibold whitespace-nowrap ${removable ? 'pl-3.5 pr-2' : 'px-3.5'} ${
          on ? 'bg-inverse-surface border-inverse-surface text-inverse-on-surface' : 'bg-surface-container-low border-hairline text-on-surface'
        }`}
      >
        {children}
        {removable && <Icon name="close" className="text-icon-sm" />}
      </span>
    </button>
  );
}
