// A phrase's notes as tabs (the web prototype's src/ui/Notes.tsx): the mnemonic (a hook for
// remembering the phrase), the grammar rule and its sounds, in the learner's language where there is
// a version in it. The mnemonic and the grammar note can be written again on request: the newest one
// written is shown first, the earlier ones and the phrase's own below it on request, all kept on the
// device (shared/generate/noteCache.ts).
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { languageName } from '@shared/copy';
import type { LanguageCode, Phrase, PhraseNotes } from '@shared/content';
import { keepNote, keptNotes, keptNotesNow, type WrittenNote } from '@shared/generate/noteCache';
import { rewriteNote, type RewritableNote } from '@shared/generate/remote';
import { promptOf } from '@shared/state/catalog';
import { useAccount } from '../state/account';
import { useCopy, useStore } from '../state/store';
import { Button } from './Button';
import { Icon, IconName } from './Icon';
import { Press } from './Press';
import { problemText } from './problems';
import { Txt } from './Txt';
import { colors, radius, shadow, TARGET } from './theme';
import { useRoom } from './useRoom';

type NoteTab = keyof PhraseNotes;
const NOTE_TABS: { id: NoteTab; icon: IconName }[] = [
  { id: 'mnemonic', icon: 'lightbulb' },
  { id: 'grammar', icon: 'menu_book' },
  { id: 'pronunciation', icon: 'record_voice_over' },
];
const REWRITABLE: readonly RewritableNote[] = ['mnemonic', 'grammar'];
const isRewritable = (tab: NoteTab): tab is RewritableNote => (REWRITABLE as readonly string[]).includes(tab);

type Kept = Partial<Record<RewritableNote, WrittenNote[]>>;

export function PhraseNotesView({ phrase }: { phrase: Phrase }) {
  const { state } = useStore();
  const native = state.learner.profile.nativeLang;
  const [tab, setTab] = useState<NoteTab>('mnemonic');
  // What was written again, asked or failed belongs to one phrase in one language.
  return <NotesPanel key={`${phrase.id} ${native}`} phrase={phrase} native={native} tab={tab} setTab={setTab} />;
}

function NotesPanel({ phrase, native, tab, setTab }: { phrase: Phrase; native: LanguageCode; tab: NoteTab; setTab: (tab: NoteTab) => void }) {
  const c = useCopy();
  const account = useAccount();
  const notes = phrase.notes;
  // On a compact screen only the open tab is named; the others are their icons.
  const { compact } = useRoom();
  const translated = native.startsWith('en-') ? undefined : phrase.noteTranslations[tab]?.[native];
  const note = notes[tab];
  const own = translated ?? note;

  // The notes written again for this phrase, newest first: in memory at once, else read from the device.
  const [kept, setKept] = useState<Kept>(() => Object.fromEntries(REWRITABLE.map((k) => [k, keptNotesNow(phrase.id, k, native)])));
  const [writing, setWriting] = useState<RewritableNote | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [earlier, setEarlier] = useState(false);
  const asking = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    for (const kind of REWRITABLE) {
      void keptNotes(phrase.id, kind, native).then((list) => {
        if (live) setKept((k) => ({ ...k, [kind]: list }));
      });
    }
    // The phrase closing: a note still being written for it is not waited for.
    return () => {
      live = false;
      asking.current?.abort();
    };
  }, [phrase.id, native]);

  const rewritable = isRewritable(tab) ? tab : null;
  const written = rewritable ? (kept[rewritable] ?? []) : [];
  const newest = written[0];
  const { title, text } = newest ?? own;
  // A note written again is in the learner's language.
  const inNative = Boolean(newest || translated);
  const lang = newest ? native : translated ? native : 'en';
  // What came before the note shown: the earlier written ones, newest first, then the phrase's own.
  const before: { note: WrittenNote; lang: string }[] = newest
    ? [...written.slice(1).map((n) => ({ note: n, lang: native as string })), { note: { title: own.title, text: own.text }, lang: translated ? native : 'en' }]
    : [];

  const writeAnother = async (kind: RewritableNote) => {
    setProblem(null);
    if (account.status !== 'signedIn') {
      setProblem(c.account.needed);
      return;
    }
    asking.current?.abort();
    const controller = new AbortController();
    asking.current = controller;
    setWriting(kind);
    const original = translated ?? note;
    const read = [{ title: original.title, text: original.text }, ...[...(kept[kind] ?? [])].reverse()];
    try {
      const next = await rewriteNote(
        { kind, target: phrase.target, native: promptOf(phrase, native).text, targetLang: phrase.targetLang, nativeLang: native, previous: read },
        controller.signal,
      );
      const list = await keepNote(phrase.id, kind, native, next);
      if (!controller.signal.aborted) setKept((k) => ({ ...k, [kind]: list }));
      void account.refreshUsage();
    } catch (error) {
      if (!controller.signal.aborted) setProblem(problemText(c, error));
    } finally {
      if (asking.current === controller) {
        asking.current = null;
        setWriting(null);
      }
    }
  };

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
              onPress={() => {
                setTab(t.id);
                setEarlier(false);
                setProblem(null);
              }}
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
        <Txt weight={700} accessibilityRole="header" lang={lang}>
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
        <Txt color="onSurfaceVariant" style={styles.text} lang={lang}>
          {text}
        </Txt>
        {earlier &&
          before.map((b, i) => (
            <View key={i} style={styles.earlier}>
              <Txt variant="label" weight={700} lang={b.lang}>
                {b.note.title}
              </Txt>
              <Txt variant="label" color="onSurfaceVariant" style={styles.text} lang={b.lang}>
                {b.note.text}
              </Txt>
            </View>
          ))}
      </View>
      {rewritable && (
        <View style={styles.actions}>
          {writing === rewritable ? (
            <View style={styles.writing} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.primaryContainer} />
              <Txt variant="label" color="secondary">
                {c.phrase.noteWriting(languageName(native, c.locale))}
              </Txt>
            </View>
          ) : (
            <Button variant="tonal" icon="refresh" label={c.phrase.noteAgain[rewritable]} disabled={writing !== null} onPress={() => void writeAnother(rewritable)} />
          )}
          {before.length > 0 && (
            <Button variant="text" label={earlier ? c.phrase.noteHideEarlier : c.phrase.noteEarlier(before.length)} onPress={() => setEarlier((e) => !e)} />
          )}
        </View>
      )}
      {problem && (
        <Txt variant="label" color="error" accessibilityLiveRegion="polite">
          {problem}
        </Txt>
      )}
      {!c.locale.startsWith('en') && !inNative && (
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
  earlier: { gap: 2, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.hairline },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  writing: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: TARGET, paddingHorizontal: 4 },
});
