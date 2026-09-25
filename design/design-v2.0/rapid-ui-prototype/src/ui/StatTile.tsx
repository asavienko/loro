import { Icon, IconName } from './Icon';

interface StatTileProps {
  label: string;
  value: string | number;
  /** A quieter line saying what the number means. */
  note?: string;
  /** Opens what the number counts. Without it the tile is a dt/dd pair, so put it in a <dl>. */
  onClick?: () => void;
  /** `horizontal` puts the value on the left: a one-column list of stats on a phone. */
  layout?: 'vertical' | 'horizontal';
}

/**
 * One figure on a tonal card: label, a serif value, an optional note. The label comes first in
 * the markup whatever the layout, so a button's name and a dt/dd pair both read "Learned 3".
 */
export function StatTile({ label, value, note, onClick, layout = 'vertical' }: StatTileProps) {
  const horizontal = layout === 'horizontal';
  const Term = onClick ? 'span' : 'dt';
  const Detail = onClick ? 'span' : 'dd';
  const parts = (
    <>
      <Term className={`text-label font-semibold text-secondary break-words hyphens-auto ${horizontal ? 'col-start-2 row-start-1 self-end' : ''}`}>{label}</Term>
      <Detail className={`font-serif text-display-sm font-semibold tabular-nums ${horizontal ? 'col-start-1 row-start-1 row-span-2' : 'mt-0.5'}`}>{value}</Detail>
      {note && (
        <Detail className={`text-caption leading-snug text-on-surface-variant break-words hyphens-auto ${horizontal ? 'col-start-2 row-start-2 self-start' : 'mt-0.5'}`}>
          {note}
        </Detail>
      )}
    </>
  );
  const box = `rounded-2xl bg-surface-container-low p-3 text-left ${horizontal ? 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3' : 'flex flex-col'}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${box} w-full active:bg-surface-container`}>
      {parts}
    </button>
  ) : (
    <div className={box}>{parts}</div>
  );
}

/** A figure as a quiet chip, label then value ("Learned 3"): stats that sit beside other content (Home). */
export function StatChip({ label, value, icon, onClick }: { label: string; value: string | number; icon?: IconName; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 px-3 rounded-full bg-surface-container-low text-body text-on-surface inline-flex items-center gap-1.5 active:bg-surface-container"
    >
      {icon && <Icon name={icon} className="text-icon-sm text-primary-container" />}
      <span className="font-medium">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </button>
  );
}
