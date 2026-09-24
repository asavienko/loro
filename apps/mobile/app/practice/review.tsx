/**
 * Review — P3-30. Loro.dc.html:750–821, dressed as the v1.3 spaced-review pack.
 *
 * Grades go through ReviewEngine.record then applyDelta. The checkpoint is written
 * in the same transaction as committed_attempt and review_event. Unscheduled rows
 * never receive an invented first FSRS state. HTML scholar counts, VOL. 03 and
 * file-size chips stay omitted. Hear-it uses the same catalog/API path as Stream.
 */
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useNavigation } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ReviewEngine,
  buildReviewCheckpoint,
  reviewCandidates,
  reviewContentHash,
  reviewLimit,
  type ReviewGrade,
  type ReviewQueueEntry,
  type SessionHandle,
  type UserPhraseId,
} from '@loro/core'
import { useLocale } from '../../src/lib/i18n'
import { copy } from '../../src/lib/copy'
import { deviceClock } from '../../src/lib/clock'
import { audioSpeech, useAudioSpeech } from '../../src/lib/audioSpeech'
import { playbackSource } from '../../src/lib/catalogAudio'
import { haptics } from '../../src/lib/haptics'
import { newId } from '../../src/lib/ids'
import { DEFAULT_CADENCE_RATE } from '../../src/lib/streamCadence'
import { Screen } from '../../src/ui/primitives'
import { space } from '../../src/ui/theme'
import { engineContext, toView, useApp } from '../../src/store'
import { PracticeEmptyState } from './_emptyPractice'
import { GradeDock } from './_review/GradeDock'
import { MiniPlayer } from './_review/MiniPlayer'
import { PackHero } from './_review/PackHero'
import { ReviewCard, ReviewReceded } from './_review/ReviewCard'
import {
  DOCK_INSET,
  DOCK_MAX,
  DOCK_RESERVE,
  DOCK_REVEAL_RESERVE,
  HEADER_GUTTER,
  RECEDDED_ABOVE_DOCK,
  TRACK_PAD_Y,
} from './_review/geometry'

