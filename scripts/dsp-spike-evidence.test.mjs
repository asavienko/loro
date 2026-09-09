import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluate, spearman } from './dsp-spike-evidence.mjs'

function validStudy() {
  const reviewers = ['reviewer-a', 'reviewer-b']
  const takes = []
  for (let phrase = 0; phrase < 20; phrase += 1) {
    for (let speaker = 0; speaker < 5; speaker += 1) {
      for (const device of ['android-mid-range', 'iphone']) {
        const score = 45 + ((phrase * 3 + speaker * 5 + (device === 'iphone' ? 2 : 0)) % 50)
        const worstSyllable = (phrase + speaker) % 4
        takes.push({
          id: `take-${phrase}-${speaker}-${device}`,
          phraseId: `phrase-${phrase}`,
          speakerId: `speaker-${speaker}`,
          speakerKind: speaker < 2 ? 'native' : 'learner',
          device,
          noiseClass: phrase % 2 === 0 ? 'quiet' : 'background',
          derived: { score, worstSyllable },
          annotations: reviewers.map((reviewerId) => ({
            reviewerId,
            rating: 1 + (score - 45) / 12.5,
            worstSyllable,
          })),
        })
      }
    }
  }
  return { version: 1, language: 'es-ES', decisionOwner: 'core-owner', reviewers, takes }
}

test('spearman uses average ranks for ties', () => {
  assert.equal(spearman([1, 1, 2], [1, 1, 2]), 1)
})

test('evaluates a complete derived M1 study without accepting audio', () => {
  const report = evaluate(validStudy())
  assert.equal(report.decision, 'pass')
  assert.equal(report.sample.takes, 200)
  assert.equal(report.metrics.spearman95Ci === null, false)
})

test('rejects raw-audio fields before it can become study evidence', () => {
  const study = validStudy()
  study.takes[0].pcm = [0.1, 0.2]
  assert.throws(() => evaluate(study), /pcm is forbidden/)
})

test('rejects a study without independent worst-syllable consensus', () => {
  const study = validStudy()
  study.takes[0].annotations[1].worstSyllable = 9
  assert.throws(() => evaluate(study), /no independent-reviewer worst-syllable consensus/)
})
