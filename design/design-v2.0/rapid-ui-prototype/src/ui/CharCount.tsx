import { useCopy } from '../state/store';

/**
 * Near a field's limit, how many characters are left, so typing that stops at the
 * limit isn't a mystery. Empty until 80% of the limit. It sits inside the field's
 * label, so it is hidden from the label's name and reaches screen readers through
 * the field's aria-describedby instead.
 */
export function CharCount({ id, value, max }: { id: string; value: string; max: number }) {
  const c = useCopy();
  const left = max - value.length;
  return (
    <span id={id} aria-hidden="true" className={`self-end text-label tabular-nums ${left === 0 ? 'text-on-surface font-semibold' : 'text-secondary'}`}>
      {value.length >= max * 0.8 ? c.common.charsLeft(left) : ''}
    </span>
  );
}