export default function Review() {
  useLocale()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const locale = useApp((state) => state.targetLocale)
  const phrases = useApp((state) => state.phrases)
  const dailyMinutes = useApp((state) => state.dailyMinutes)
  const resume = useApp((state) => state.reviewCheckpoint)
  const applyDelta = useApp((state) => state.applyDelta)
  const toggleLoved = useApp((state) => state.toggleLoved)
  const recordPlay = useApp((state) => state.recordPlay)
  const candidates = reviewCandidates(phrases, locale, deviceClock.now())
  const dueCap = Math.min(candidates.due.length, reviewLimit(dailyMinutes))
  const queue = useMemo((): readonly ReviewQueueEntry[] => {
    if (resume !== null) return resume.queue
    return candidates.due.slice(0, dueCap).map((phrase) => ({
      phraseId: phrase.id,
      contentHash: reviewContentHash(phrase),
    }))
  }, [resume, candidates.due, dueCap])
  const cursor = resume?.cursor ?? 0
  const lead = phrases.find((phrase) => phrase.id === queue[cursor]?.phraseId)
  const session = useMemo(() => sessionFor(locale, queue, cursor), [locale, queue, cursor])
  const [revealed, setRevealed] = useState(false)
  const leadId = lead?.id
  const [seenId, setSeenId] = useState(leadId)
  if (leadId !== seenId) {
    setSeenId(leadId)
    setRevealed(false)
  }
  const view = lead === undefined ? null : toView(lead)
  const audio = useAudioSpeech(locale, view?.catalog?.audio)
  const playing =
    view !== null &&
    audio.phraseId === view.id &&
    (audio.playback === 'playing' || audio.playback === 'loading')
  useEffect(() => {
    navigation.setOptions({
      headerLeftContainerStyle: { paddingStart: HEADER_GUTTER },
      headerRightContainerStyle: { paddingEnd: HEADER_GUTTER },
    })
  }, [navigation])

  if (candidates.state === 'empty-course') {
    return (
      <Screen>
        <PracticeEmptyState
          title={copy.review.emptyCourse.title}
          body={copy.review.emptyCourse.body}
          actionLabel={copy.review.addPhrases}
        />
      </Screen>
    )
  }
  if (candidates.state === 'no-schedule') {
    return (
      <Screen>
        <PracticeEmptyState
          title={copy.review.noSchedule.title}
          body={copy.review.noSchedule.body}
          actionLabel={copy.review.addPhrases}
        />
      </Screen>
    )
  }
  if ((candidates.state === 'nothing-due' && resume === null) || lead === undefined || view === null) {
    return (
      <Screen>
        <PracticeEmptyState
          title={copy.review.nothingDue.title}
          body={copy.review.nothingDue.body}
          actionLabel={copy.review.addPhrases}
        />
      </Screen>
    )
  }

  const remaining = queue.length - cursor
  const recededCount = remaining - 1
  const playPhrase = (phrase: NonNullable<typeof view>): void => {
    const id = phrase.id
    const active =
      audio.phraseId === id && (audio.playback === 'playing' || audio.playback === 'loading')
    if (active) {
      void audioSpeech.stopPlayback()
      return
    }
    void audioSpeech.play(
      id,
      phrase.targetText,
      locale,
      DEFAULT_CADENCE_RATE,
      () => {
        recordPlay(id)
      },
      phrase.catalog?.audio,
    )
  }
  const playLead = (): void => {
    playPhrase(view)
  }

  return (
    <Screen>
      <ScrollView
        testID="review-scroll"
        contentContainerStyle={{
          paddingBottom:
            insets.bottom +
            (revealed ? DOCK_REVEAL_RESERVE : DOCK_RESERVE) +
            (recededCount > 0 ? RECEDDED_ABOVE_DOCK : 0),
        }}
      >
        <PackHero
          phrase={view}
          dueCount={remaining}
          canPlay={audio.canPlay}
          playing={playing}
          compact={revealed}
          onPlay={playLead}
          onToggleLoved={() => {
            toggleLoved(view.id)
          }}
        />
        <View testID="review-tracklist" style={styles.tracklist}>
        <ReviewCard
          phrase={view}
          revealed={revealed}
          playing={playing}
          canPlay={audio.canPlay}
          onReveal={() => {
            setRevealed((current) => !current)
          }}
          onHear={playLead}
        />
        {queue.slice(cursor + 1).map((entry, offset) => {
          const phrase = phrases.find((item) => item.id === entry.phraseId)
          if (phrase === undefined) return null
          const receded = toView(phrase)
          return (
            <ReviewReceded
              key={entry.phraseId}
              phrase={receded}
              index={cursor + offset + 2}
              canPlay={playbackSource(receded.catalog?.audio, audio.apiReady) !== 'unavailable'}
              playing={
                audio.phraseId === receded.id &&
                (audio.playback === 'playing' || audio.playback === 'loading')
              }
              onHear={() => {
                playPhrase(receded)
              }}
            />
          )
        })}
        </View>
      </ScrollView>
      <View
        testID="review-dock"
        style={[styles.dock, { paddingBottom: insets.bottom + DOCK_INSET }]}
      >
        <GradeDock
          session={session}
          phraseId={lead.id}
          at={deviceClock.now()}
          onGrade={async (grade: ReviewGrade) => {
            const attemptId = resume?.eventId ?? newId()
            const at = deviceClock.now()
            const localDay = deviceClock.localDay()
            const delta = await new ReviewEngine(locale).record(
              session,
              {
                itemId: `${lead.id}#review`,
                outcome: 'success',
                selfGrade: grade,
                latencyMs: null,
                hintsUsed: 0,
                at,
              },
              engineContext(),
            )
            applyDelta(delta, {
              attemptId,
              targetLocale: locale,
              localDay,
              streakDay: deviceClock.streakDay(),
              expectedPhrase: lead,
              reviewCheckpoint: buildReviewCheckpoint({
                eventId: newId(),
                targetLocale: locale,
                localDay,
                cursor: cursor + 1,
                queue,
              }),
            })
            haptics.confirm()
          }}
        />
        <MiniPlayer phrase={view} canPlay={audio.canPlay} playing={playing} onPlay={playLead} />
      </View>
    </Screen>
  )
}

function sessionFor(
  locale: Parameters<typeof reviewCandidates>[1],
  queue: readonly ReviewQueueEntry[],
  cursor: number,
): SessionHandle {
  return {
    sessionId: `review:${locale}`,
    cursor,
    plan: {
      engineId: 'srs',
      estimatedMs: 0,
      closed: true,
      items: queue.map((entry) => ({
        itemId: `${entry.phraseId}#review`,
        phraseId: entry.phraseId as UserPhraseId,
        mode: 'review',
        prompt: { show: 'meaning' },
        gate: { kind: 'self-report' },
        audio: null,
        meta: {},
      })),
    },
  }
}

const styles = StyleSheet.create({
  tracklist: { paddingVertical: TRACK_PAD_Y },
  dock: {
    position: 'absolute',
    left: DOCK_INSET,
    right: DOCK_INSET,
    bottom: 0,
    maxWidth: DOCK_MAX,
    alignSelf: 'center',
    gap: space['1.5'],
    alignItems: 'center',
  },
})
