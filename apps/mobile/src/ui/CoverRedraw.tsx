// A new drawn cover from the artwork itself (LIB-04): a small button in the corner of a set's,
// album's, song's or phrase's artwork. It asks first, saying what will happen and how many covers
// are left today (LIB-02): the learner's own set or album changes in place; one of Loro's, read-only
// (LIB-01), is copied into their Library wearing the cover, and the app opens the copy; a phrase or a
// song gets a cover of the learner's own. Drawing needs an account (F-01); while it draws, the
// artwork says so. The learner may say what to picture in their own words (the field starts with
// the words they last asked for, else the item's own), and the covers they drew for it before are
// shown to put one back without drawing again, which spends nothing.
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { keepItemCover } from '@shared/api/contentCache';
import { fetchCoverHistory, generateCover, wearCover, type CoverHistory, type CoverState, type Song } from '@shared/api/library';
import { findAlbum, type Album, type LanguageCode, type Phrase, type PhraseSet } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { promptOf } from '@shared/state/catalog';
import { clip, LIMITS, tidy } from '@shared/state/limits';
import { remaining, useAccount } from '../state/account';
import { useContent } from '../state/content';
import { useCopy, useStore } from '../state/store';
import { Button } from './Button';
import { charsLeft, CharCount } from './CharCount';
import { field, placeholderColor } from './field';
import { Icon } from './Icon';
import { Press } from './Press';
import { problemText, resetTime } from './problems';
import { RemoteCover } from './RemoteCover';
import { Sheet } from './Sheet';
import { useToast } from './Toast';
import { Txt } from './Txt';
import { colors, radius, TARGET } from './theme';

/** What an artwork pictures, for a new cover of it. */
export type CoverItem =
  | { kind: 'set'; set: PhraseSet }
  | { kind: 'album'; album: Album; /** After its cover changed in place: the page shows it. */ onDrawn?: () => void }
  | { kind: 'song'; song: Song }
  | { kind: 'phrase'; phrase: Phrase };

/**
 * Whether a cover can be drawn for it: someone else's set or album is only theirs to change, and a
 * phrase written on this device has no place on the server until it is uploaded.
 */
export function canRedraw(item: CoverItem): boolean {
  if (item.kind === 'set') return item.set.owner !== 'other';
  if (item.kind === 'album') return item.album.owner !== 'other';
  if (item.kind === 'phrase') return item.phrase.setId !== null;
  return true;
}

const idOf = (item: CoverItem) => (item.kind === 'set' ? item.set.id : item.kind === 'album' ? item.album.id : item.kind === 'song' ? item.song.id : item.phrase.id);
/** What the button names: a phrase by its meaning, since the player hides its words until heard. */
const titleOf = (item: CoverItem, native: LanguageCode) =>
  item.kind === 'set' ? item.set.title : item.kind === 'album' ? item.album.title : item.kind === 'song' ? item.song.title : promptOf(item.phrase, native).text;

