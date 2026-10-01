// A new drawn cover from the artwork itself (LIB-04): a small button in the corner of a set's,
// album's, song's or phrase's artwork. It asks first, saying what will happen and how many covers
// are left today (LIB-02): the learner's own set or album changes in place; one of Loro's, read-only
// (LIB-01), is copied into their Library wearing the cover, and the app opens the copy; a phrase or a
// song gets a cover of the learner's own. Drawing needs an account (F-01); while it draws, the
// artwork says so.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { keepItemCover } from '@shared/api/contentCache';
import { generateCover, type Song } from '@shared/api/library';
import { findAlbum, type Album, type LanguageCode, type Phrase, type PhraseSet } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { promptOf } from '@shared/state/catalog';
import { remaining, useAccount } from '../state/account';
import { useContent } from '../state/content';
import { useCopy, useStore } from '../state/store';
import { Button } from './Button';
import { Icon } from './Icon';
import { problemText, resetTime } from './problems';
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

  const open = () => {
    setAsking(true);
    // The allowance as it stands now, not as it was when the app opened.
    if (signedIn) void account.refreshUsage();
  };

  const draw = async () => {
    setAsking(false);
    setDrawing(true);
    const id = idOf(item);
    try {
      const drawn = await generateCover({ kind: item.kind, attachTo: id, nativeLang: state.learner.profile.nativeLang });
      void account.refreshUsage();
      if (item.kind === 'phrase' || item.kind === 'song') {
        // Shown at once, and kept with the course for offline.
        const course = item.kind === 'phrase' ? item.phrase.targetLang : (findAlbum(item.song.albumId)?.targetLang ?? state.learner.profile.targetLang);
        await keepItemCover(course, item.kind, id, drawn.url);
      } else await content.refresh();
      const by = c.share.coverBy[drawn.provider];
      if (drawn.copy) {
        toast(`${by} · ${c.share.coverCopied}`, { tone: 'success' });
        if (drawn.copy.kind === 'set') nav.openSet(drawn.copy.id);
        else nav.openAlbum(drawn.copy.id);
      } else {
        if (item.kind === 'album') item.onDrawn?.();
        toast(by, { tone: 'success' });
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={c.share.coverFor(titleOf(item, state.learner.profile.nativeLang))}
          hitSlop={slop}
          onPress={open}
          style={({ pressed }) => [styles.chip, { width: chip, height: chip, right: inset, bottom: inset }, pressed && styles.pressed]}
        >
          <Icon name="auto_awesome" size={Math.round(chip * 0.56)} color="primaryContainer" />
        </Pressable>
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
});
