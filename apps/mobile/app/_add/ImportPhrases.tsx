import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { File as ExpoFile } from 'expo-file-system'
import {
  MAX_OWN_PHRASE_TEXT_CODE_UNITS,
  type NativeLanguage,
  type PhraseHandoffSource,
  type PhraseState,
  type TargetLocale,
} from '@loro/core'
import type { DisplayPhrase as CatalogPhrase } from '../../src/store/learningCatalog'
import { ownedTargetTexts } from './ownedPhrases'
import { targetLanguageInputProps } from './targetLanguage'
import { Button, Card, SectionHeader, Stack, Text } from '../../src/ui/primitives'
import { border, ink, line, semantic, space } from '../../src/ui/theme'
import { copy } from '../../src/lib/copy'
import { useLocale } from '../../src/lib/i18n'
import {
  importedPhraseKey,
  importInputForCandidates,
  isImportTooLarge,
  isReviewedImportTooLarge,
  IMPORT_MAX_CHARACTERS,
  IMPORT_MAX_ROWS,
  normalizeImportedText,
  parseImportedPhrases,
  reviewImportedCandidates,
  unsavedImportCandidates,
  type ImportCandidate,
} from '../../src/lib/importPhrases'
import {
  IMPORT_MAX_FILE_BYTES,
  decodeImportFile,
  type ImportFileError,
} from '../../src/lib/importFile'
import { importDraftKey, type ImportDrafts } from '../../src/lib/importDraft'
import { readBoundedImportFile } from '../../src/lib/readBoundedImportFile'

