import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hintOf } from './hint';

describe('hintOf', () => {
  it('gives the first words and keeps the question mark', () => {
    assert.equal(hintOf('¿Dónde está la estación de metro?'), '¿Dónde está …?');
    assert.equal(hintOf('Un café con leche, por favor.'), 'Un café …');
    assert.equal(hintOf('¿Tienen leche de avena?'), '¿Tienen leche …?');
  });

  it('never gives the whole phrase', () => {
    assert.equal(hintOf('Добро утро'), 'Добро …');
    assert.equal(hintOf('Gracias'), 'Gra…');
    assert.equal(hintOf('¡Hola!'), '¡Ho…!');
  });

  it('drops punctuation that ends the shown words', () => {
    assert.equal(hintOf('Sí, claro, ahora mismo voy'), 'Sí, claro …');
  });
});
