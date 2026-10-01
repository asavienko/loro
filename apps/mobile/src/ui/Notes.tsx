// A phrase's notes as tabs (the web prototype's src/ui/Notes.tsx): the mnemonic (a hook for
// remembering the phrase), the grammar rule and its sounds, in the learner's language where there is
// a version in it.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Phrase, PhraseNotes } from '@shared/content';
import { useCopy, useStore } from '../state/store';
import { Icon, IconName } from './Icon';
import { Press } from './Press';
import { Txt } from './Txt';
import { colors, radius, shadow, TARGET } from './theme';
import { useRoom } from './useRoom';

type NoteTab = keyof PhraseNotes;
const NOTE_TABS: { id: NoteTab; icon: IconName }[] = [
  { id: 'mnemonic', icon: 'lightbulb' },
  { id: 'grammar', icon: 'menu_book' },
  { id: 'pronunciation', icon: 'record_voice_over' },
];

export function PhraseNotesView({ phrase }: { phrase: Phrase }) {
  const c = useCopy();
  const { state } = useStore();
  const native = state.learner.profile.nativeLang;
  const notes = phrase.notes;
  const [tab, setTab] = useState<NoteTab>('mnemonic');
  // On a compact screen only the open tab is named; the others are their icons.
  const { compact } = useRoom();
  const translated = native.startsWith('en-') ? undefined : phrase.noteTranslations[tab]?.[native];
  const note = notes[tab];
  const { title, text } = translated ?? note;
  return (
    <View style={styles.view}>
      <View accessibilityRole="tablist" accessibilityLabel={c.phrase.notesTitle} style={styles.tabs}>
        {NOTE_TABS.map((t) => {
          const on = t.id === tab;
          return (
            <Press
              key={t.id}
              accessibilityRole="tab"
              accessibilityLabel={c.phrase.notes[t.id]}
              accessibilityState={{ selected: on }}
              onPress={() => setTab(t.id)}
              style={[styles.tab, compact && on && styles.tabWide, on && styles.tabOn]}
            >
              <Icon name={t.icon} size="sm" color={on ? 'onSurface' : 'secondary'} />
              {(on || !compact) && (
                <Txt variant="label" weight={on ? 700 : 500} color={on ? 'onSurface' : 'secondary'} numberOfLines={1} style={styles.label}>
                  {c.phrase.notes[t.id]}
                </Txt>
              )}
            </Press>
          );
        })}
      </View>
      <View style={styles.panel} {...({ role: 'tabpanel' } as object)}>
        <Txt weight={700} accessibilityRole="header" lang={translated ? native : 'en'}>
          {title}
        </Txt>
        {tab === 'pronunciation' && (
          <>
            <Txt color="primaryContainer" style={styles.mono}>
              {notes.pronunciation.ipa}
            </Txt>
            {/* The respelling uses English spelling, so it helps most in the English UI. */}
            {!translated && (
              <Txt variant="label" color="secondary" style={styles.mono}>
                {notes.pronunciation.respelling}
              </Txt>
            )}
          </>
        )}
        <Txt color="onSurfaceVariant" style={styles.text} lang={translated ? native : 'en'}>
          {text}
        </Txt>
      </View>
      {!c.locale.startsWith('en') && !translated && (
        <Txt variant="label" color="secondary">
          {c.phrase.notesInEnglish}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  view: { gap: 12 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius['2xl'], backgroundColor: colors.surfaceContainerLow },
  tab: { flex: 1, minHeight: TARGET, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 },
  tabWide: { flex: 3 },
  tabOn: { backgroundColor: colors.surfaceContainerLowest, ...shadow.card },
  label: { flexShrink: 1 },
  panel: { gap: 6, paddingHorizontal: 4 },
  mono: { fontFamily: 'monospace' },
  text: { lineHeight: 22 },
});
