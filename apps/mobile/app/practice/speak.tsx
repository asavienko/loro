/** P3-20/P3-25 · Loro.dc.html:680–732. Native-only ASR; reveal remains completable offline. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { isActive, SpeakEngine, type SessionHandle, type TargetLocale } from '@loro/core'
import { copy } from '../../src/lib/copy'
import { useLocale } from '../../src/lib/i18n'
import { coreAvailable } from '../../src/lib/core'
import { audioSpeech, useAudioSpeech } from '../../src/lib/audioSpeech'
import { deviceClock } from '../../src/lib/clock'
import { newId } from '../../src/lib/ids'
import { engineContext, toView, useApp, type PhraseView } from '../../src/store'
import { EmptyState } from '../../src/ui/components'
import { AudioControls } from '../../src/ui/components/AudioControls'
import { Button, Card, Row, Screen, Stack, Text } from '../../src/ui/primitives'
import { ink, space } from '../../src/ui/theme'

const speakEngine = new SpeakEngine()

export default function Speak() {
  useLocale()
  const phrases = useApp((state) => state.phrases)
  const locale = useApp((state) => state.targetLocale)
  const [cursor, setCursor] = useState(0)
  const queue = phrases.filter(isActive)
  const phrase = queue[cursor % Math.max(1, queue.length)]
  return (
    <Screen>
      {phrase === undefined ? (
        <EmptyState
          title={copy.stream.empty.title}
          body={copy.stream.empty.body}
          action={{
            label: copy.stream.empty.action,
            onPress: () => {
              router.push('/add')
            },
          }}
        />
      ) : (
        <SpeakingPhrase
          key={`${locale}:${phrase.id}:${cursor}`}
          phrase={toView(phrase)}
          locale={locale}
          onNext={() => {
            setCursor((value) => value + 1)
          }}
        />
      )}
    </Screen>
  )
}

function SpeakingPhrase({
  phrase,
  locale,
  onNext,
}: {
  phrase: PhraseView
  locale: TargetLocale
  onNext: () => void
}) {
  useLocale()
  const audio = useAudioSpeech(locale)
  const applyDelta = useApp((state) => state.applyDelta)
  const tokens = useMemo(
    () => phrase.targetText.trim().split(/\s+/).filter(Boolean),
    [phrase.targetText],
  )
  const [revealed, setRevealed] = useState(0)
  const [hints, setHints] = useState(0)
  const [heard, setHeard] = useState('')
  const [done, setDone] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [recognitionFailed, setRecognitionFailed] = useState(false)
  const [attemptId] = useState(newId)
  const completeRef = useRef(false)
  const hintsRef = useRef(0)
  const revealedRef = useRef(0)
  // Partial ASR results replace the current transcript; replaying one must not unlock
  // repeated target words twice. Anchor all partial results to the start of this attempt.
  const attemptBaseReveal = useRef(0)
  const canRecognize = audio.canRecognize && coreAvailable() && !recognitionFailed
  const listening = audio.speech?.state === 'listening' || audio.speech?.state === 'partial'

  useEffect(() => {
    void audioSpeech.stopPlayback()
    return () => {
      void audioSpeech.stopListening()
      void audioSpeech.stopPlayback()
    }
  }, [])
  useEffect(() => {
    const event = audio.speech
    if (event === null || completeRef.current) return
    if (event.state === 'unavailable' || event.state === 'error') {
      setRecognitionFailed(true)
      return
    }
    if (event.transcript.length === 0) return
    setHeard(event.transcript)
    try {
      const origin = useApp.getState()
      const expectedPhrase = (
        origin.targetLocale === locale ? origin.phrases : origin.courses[locale]?.phrases
      )?.find((item) => item.id === phrase.id)
      if (!expectedPhrase) return
      const context = engineContext()
      const matched = context.core.matchTokens(
        event.transcript.split(/\s+/),
        tokens,
        attemptBaseReveal.current,
      )
      revealedRef.current = Math.max(revealedRef.current, matched.revealed)
      setRevealed(revealedRef.current)
      if (!matched.complete) return
      completeRef.current = true
      const localDay = deviceClock.localDay()
      const streakDay = deviceClock.streakDay()
      void audioSpeech.stopListening()
      const session: SessionHandle = {
        sessionId: event.id,
        cursor: 0,
        plan: {
          engineId: 'speak',
          closed: true,
          estimatedMs: 0,
          items: [
            {
              itemId: `${phrase.id}#speak`,
              phraseId: phrase.id,
              mode: 'speak',
              prompt: { show: 'meaning' },
              gate: { kind: 'asr-full' },
              audio: null,
              meta: {},
            },
          ],
        },
      }
      void speakEngine
        .record(
          session,
          {
            itemId: `${phrase.id}#speak`,
            outcome: 'success',
            hintsUsed: hintsRef.current,
            latencyMs: event.latencyMs,
            transcript: event.transcript,
            at: deviceClock.now(),
          },
          context,
        )
        .then((delta) => {
          applyDelta(delta, {
            attemptId,
            targetLocale: locale,
            localDay,
            streakDay,
            expectedPhrase,
          })
          setDone(true)
        })
        .catch(() => {
          completeRef.current = false
          setSaveError(true)
        })
    } catch {
      setRecognitionFailed(true)
    }
  }, [audio.speech, applyDelta, phrase.id, tokens, locale, attemptId])

  const revealWord = (): void => {
    if (completeRef.current) return
    void audioSpeech.stopListening()
    hintsRef.current += 1
    setHints(hintsRef.current)
    const next = Math.min(revealedRef.current + 1, tokens.length)
    revealedRef.current = next
    setRevealed(next)
    const word = tokens[next - 1]
    if (word !== undefined && audio.canPlay) void audioSpeech.play(phrase.id, word, locale, 0.85)
    if (next === tokens.length) {
      completeRef.current = true
      setDone(true)
    }
  }
  const status = done
    ? hints > 0
      ? copy.audioSpeech.revealedDone
      : copy.audioSpeech.spokenDone
    : !canRecognize
      ? copy.audioSpeech.revealMode
      : listening
        ? copy.audioSpeech.listening
        : audio.speech?.state === 'final' && heard.length === 0
          ? copy.audioSpeech.heardNothing
          : heard.length > 0
            ? copy.audioSpeech.retry
            : copy.audioSpeech.speakIntro

  return (
    <ScrollView
      contentContainerStyle={{ padding: space['4'], gap: space['4'], paddingBottom: space['6'] }}
    >
      <Text variant="caption" color={ink.muted}>
        {copy.audioSpeech.speakIntro}
      </Text>
      <Card>
        <Stack gap={space['4']}>
          <Text variant="title2" align="center">
            {phrase.translation}
          </Text>
          <Row wrap justify="center" gap={space['2']}>
            {tokens.map((token, index) => (
              <Text
                key={index}
                variant="title3"
                lang={index < revealed ? 'target' : undefined}
                color={index < revealed ? ink.ink : ink.muted}
              >
                {index < revealed ? token : copy.audioSpeech.hiddenWord}
              </Text>
            ))}
          </Row>
          <Text variant="caption" align="center">
            {copy.audioSpeech.wordProgress(revealed, tokens.length)}
          </Text>
          <View accessibilityLiveRegion="polite">
            <Text variant="body" align="center">
              {status}
            </Text>
          </View>
          {heard.length > 0 && (
            <Text variant="caption" lang="target" align="center">
              {heard}
            </Text>
          )}
          {saveError && (
            <View accessibilityRole="alert">
              <Text>{copy.audioSpeech.saveError}</Text>
            </View>
          )}
          <Button
            disabled={done}
            label={
              !canRecognize
                ? copy.audioSpeech.reveal
                : listening
                  ? copy.audioSpeech.stopListening
                  : copy.audioSpeech.listen
            }
            onPress={() => {
              setSaveError(false)
              if (!canRecognize) revealWord()
              else if (listening) void audioSpeech.stopListening()
              else {
                attemptBaseReveal.current = revealedRef.current
                void audioSpeech.listen(locale)
              }
            }}
          />
          {canRecognize && !done && (
            <Button label={copy.audioSpeech.reveal} variant="secondary" onPress={revealWord} />
          )}
        </Stack>
      </Card>
      <AudioControls
        label={audio.playback === 'playing' ? copy.audioSpeech.stop : copy.audioSpeech.hear}
        note={
          audio.canPlay
            ? audio.playback === 'error'
              ? copy.audioSpeech.error
              : copy.audioSpeech.tts
            : copy.audioSpeech.unavailable
        }
        enabled={audio.canPlay}
        onPress={() => {
          if (audio.playback === 'playing') void audioSpeech.stopPlayback()
          else {
            if (!done) {
              hintsRef.current += 1
              setHints(hintsRef.current)
            }
            void audioSpeech.play(phrase.id, phrase.targetText, locale)
          }
        }}
      />
      <Text variant="captionSm" color={ink.muted}>
        {copy.audioSpeech.privacy}
      </Text>
      <Button label={copy.audioSpeech.next} disabled={!done} onPress={onNext} />
      {!done && <Button label={copy.audioSpeech.skip} variant="secondary" onPress={onNext} />}
    </ScrollView>
  )
}
