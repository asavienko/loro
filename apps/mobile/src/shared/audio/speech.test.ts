import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bestVoice, chooseVoice } from './speech';

const voice = (name: string, lang: string, localService = true, isDefault = false) => ({ name, lang, localService, default: isDefault });

describe('choosing a voice', () => {
  it("prefers the course's region, reading Android's underscore tags", () => {
    const voices = [voice('Paulina', 'es-MX'), voice('Google español', 'es_ES')];
    assert.equal(bestVoice(voices, 'es-ES')?.name, 'Google español');
  });

  it('prefers a higher-quality voice in the same region, then an offline one', () => {
    const voices = [voice('Mónica', 'es-ES'), voice('Mónica (Enhanced)', 'es-ES'), voice('Online', 'es-ES', false)];
    assert.equal(bestVoice(voices, 'es-ES')?.name, 'Mónica (Enhanced)');
    assert.equal(bestVoice([voice('Online', 'es-ES', false), voice('Local', 'es-ES')], 'es-ES')?.name, 'Local');
  });

  it('falls back to another region of the language, and to none for another language', () => {
    assert.equal(bestVoice([voice('Paulina', 'es-MX')], 'es-ES')?.name, 'Paulina');
    assert.equal(bestVoice([voice('Daniel', 'en-GB')], 'bg-BG'), null);
  });
});

describe("the learner's voice", () => {
  const voices = [voice('Local', 'es-ES'), voice('Google español', 'es-ES', false), voice('Paulina', 'es-MX')];

  it('is used while installed and speaking the language', () => {
    assert.equal(chooseVoice(voices, 'es-ES', 'Paulina', true)?.name, 'Paulina');
    assert.equal(chooseVoice(voices, 'es-ES', 'Removed voice', true)?.name, 'Local');
    assert.equal(chooseVoice([...voices, voice('Daniel', 'en-GB')], 'es-ES', 'Daniel', true)?.name, 'Local');
  });

  it('gives way offline when it needs the network, unless nothing else can speak', () => {
    assert.equal(chooseVoice(voices, 'es-ES', 'Google español', true)?.name, 'Google español');
    assert.equal(chooseVoice(voices, 'es-ES', 'Google español', false)?.name, 'Local');
    const onlyOnline = [voice('Google español', 'es-ES', false)];
    assert.equal(chooseVoice(onlyOnline, 'es-ES', undefined, false)?.name, 'Google español');
  });
});
