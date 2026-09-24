import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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

  it('every UI language has the same keys', () => {
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
    const en = keys(copyFor('en')).sort();
    for (const locale of ['bg', 'ru'] as const) assert.deepEqual(keys(copyFor(locale)).sort(), en, locale);
  });
});
