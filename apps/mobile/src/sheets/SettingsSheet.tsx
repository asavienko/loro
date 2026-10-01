// Settings (the web prototype's src/sheets/SettingsSheet.tsx), opened from the avatar: the account,
// course and profile, listening, one screen-reader preference and privacy. Phrases are spoken by the
// server's voices (plan 108), so there are no device voices to choose here.
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Switch, TextInput, View } from 'react-native'
import { copyForNative, languageLabel, languageName } from '@shared/copy'
import { refreshCourse } from '@shared/api/contentCache'
import { coursesFor, getLanguage, installedPack, LanguageCode, NATIVE_LANGUAGES } from '@shared/content'
import { useLatest } from '@shared/lib/useLatest'
import { useNav } from '@shared/nav/NavContext'
import { LIMITS, tidy } from '@shared/state/limits'
import { analyticsAvailable, setSharingUsage, sharingUsage } from '../analytics/posthog'
import { signedInLabel } from '../screens/AccountScreen'
import { useAccount } from '../state/account'
import { useCopy, useStore } from '../state/store'
import { Sheet, SheetOption, SheetSection } from '../ui/Sheet'
import { useToast } from '../ui/Toast'
import { Txt } from '../ui/Txt'
import { colors, radius, type } from '../ui/theme'

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCopy()
  const { state, actions } = useStore()
  const { profile } = state.learner
  const { toast } = useToast()
  const nav = useNav()
  const account = useAccount()

  const latest = useLatest(state)
  const [downloading, setDownloading] = useState<LanguageCode | null>(null)
  // A new course empties the queue (it belongs to the old one); say so, in the new UI language. A
  // course not on the device yet is downloaded first: one the server can't send now would leave the
  // learner waiting for it with no way back to the course they have.
  const switchTo = async (nativeLang: LanguageCode, targetLang: LanguageCode) => {
    if (nativeLang === profile.nativeLang && targetLang === profile.targetLang) return
    if (!installedPack(targetLang)) {
      if (downloading) return
      setDownloading(targetLang)
      try {
        await refreshCourse(targetLang)
      } catch {
        toast(c.settings.courseUnavailable(languageName(targetLang, c.locale)))
        return
      } finally {
        setDownloading(null)
      }
    }
    const queueCleared = latest.current.player.order.length > 0
    actions.setProfile({ nativeLang, targetLang })
    const next = copyForNative(nativeLang)
    toast(next.settings.switched(languageName(targetLang, next.locale), queueCleared))
  }

  return (
    <Sheet open={open} title={c.settings.title} onClose={onClose}>
      {/* The account (plan 106): who is signed in, or the way in. */}
      <SheetSection title={c.account.title}>
        <SheetOption
          icon="account_circle"
          label={account.status === 'signedIn' ? signedInLabel(c, account.account) : c.account.signIn}
          detail={account.status === 'signedIn' ? undefined : c.account.needed}
          onPress={nav.openAccount}
        />
      </SheetSection>
      <SheetSection title={c.settings.profile}>
        {/* The setting people come here for comes first. */}
        <LanguageChoice
          label={c.settings.course}
          value={profile.targetLang}
          options={coursesFor(profile.nativeLang)}
          name={(code) => languageLabel(code, c.locale)}
          onChange={(code) => void switchTo(profile.nativeLang, code)}
          downloading={downloading}
          downloadingText={c.connection.loading}
        />
        {open && <NameField initial={profile.name} label={c.settings.name} onSave={(name) => actions.setProfile({ name })} />}
        <LanguageChoice
          label={c.settings.native}
          value={profile.nativeLang}
          options={NATIVE_LANGUAGES}
          // Each language in its own name, so the learner can find theirs.
          name={(code) => languageLabel(code, code)}
          onChange={(code) => {
            const course = coursesFor(code).includes(profile.targetLang) ? profile.targetLang : coursesFor(code)[0]
            void switchTo(code, course)
          }}
        />
        <Txt variant="label" color="secondary" style={styles.inset}>
          {c.settings.courseNote}
        </Txt>
      </SheetSection>


      {/* How long "your turn" lasts; every duration shown uses it, so they stay real. */}
      <SheetSection title={c.settings.listening}>
        <View accessibilityRole="radiogroup" accessibilityLabel={c.settings.pauseLength}>
          <Txt variant="label" color="secondary" style={styles.inset}>
            {c.settings.pauseLength}
          </Txt>
          {(['standard', 'longer'] as const).map((length) => (
            <SheetOption key={length} icon="timer" label={c.settings.pause[length]} selected={state.prefs.pauseLength === length} onPress={() => actions.setPrefs({ pauseLength: length })} />
          ))}
          <Txt variant="label" color="secondary" style={styles.inset}>
            {c.settings.pauseHint}
          </Txt>
        </View>
      </SheetSection>

      <SheetSection title={c.settings.accessibility}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Txt variant="row" weight={500}>
              {c.settings.announceEveryStep}
            </Txt>
            <Txt variant="label" color="secondary">
              {c.settings.announceHint}
            </Txt>
          </View>
          <Switch
            accessibilityLabel={c.settings.announceEveryStep}
            accessibilityHint={c.settings.announceHint}
            value={state.prefs.announceEveryStep}
            onValueChange={(on) => actions.setPrefs({ announceEveryStep: on })}
            trackColor={{ true: colors.primaryContainer, false: colors.surfaceContainerHighest }}
            thumbColor={colors.surfaceContainerLowest}
          />
        </View>
      </SheetSection>

      {analyticsAvailable() && <UsageSharing />}
    </Sheet>
  )
}

