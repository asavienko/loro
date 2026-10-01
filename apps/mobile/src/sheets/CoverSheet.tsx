// A new drawn cover for one of the learner's sets or albums (plan 106), from Create.
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { generateCover } from '@shared/api/library';
import { albumsForCourse, librarySets } from '@shared/content';
import { AlbumCover } from '../music/AlbumCover';
import { remaining, useAccount } from '../state/account';
import { useContent } from '../state/content';
import { useCopy, useStore } from '../state/store';
import { Icon } from '../ui/Icon';
import { problemText, resetTime } from '../ui/problems';
import { SetCover } from '../ui/SetCover';
import { Sheet, SheetSection } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET } from '../ui/theme';

export function CoverSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useCopy();
  const { toast } = useToast();
  const { state } = useStore();
  const account = useAccount();
  const content = useContent();
  const target = state.learner.profile.targetLang;
  const sets = librarySets(target).filter((s) => s.owner === 'me');
  const albums = albumsForCourse(target).filter((a) => a.owner === 'me');
  const [drawing, setDrawing] = useState<string | null>(null);
  const left = remaining(account.usage, 'cover');

  const draw = async (kind: 'set' | 'album', id: string, title: string, description: string | null) => {
    setDrawing(id);
    try {
      const cover = await generateCover({ kind, title, attachTo: id, ...(description ? { description } : {}) });
      await content.refresh();
      void account.refreshUsage();
      toast(cover.status === 'rendering' ? c.share.coverLater : c.share.coverBy[cover.provider]);
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setDrawing(null);
    }
  };

  const row = (key: string, cover: React.ReactNode, title: string, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`${c.share.cover}: ${title}`}
      disabled={drawing !== null || left === 0}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {cover}
      <Txt variant="row" weight={600} numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Txt>
      {drawing === key ? <ActivityIndicator color={colors.primaryContainer} /> : <Icon name="palette" color="secondary" />}
    </Pressable>
  );

  return (
    <Sheet open={open} title={c.create.coverTitle} onClose={onClose}>
      <View style={styles.pad}>
        <Txt variant="body" color="secondary">
          {c.create.coverBody}
        </Txt>
        {account.usage && (
          <Txt variant="label" color={left === 0 ? 'error' : 'secondary'}>
            {left === 0 ? c.account.spent(resetTime(c.locale, account.usage.resetsAt)) : c.account.usage.cover(left ?? 0, account.usage.daily.cover.limit)}
          </Txt>
        )}
        {sets.length === 0 && albums.length === 0 && <Txt color="secondary">{c.create.coverNothing}</Txt>}
      </View>
      {sets.length > 0 && (
        <SheetSection title={c.phrasesTab.yourSets}>
          {sets.map((set) => row(set.id, <SetCover set={set} px={44} rounded={10} />, set.title, () => void draw('set', set.id, set.title, set.description)))}
        </SheetSection>
      )}
      {albums.length > 0 && (
        <SheetSection title={c.music.yours}>
          {albums.map((album) => row(album.id, <AlbumCover url={album.coverUrl} px={44} rounded={10} />, album.title, () => void draw('album', album.id, album.title, album.description)))}
        </SheetSection>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TARGET + 12, paddingHorizontal: 16, borderRadius: radius.xl },
  pressed: { backgroundColor: colors.surfaceContainer },
});