/** The button and what it opens, laid over an artwork of `width` × `height` with `rounded` corners. */
export function CoverRedraw({ item, width, height, rounded }: { item: CoverItem; width: number; height: number; rounded: number }) {
  const c = useCopy();
  const nav = useNav();
  const { toast } = useToast();
  const { state } = useStore();
  const account = useAccount();
  const content = useContent();
  const [asking, setAsking] = useState(false);
  const [drawing, setDrawing] = useState(false);
  /** What the learner asks the cover to picture. */
  const [words, setWords] = useState('');
  /** The covers drawn for it before; null until fetched (or when they couldn't be). */
  const [history, setHistory] = useState<CoverHistory | null>(null);
  /** The earlier cover being put back. */
  const [wearing, setWearing] = useState<string | null>(null);
  if (!canRedraw(item)) return null;

  const signedIn = account.status === 'signedIn';
  const usage = account.usage;
  const left = remaining(usage, 'cover');
  const copies = (item.kind === 'set' && item.set.owner === 'loro') || (item.kind === 'album' && item.album.owner === 'loro');
  const ask = item.kind === 'phrase' || item.kind === 'song' ? c.share.coverAsk[item.kind] : copies ? c.share.coverAsk[item.kind] : c.share.coverAsk.own;
  const side = Math.min(width, height);
  const chip = Math.round(Math.max(28, Math.min(40, side * 0.16)));
  const inset = Math.max(4, Math.round(side * 0.04));
  const slop = Math.max(0, Math.ceil((TARGET - chip) / 2));

  const id = idOf(item);
  /** The item's own words: what a cover pictures when the learner asks for nothing else. */
  const ownWords = clip(titleOf(item, state.learner.profile.nativeLang), LIMITS.coverPrompt);

  const open = () => {
    setAsking(true);
    setWords(ownWords);
    setHistory(null);
    if (!signedIn) return;
    // The allowance as it stands now, not as it was when the app opened.
    void account.refreshUsage();
    // A Loro set or album gets a copy on its first cover, so has no covers of the learner's yet.
    if (copies) return;
    fetchCoverHistory(item.kind, id).then(
      (found) => {
        setHistory(found);
        const last = found.covers[0]?.prompt;
        if (last) setWords((now) => (now === ownWords ? last : now));
      },
      // Only an offer: without it the learner can still draw.
      () => setHistory(null),
    );
  };

  /** A cover on the artwork at once: a phrase's or song's kept with the course, a set's or album's with the library. */
  const show = async (cover: CoverState) => {
    if (item.kind === 'phrase' || item.kind === 'song') {
      // Shown at once, and kept with the course for offline. One still being drawn takes its place
      // on the server when it is ready, and comes with the course's next pack.
      const course = item.kind === 'phrase' ? item.phrase.targetLang : (findAlbum(item.song.albumId)?.targetLang ?? state.learner.profile.targetLang);
      if (cover.url) await keepItemCover(course, item.kind, id, cover.url);
    } else await content.refresh();
  };

  /** One drawn before, put back: nothing is drawn and nothing spent. */
  const wear = async (coverId: string) => {
    setWearing(coverId);
    try {
      await show(await wearCover(coverId, { kind: item.kind, attachTo: id }));
      if (item.kind === 'album') item.onDrawn?.();
      setAsking(false);
      toast(c.share.coverPut, { tone: 'success' });
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setWearing(null);
    }
  };

  const draw = async () => {
    const asked = tidy(words);
    // The item's own words need not be sent: the server draws from them without any.
    const prompt = asked && asked !== tidy(ownWords) ? asked : undefined;
    setAsking(false);
    setDrawing(true);
    try {
      const drawn = await generateCover({ kind: item.kind, attachTo: id, nativeLang: state.learner.profile.nativeLang, ...(prompt ? { prompt } : {}) });
      void account.refreshUsage();
      await show(drawn);
      const ready = drawn.status !== 'rendering';
      const said = ready ? c.share.coverBy[drawn.provider] : c.share.coverLater;
      if (drawn.copy) {
        toast(`${said} · ${c.share.coverCopied}`, { tone: 'success' });
        if (drawn.copy.kind === 'set') nav.openSet(drawn.copy.id);
        else nav.openAlbum(drawn.copy.id);
      } else {
        if (item.kind === 'album') item.onDrawn?.();
        if (ready) toast(said, { tone: 'success' });
        else toast(said);
      }
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setDrawing(false);
    }
  };

  return (
    <>
      {drawing ? (
        <View style={[StyleSheet.absoluteFill, styles.drawing, { borderRadius: rounded }]} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primaryContainer} />
          {side >= 120 && (
            <Txt variant="label" weight={600} align="center">
              {c.share.coverMaking}
            </Txt>
          )}
        </View>
      ) : (
        <Press
          accessibilityRole="button"
          accessibilityLabel={c.share.coverFor(titleOf(item, state.learner.profile.nativeLang))}
          hitSlop={slop}
          onPress={open}
          style={({ pressed }) => [styles.chip, { width: chip, height: chip, right: inset, bottom: inset }, pressed && styles.pressed]}
        >
          <Icon name="auto_awesome" size={Math.round(chip * 0.56)} color="primaryContainer" />
        </Press>
      )}
      <Sheet open={asking} title={c.share.cover} onClose={() => setAsking(false)}>
        <View style={styles.body}>
          {!signedIn ? (
            <>
              <Txt>{c.account.needed}</Txt>
              <Button
                variant="primary"
                label={c.account.signIn}
                onPress={() => {
                  setAsking(false);
                  nav.openAccount();
                }}
              />
            </>
          ) : (
            <>
              <Txt>{ask}</Txt>
              {history && history.covers.length > 0 && (
                <View style={styles.earlier}>
                  <Txt variant="label" weight={600}>
                    {c.share.coverEarlier}
                  </Txt>
                  <Txt variant="label" color="secondary">
                    {c.share.coverEarlierHint}
                  </Txt>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.covers}>
                    {history.covers.map((cover) => {
                      const worn = cover.id === history.current;
                      return (
                        <Press
                          key={cover.id}
                          accessibilityRole="button"
                          accessibilityLabel={c.share.coverUse(cover.prompt)}
                          accessibilityState={{ selected: worn, disabled: worn || wearing !== null, busy: wearing === cover.id }}
                          disabled={worn || wearing !== null}
                          onPress={() => void wear(cover.id)}
                          style={({ pressed }) => [styles.choice, worn && styles.worn, pressed && styles.pressed]}
                        >
                          <RemoteCover url={cover.url} px={THUMB} rounded={radius.lg} />
                          {wearing === cover.id && (
                            <View style={[StyleSheet.absoluteFill, styles.drawing, { borderRadius: radius.lg }]}>
                              <ActivityIndicator color={colors.primaryContainer} />
                            </View>
                          )}
                          {worn && (
                            <View style={styles.badge}>
                              <Icon name="check" size={14} color="onPrimary" />
                              <Txt variant="caption" weight={600} color="onPrimary">
                                {c.share.coverInUse}
                              </Txt>
                            </View>
                          )}
                        </Press>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              <View style={styles.prompt}>
                <Txt variant="label" weight={600}>
                  {c.share.coverPrompt}
                </Txt>
                <TextInput
                  value={words}
                  onChangeText={setWords}
                  accessibilityLabel={c.share.coverPrompt}
                  accessibilityHint={[c.share.coverPromptHint, charsLeft(c, words, LIMITS.coverPrompt)].filter(Boolean).join('. ')}
                  placeholder={ownWords}
                  placeholderTextColor={placeholderColor}
                  maxLength={LIMITS.coverPrompt}
                  multiline
                  numberOfLines={2}
                  autoComplete="off"
                  style={[field, styles.field]}
                />
                <CharCount value={words} max={LIMITS.coverPrompt} />
              </View>
              <Txt variant="label" color="secondary">
                {c.share.coverDrawn}
              </Txt>
              {usage && (
                <View style={styles.allowance}>
                  <Txt variant="label" weight={600} color={left === 0 ? 'error' : 'primaryContainer'}>
                    {left === 0 ? c.account.spent(resetTime(c.locale, usage.resetsAt)) : c.account.usage.cover(left ?? 0, usage.daily.cover.limit)}
                  </Txt>
                  <Txt variant="label" color="secondary">
                    {c.account.writer[usage.writers.cover]}
                  </Txt>
                </View>
              )}
              <View style={styles.actions}>
                <Button variant="primary" icon="auto_awesome" label={c.share.coverDraw} disabled={left === 0} onPress={() => void draw()} />
                <Button variant="text" label={c.common.cancel} onPress={() => setAsking(false)} />
              </View>
            </>
          )}
        </View>
      </Sheet>
    </>
  );
}

/** An earlier cover's side, in the sheet. */
const THUMB = 76;

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#57423b',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pressed: { backgroundColor: colors.surfaceContainer },
  drawing: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8, backgroundColor: 'rgba(252,249,244,0.78)' },
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 12 },
  allowance: { gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.xl, backgroundColor: colors.surfaceContainer },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  earlier: { gap: 6 },
  covers: { gap: 10, paddingVertical: 4 },
  choice: { borderRadius: radius.lg + 3, borderWidth: 3, borderColor: 'transparent' },
  worn: { borderColor: colors.primaryContainer },
  badge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primaryContainer,
  },
  prompt: { gap: 4 },
  field: { minHeight: 64, paddingVertical: 10, textAlignVertical: 'top' },
});
