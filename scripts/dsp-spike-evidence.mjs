#!/usr/bin/env node
/**
 * Evaluates the pre-registered M1 DSP study from derived, de-identified results.
 *
 * This is deliberately not a scorer and it never opens audio files. The actual DSP
 * pipeline, capture path, and device measurements remain behind plan 77's evidence
 * gate. A completed study supplies only its derived score, worst-syllable candidate,
 * and two independent native-speaker annotations to this evaluator.
 */
import fs from 'node:fs'
import path from 'node:path'

export const M1 = Object.freeze({
  phrases: 20,
  speakers: 5,
  nativeSpeakers: 2,
  learnerSpeakers: 3,
  devices: Object.freeze(['android-mid-range', 'iphone']),
  reviewersPerTake: 2,
  spearmanMinimum: 0.6,
  worstSyllableMinimum: 0.7,
})

const FORBIDDEN_KEYS = new Set([
  'audio',
  'audiopath',
  'buffer',
  'bufferid',
  'email',
  'name',
  'pcm',
  'recording',
  'recordingpath',
  'transcript',
  'waveform',
])

function fail(message) {
  throw new Error(`DSP spike evidence is invalid: ${message}`)
}

function assertObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`)
  }
}

function assertFinite(value, label) {
  if (!Number.isFinite(value)) fail(`${label} must be a finite number`)
}

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)) {
    fail(`${label} must be a short pseudonymous identifier`)
  }
}

function rejectSensitiveKeys(value, trail = 'study') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectSensitiveKeys(entry, `${trail}[${index}]`))
    return
  }
  if (value === null || typeof value !== 'object') return
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      fail(
        `${trail}.${key} is forbidden; the evaluator accepts no raw audio, handles, transcripts, or identity`,
      )
    }
    rejectSensitiveKeys(entry, `${trail}.${key}`)
  }
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function ranks(values) {
  const ordered = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
  const out = Array.from({ length: values.length })
  let start = 0
  while (start < ordered.length) {
    let end = start + 1
    while (end < ordered.length && ordered[end].value === ordered[start].value) end += 1
    const rank = (start + 1 + end) / 2
    for (let index = start; index < end; index += 1) out[ordered[index].index] = rank
    start = end
  }
  return out
}

export function pearson(left, right) {
  if (left.length !== right.length || left.length < 2) return 0
  const leftMean = mean(left)
  const rightMean = mean(right)
  let numerator = 0
  let leftSpread = 0
  let rightSpread = 0
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean
    const rightDelta = right[index] - rightMean
    numerator += leftDelta * rightDelta
    leftSpread += leftDelta * leftDelta
    rightSpread += rightDelta * rightDelta
  }
  if (leftSpread === 0 || rightSpread === 0) return 0
  return numerator / Math.sqrt(leftSpread * rightSpread)
}

export function spearman(left, right) {
  return pearson(ranks(left), ranks(right))
}

/** A deterministic PRNG makes confidence intervals reproducible without touching study values. */
function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 2 ** 32
  }
}

function quantile(sorted, fraction) {
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

export function bootstrapInterval(values, statistic, { iterations = 2_000, seed = 77 } = {}) {
  if (values.length < 2) return null
  const random = seededRandom(seed)
  const samples = []
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sample = Array.from(
      { length: values.length },
      () => values[Math.floor(random() * values.length)],
    )
    samples.push(statistic(sample))
  }
  samples.sort((a, b) => a - b)
  return { lower: quantile(samples, 0.025), upper: quantile(samples, 0.975) }
}

function validateTake(take, index, reviewers) {
  assertObject(take, `takes[${index}]`)
  for (const key of ['id', 'phraseId', 'speakerId', 'device'])
    assertIdentifier(take[key], `takes[${index}].${key}`)
  if (!['native', 'learner'].includes(take.speakerKind))
    fail(`takes[${index}].speakerKind must be native or learner`)
  if (!M1.devices.includes(take.device)) fail(`takes[${index}].device is not an M1 floor device`)
  assertIdentifier(take.noiseClass, `takes[${index}].noiseClass`)
  assertObject(take.derived, `takes[${index}].derived`)
  assertFinite(take.derived.score, `takes[${index}].derived.score`)
  if (take.derived.score < 0 || take.derived.score > 99)
    fail(`takes[${index}].derived.score must be 0..99`)
  if (!Number.isInteger(take.derived.worstSyllable) || take.derived.worstSyllable < 0) {
    fail(`takes[${index}].derived.worstSyllable must be a non-negative index`)
  }
  if (!Array.isArray(take.annotations) || take.annotations.length !== M1.reviewersPerTake) {
    fail(`takes[${index}] must contain exactly two independent annotations`)
  }
  const annotationReviewers = new Set()
  const ratings = []
  const worstSyllables = []
  for (const [annotationIndex, annotation] of take.annotations.entries()) {
    assertObject(annotation, `takes[${index}].annotations[${annotationIndex}]`)
    assertIdentifier(
      annotation.reviewerId,
      `takes[${index}].annotations[${annotationIndex}].reviewerId`,
    )
    if (!reviewers.has(annotation.reviewerId)) fail(`takes[${index}] has an unregistered reviewer`)
    annotationReviewers.add(annotation.reviewerId)
    assertFinite(annotation.rating, `takes[${index}].annotations[${annotationIndex}].rating`)
    if (annotation.rating < 1 || annotation.rating > 5)
      fail(`takes[${index}].annotations[${annotationIndex}].rating must be 1..5`)
    if (!Number.isInteger(annotation.worstSyllable) || annotation.worstSyllable < 0) {
      fail(
        `takes[${index}].annotations[${annotationIndex}].worstSyllable must be a non-negative index`,
      )
    }
    ratings.push(annotation.rating)
    worstSyllables.push(annotation.worstSyllable)
  }
  if (annotationReviewers.size !== M1.reviewersPerTake)
    fail(`takes[${index}] annotations must come from two different reviewers`)
  if (worstSyllables[0] !== worstSyllables[1])
    fail(`takes[${index}] has no independent-reviewer worst-syllable consensus`)
  return { humanRating: mean(ratings), worstSyllable: worstSyllables[0] }
}

export function evaluate(study) {
  assertObject(study, 'study')
  rejectSensitiveKeys(study)
  if (study.version !== 1) fail('version must be 1')
  if (study.language !== 'es-ES')
    fail('M1 is Spanish-only; this evaluator cannot enable another language')
  assertIdentifier(study.decisionOwner, 'decisionOwner')
  if (!Array.isArray(study.reviewers) || study.reviewers.length !== M1.reviewersPerTake) {
    fail('study must register exactly two independent reviewers')
  }
  const reviewers = new Set(study.reviewers)
  if (reviewers.size !== M1.reviewersPerTake) fail('reviewer identifiers must be distinct')
  for (const reviewer of reviewers) assertIdentifier(reviewer, 'reviewer')
  if (!Array.isArray(study.takes)) fail('takes must be an array')

  const phrases = new Set()
  const speakers = new Map()
  const combinations = new Set()
  const evaluated = study.takes.map((take, index) => {
    const annotation = validateTake(take, index, reviewers)
    phrases.add(take.phraseId)
    const priorKind = speakers.get(take.speakerId)
    if (priorKind !== undefined && priorKind !== take.speakerKind)
      fail(`speaker ${take.speakerId} has inconsistent kind`)
    speakers.set(take.speakerId, take.speakerKind)
    const key = `${take.phraseId}/${take.speakerId}/${take.device}`
    if (combinations.has(key)) fail(`duplicate phrase/speaker/device take ${key}`)
    combinations.add(key)
    return { take, annotation }
  })
  if (phrases.size !== M1.phrases) fail(`M1 requires ${M1.phrases} phrases; got ${phrases.size}`)
  if (speakers.size !== M1.speakers)
    fail(`M1 requires ${M1.speakers} speakers; got ${speakers.size}`)
  if ([...speakers.values()].filter((kind) => kind === 'native').length !== M1.nativeSpeakers)
    fail(`M1 requires ${M1.nativeSpeakers} native speakers`)
  if ([...speakers.values()].filter((kind) => kind === 'learner').length !== M1.learnerSpeakers)
    fail(`M1 requires ${M1.learnerSpeakers} learner speakers`)
  const expectedTakes = M1.phrases * M1.speakers * M1.devices.length
  if (evaluated.length !== expectedTakes)
    fail(`M1 requires ${expectedTakes} phrase/speaker/device takes; got ${evaluated.length}`)

  const scores = evaluated.map(({ take }) => take.derived.score)
  const humanRatings = evaluated.map(({ annotation }) => annotation.humanRating)
  const agreements = evaluated.map(({ take, annotation }) =>
    Number(take.derived.worstSyllable === annotation.worstSyllable),
  )
  const correlation = spearman(scores, humanRatings)
  const worstSyllableAgreement = mean(agreements)
  const correlationInterval = bootstrapInterval(evaluated, (sample) =>
    spearman(
      sample.map(({ take }) => take.derived.score),
      sample.map(({ annotation }) => annotation.humanRating),
    ),
  )
  const agreementInterval = bootstrapInterval(agreements, mean)
  const pass =
    correlation >= M1.spearmanMinimum && worstSyllableAgreement >= M1.worstSyllableMinimum

  const clusters = Object.fromEntries(
    ['device', 'noiseClass', 'speakerKind']
      .map((key) => [key, Object.groupBy(evaluated, ({ take }) => take[key])])
      .map(([key, groups]) => [
        key,
        Object.fromEntries(
          Object.entries(groups).map(([group, entries]) => [
            group,
            {
              count: entries.length,
              spearman: spearman(
                entries.map(({ take }) => take.derived.score),
                entries.map(({ annotation }) => annotation.humanRating),
              ),
              worstSyllableAgreement: mean(
                entries.map(({ take, annotation }) =>
                  Number(take.derived.worstSyllable === annotation.worstSyllable),
                ),
              ),
            },
          ]),
        ),
      ]),
  )

  return {
    study: { language: study.language, decisionOwner: study.decisionOwner },
    sample: {
      takes: evaluated.length,
      phrases: phrases.size,
      speakers: speakers.size,
      devices: [...M1.devices],
    },
    metrics: {
      spearman: correlation,
      spearman95Ci: correlationInterval,
      worstSyllableAgreement,
      worstSyllableAgreement95Ci: agreementInterval,
    },
    thresholds: {
      spearmanMinimum: M1.spearmanMinimum,
      worstSyllableMinimum: M1.worstSyllableMinimum,
    },
    clusters,
    decision: pass ? 'pass' : 'fail',
    note: 'This report evaluates derived study results only. It is not calibration, device-quality, or production-release evidence.',
  }
}

function main() {
  const [input] = process.argv.slice(2)
  if (!input)
    throw new Error('Usage: node scripts/dsp-spike-evidence.mjs path/to/derived-study.json')
  const study = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'))
  const report = evaluate(study)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  process.exitCode = report.decision === 'pass' ? 0 : 2
}

if (import.meta.url === `file://${process.argv[1]}`) main()