/** Product analytics and screen recording (ADR-0011): on until the learner turns it off here. */
function UsageSharing() {
  const c = useCopy()
  const [on, setOn] = useState(sharingUsage)
  return (
    <SheetSection title={c.settings.privacy}>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Txt variant="row" weight={500}>
            {c.settings.shareUsage}
          </Txt>
          <Txt variant="label" color="secondary">
            {c.settings.shareUsageHint}
          </Txt>
        </View>
        <Switch
          accessibilityLabel={c.settings.shareUsage}
          accessibilityHint={c.settings.shareUsageHint}
          value={on}
          onValueChange={(next) => {
            setOn(next)
            void setSharingUsage(next)
          }}
          trackColor={{ true: colors.primaryContainer, false: colors.surfaceContainerHighest }}
          thumbColor={colors.surfaceContainerLowest}
        />
      </View>
    </SheetSection>
  )
}

/** One language of several, as radio rows; the chosen one is checked. */
function LanguageChoice({
  label,
  value,
  options,
  name,
  onChange,
  downloading = null,
  downloadingText,
}: {
  label: string
  value: LanguageCode
  options: LanguageCode[]
  name: (code: LanguageCode) => string
  onChange: (code: LanguageCode) => void
  /** A course on its way: shown as such, and no other choice is taken meanwhile. */
  downloading?: LanguageCode | null
  downloadingText?: string
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      <Txt variant="label" color="secondary" style={styles.inset}>
        {label}
      </Txt>
      {options.map((code) => (
        <SheetOption
          key={code}
          icon="language"
          label={`${getLanguage(code).flag}  ${name(code)}`}
          selected={value === code}
          onPress={() => onChange(code)}
          disabled={downloading !== null}
          detail={downloading === code ? downloadingText : undefined}
        />
      ))}
    </View>
  )
}

/** Saved when editing ends (blur, Done) and when the sheet closes with it still being edited. */
function NameField({ initial, label, onSave }: { initial: string; label: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial)
  const latest = useLatest({ name, initial, onSave })
  const savedAs = useRef<string | null>(null)
  const store = () => {
    const { name: typed, initial: stored, onSave: save } = latest.current
    if (tidy(typed) === stored || tidy(typed) === savedAs.current) return false
    savedAs.current = tidy(typed)
    save(typed)
    return true
  }
  const onEnd = () => {
    // Only spacing changed: show it as stored.
    if (!store() && name !== initial && tidy(name) === initial) setName(initial)
  }
  // The sheet closing unmounts the field: what was typed is kept.
  useEffect(() => () => void store(), []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={[styles.group, styles.inset]}>
      <Txt variant="label" color="secondary" nativeID="settings-name">
        {label}
      </Txt>
      <TextInput
        value={name}
        onChangeText={setName}
        onEndEditing={onEnd}
        onBlur={onEnd}
        accessibilityLabel={label}
        accessibilityLabelledBy="settings-name"
        maxLength={LIMITS.name}
        autoComplete="given-name"
        returnKeyType="done"
        style={styles.field}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  inset: { paddingHorizontal: 8 },
  group: { gap: 4, paddingVertical: 4 },
  field: {
    ...type.field,
    fontFamily: 'sans-400',
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    color: colors.onSurface,
  },
  switchRow: { minHeight: 48, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchText: { flex: 1, minWidth: 0 },
})
