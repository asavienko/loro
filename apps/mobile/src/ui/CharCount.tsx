import type { Copy } from '@shared/copy';
import { useCopy } from '../state/store';
import { Txt } from './Txt';

/** Empty until 80% of the limit; then how many characters are left. */
export function charsLeft(c: Copy, value: string, max: number): string {
  return value.length >= max * 0.8 ? c.common.charsLeft(max - value.length) : '';
}

/**
 * Near a field's limit, how many characters are left (the web prototype's src/ui/CharCount.tsx), so
 * typing that stops at the limit isn't a mystery. Hidden from screen readers: the field carries the
 * same words as its hint (`charsLeft`), as the web's aria-describedby does.
 */
export function CharCount({ value, max }: { value: string; max: number }) {
  const c = useCopy();
  const left = max - value.length;
  return (
    <Txt
      variant="label"
      weight={left === 0 ? 600 : 400}
      color={left === 0 ? 'onSurface' : 'secondary'}
      align="right"
      accessible={false}
      importantForAccessibility="no"
      accessibilityElementsHidden
      aria-hidden
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {charsLeft(c, value, max)}
    </Txt>
  );
}
