import type { IconName } from './icons';

export type { IconName } from './icons';

/**
 * A Material Symbols icon from the local subset font. Decorative: the control
 * around it carries the accessible name. Size with the `text-icon-*` scale.
 */
export function Icon({ name, fill = false, className = '' }: { name: IconName; fill?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${fill ? 'material-symbols-fill' : ''} ${className}`}>
      {name}
    </span>
  );
}
