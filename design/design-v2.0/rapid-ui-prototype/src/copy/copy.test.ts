import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatInterval } from '../state/clock';
import { copyFor } from './index';

describe('plurals', () => {
  it('Russian takes one, few and many forms, by the last digits', () => {
    const c = copyFor('ru');
    assert.deepEqual([1, 2, 5, 11, 21, 22, 25].map(c.common.phrases), ['1 фраза', '2 фразы', '5 фраз', '11 фраз', '21 фраза', '22 фразы', '25 фраз']);
    assert.deepEqual([1, 3, 12].map(c.common.charsLeft), ['Остался 1 символ', 'Осталось 3 символа', 'Осталось 12 символов']);
  });

  it('Bulgarian and English take one and other', () => {
    assert.deepEqual([1, 2, 21].map(copyFor('bg').common.phrases), ['1 фраза', '2 фрази', '21 фрази']);
    assert.deepEqual([1, 2].map(copyFor('en').common.charsLeft), ['1 character left', '2 characters left']);
  });

  it('counts inside sentences agree with their number', () => {
    assert.equal(copyFor('bg').home.today(1, 1), 'Днес: 1 чута фраза · 1 оценена');
    assert.equal(copyFor('bg').home.today(3, 2), 'Днес: 3 чути фрази · 2 оценени');
    assert.match(copyFor('ru').library.empty.learned(21, 3), /21 день и больше/);
    assert.match(copyFor('ru').library.empty.learned(25, 3), /25 дней и больше/);
  });

  it('Bulgarian rating previews spell out days', () => {
    assert.equal(formatInterval(5 * 86_400_000, 'bg-BG'), '5 дни');
    assert.equal(formatInterval(86_400_000, 'bg-BG'), '1 ден');
  });

  it('every UI language has the same keys', () => {
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
    const en = keys(copyFor('en')).sort();
    for (const locale of ['bg', 'ru'] as const) assert.deepEqual(keys(copyFor(locale)).sort(), en, locale);
  });
});