export function ImportPhrases({
  owned,
  catalog,
  addOwnPhrase,
  importDrafts,
  targetLocale,
  nativeLanguage,
  saveImportDraft,
  clearImportDraft,
}: {
  owned: readonly PhraseState[]
  catalog: readonly CatalogPhrase[]
  addOwnPhrase: (
    draft: { targetText: string; translation: string },
    o?: { source?: PhraseHandoffSource },
  ) => string
  importDrafts: ImportDrafts
  targetLocale: TargetLocale
  nativeLanguage: NativeLanguage
  saveImportDraft: (draft: {
    targetLocale: TargetLocale
    nativeLanguage: NativeLanguage
    input: string
  }) => void
  clearImportDraft: () => void
}) {
  useLocale()
  const restored = importDrafts[importDraftKey({ targetLocale, nativeLanguage })]?.input ?? ''
  const [input, setInput] = useState(restored)
  const [review, setReview] = useState<ImportCandidate[] | null>(null)
  const [tooLarge, setTooLarge] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [fileError, setFileError] = useState<ImportFileError | null>(null)
  const fileRequest = useRef(0)
  useEffect(() => {
    fileRequest.current += 1
    return () => {
      fileRequest.current += 1
    }
  }, [nativeLanguage, targetLocale])
  const existing = useMemo(() => ownedTargetTexts(owned, catalog), [owned, catalog])
  const preview = () => {
    fileRequest.current += 1
    const exceedsLimit = isImportTooLarge(input)
    setTooLarge(exceedsLimit)
    setSaveFailed(false)
    setReview(exceedsLimit ? null : parseImportedPhrases(input, existing))
  }
  const persistDraft = (value: string): boolean => {
    try {
      saveImportDraft({ targetLocale, nativeLanguage, input: value })
      return true
    } catch {
      setSaveFailed(true)
      return false
    }
  }
  const updateInput = (value: string) => {
    fileRequest.current += 1
    if (!persistDraft(value)) return
    setInput(value)
    setTooLarge(false)
    setSaveFailed(false)
    setFileError(null)
    setReview(null)
  }
  const chooseFile = async () => {
    const request = fileRequest.current + 1
    fileRequest.current = request
    setFileError(null)
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/tab-separated-values'],
        // Android document providers return content:// URIs when cache copying is disabled.
        // ExpoFile's stream() is backed by a random-access local file and rejects those URIs.
        // Cache first, then retain the bounded reader so decoding still has a hard byte limit.
        copyToCacheDirectory: true,
        multiple: false,
        base64: false,
      })
      if (request !== fileRequest.current || picked.canceled) return
      const asset = picked.assets[0]
      if (asset === undefined) return
      if (asset.size !== undefined && asset.size > IMPORT_MAX_FILE_BYTES) {
        setFileError('too-large')
        return
      }
      const stream =
        asset.file === undefined
          ? new ExpoFile(asset.uri).stream()
          : (asset.file.stream() as ReadableStream<Uint8Array>)
      const bytes = await readBoundedImportFile(stream, IMPORT_MAX_FILE_BYTES)
      if (request !== fileRequest.current) return
      if (bytes === null) {
        setFileError('too-large')
        return
      }
      const result = decodeImportFile({ name: asset.name, bytes })
      if (!result.ok) {
        setFileError(result.error)
        return
      }
      updateInput(result.text)
    } catch {
      if (request === fileRequest.current) setFileError('unsupported-encoding')
    }
  }
  const update = (index: number, field: 'targetText' | 'translation', value: string) => {
    fileRequest.current += 1
    setSaveFailed(false)
    if (review === null) return
    const updated = reviewImportedCandidates(
      review.map((candidate, candidateIndex) =>
        candidateIndex === index
          ? { ...candidate, [field]: normalizeImportedText(value) }
          : candidate,
      ),
      existing,
    )
    const persistedInput = importInputForCandidates(updated)
    if (!persistDraft(persistedInput)) return
    setReview(updated)
    setInput(persistedInput)
  }
  const accepted = (review ?? []).filter(
    (candidate) =>
      candidate.issue === null && candidate.targetText !== '' && candidate.translation !== '',
  )
  const reviewedBatchTooLarge = review !== null && isReviewedImportTooLarge(review)
  const save = () => {
    fileRequest.current += 1
    if (review === null || reviewedBatchTooLarge) return
    const checked = reviewImportedCandidates(review, existing)
    if (isReviewedImportTooLarge(checked)) {
      setReview(checked)
      return
    }
    const acceptedChecked = checked.filter((candidate) => candidate.issue === null)
    if (acceptedChecked.length === 0) {
      setReview(checked)
      return
    }
    const keys = new Set(existing.map(importedPhraseKey))
    const savedLines = new Set<number>()
    const savedTargetTexts: string[] = []
    let failed = false
    for (const candidate of acceptedChecked) {
      const key = importedPhraseKey(candidate.targetText)
      if (keys.has(key)) continue
      try {
        addOwnPhrase(
          { targetText: candidate.targetText, translation: candidate.translation },
          { source: 'import' },
        )
        keys.add(key)
        savedLines.add(candidate.line)
        savedTargetTexts.push(candidate.targetText)
      } catch {
        failed = true
        break
      }
    }
    const remaining = unsavedImportCandidates(checked, savedLines)
    if (remaining.length === 0) {
      setInput('')
      setReview(null)
      setSaveFailed(false)
      clearImportDraft()
      return
    }
    const remainingInput = importInputForCandidates(remaining)
    setInput(remainingInput)
    setReview(reviewImportedCandidates(remaining, [...existing, ...savedTargetTexts]))
    setSaveFailed(failed)
    saveImportDraft({ targetLocale, nativeLanguage, input: remainingInput })
  }
  return (
    <Stack gap={space['3']}>
      <Stack gap={space['1']}>
        <Text variant="title3" color={ink.ink}>
          {copy.add.import.title}
        </Text>
        <Text variant="caption" color={ink.muted}>
          {copy.add.import.help}
        </Text>
      </Stack>
      <Card padding={0} style={s.importInputCard}>
        <TextInput
          multiline
          value={input}
          onChangeText={updateInput}
          placeholder={copy.add.import.placeholder}
          placeholderTextColor={ink.muted2}
          accessibilityLabel={copy.a11y.add.importInput}
          style={s.importInput}
        />
      </Card>
      <Button
        label={copy.add.import.chooseFile}
        variant="secondary"
        onPress={() => {
          void chooseFile()
        }}
      />
      {fileError !== null && (
        <View accessibilityRole="alert">
          <Text variant="caption" color={semantic.warn.text}>
            {fileError === 'unsupported-format'
              ? copy.add.import.unsupportedFormat
              : fileError === 'too-large'
                ? copy.add.import.fileTooLarge
                : copy.add.import.unsupportedEncoding}
          </Text>
        </View>
      )}
      {saveFailed && (
        <View accessibilityRole="alert">
          <Text variant="caption" color={semantic.warn.text}>
            {copy.add.import.saveFailed}
          </Text>
        </View>
      )}
      <Button label={copy.add.import.preview} variant="secondary" onPress={preview} />
      {tooLarge && (
        <View accessibilityRole="alert">
          <Text variant="caption" color={semantic.warn.text}>
            {copy.add.import.tooLarge(IMPORT_MAX_ROWS, IMPORT_MAX_CHARACTERS)}
          </Text>
        </View>
      )}
      {review !== null && (
        <Stack gap={space['2']}>
          <SectionHeader
            variant="caption"
            label={copy.add.import.review(accepted.length)}
            hint={copy.add.import.reviewHint}
          />
          {reviewedBatchTooLarge && (
            <View accessibilityRole="alert">
              <Text variant="caption" color={semantic.warn.text}>
                {copy.add.import.tooLarge(IMPORT_MAX_ROWS, IMPORT_MAX_CHARACTERS)}
              </Text>
            </View>
          )}
          {review.length === 0 ? (
            <Card>
              <Text variant="caption" color={ink.muted}>
                {copy.add.import.empty}
              </Text>
            </Card>
          ) : (
            review.map((candidate, index) => (
              <Card
                key={candidate.line}
                style={candidate.issue === null ? undefined : s.importIssue}
              >
                <Stack gap={space['2']}>
                  <TextInput
                    value={candidate.targetText}
                    onChangeText={(value) => {
                      update(index, 'targetText', value)
                    }}
                    placeholder={copy.add.import.targetPlaceholder}
                    placeholderTextColor={ink.muted2}
                    accessibilityLabel={copy.a11y.add.importTarget(candidate.line)}
                    {...targetLanguageInputProps()}
                    style={s.reviewInput}
                  />
                  <TextInput
                    value={candidate.translation}
                    onChangeText={(value) => {
                      update(index, 'translation', value)
                    }}
                    placeholder={copy.add.import.meaningPlaceholder}
                    placeholderTextColor={ink.muted2}
                    accessibilityLabel={copy.a11y.add.importMeaning(candidate.line)}
                    style={s.reviewInput}
                  />
                  {candidate.issue !== null && (
                    <Text variant="captionSm" color={semantic.warn.text}>
                      {candidate.issue === 'duplicate'
                        ? copy.add.import.duplicate
                        : candidate.issue === 'too-long'
                          ? copy.add.import.tooLong(MAX_OWN_PHRASE_TEXT_CODE_UNITS)
                          : copy.add.import.invalid}
                    </Text>
                  )}
                </Stack>
              </Card>
            ))
          )}
          <Button
            label={copy.add.import.add(accepted.length)}
            onPress={save}
            disabled={accepted.length === 0 || reviewedBatchTooLarge}
          />
        </Stack>
      )}
    </Stack>
  )
}

const s = StyleSheet.create({
  importInputCard: { paddingHorizontal: 13 },
  importInput: {
    minHeight: 132,
    paddingHorizontal: space['3'],
    paddingVertical: space['3'],
    fontSize: 14,
    fontWeight: '600',
    color: ink.ink,
    textAlignVertical: 'top',
  },
  reviewInput: {
    minHeight: 44,
    paddingHorizontal: space['2'],
    color: ink.ink,
    borderBottomWidth: border.hairline,
    borderBottomColor: line.default,
  },
  importIssue: { borderColor: semantic.warn.text, borderWidth: border.hairline },
})
