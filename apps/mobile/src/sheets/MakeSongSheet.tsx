// Making a song from a set (plan 106): which set, which style, which album. The server writes the
// lyrics and the sound in the background; the song appears in its album as it is made. A spent
// allowance is shown before the learner asks, with when it comes back.
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { generateSong, SONG_STYLES, type SongStyle } from '@shared/api/library';
import { albumsForCourse, librarySets, setsForCourse } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { useMusic } from '../music/MusicPlayer';
import { remaining, useAccount } from '../state/account';
import { useContent } from '../state/content';
import { useCopy, useStore } from '../state/store';
import { Button, Chip } from '../ui/Button';
import { field, placeholderColor } from '../ui/field';
import { problemText, resetTime } from '../ui/problems';
import { Sheet, SheetOption, SheetSection } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';

export interface MakeSongRequest {
  setId?: string;
  albumId?: string;
}

export function MakeSongSheet({ request, onClose }: { request: MakeSongRequest | null; onClose: () => void }) {
  const c = useCopy();
  return (
    <Sheet open={request !== null} title={c.music.makeSong} onClose={onClose}>
      {/* A new form each time the sheet opens, starting from what it was opened with. */}
      {request && <MakeSongForm key={`${request.setId ?? ''}:${request.albumId ?? ''}`} request={request} onClose={onClose} />}
    </Sheet>
  );
}

function MakeSongForm({ request, onClose }: { request: MakeSongRequest; onClose: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { toast } = useToast();
  const { state } = useStore();
  const content = useContent();
  const account = useAccount();
  const music = useMusic();
  const target = state.learner.profile.targetLang;
  const sets = [...librarySets(target), ...setsForCourse(target)];
  const albums = albumsForCourse(target).filter((a) => a.owner === 'me');
  const [setId, setSetId] = useState<string | null>(request.setId ?? null);
  const [style, setStyle] = useState<SongStyle>('modern_pop');
  const [albumId, setAlbumId] = useState<string | null>(request.albumId ?? null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const { refreshUsage } = account;

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const left = remaining(account.usage, 'song');
  const spent = left === 0;
  const chosen = sets.find((s) => s.id === setId) ?? null;

  const make = async () => {
    if (!chosen) return;
    setBusy(true);
    try {
      const made = await generateSong({ setId: chosen.id, styleId: style, nativeLang: state.learner.profile.nativeLang, ...(title.trim() ? { title: title.trim() } : {}), ...(albumId ? { albumId } : {}) });
      toast(c.create.songStarted, { tone: 'success' });
      music.watch(made.song, made.album);
      onClose();
      void account.refreshUsage();
      await content.refresh();
      nav.openAlbum(made.album.id);
    } catch (error) {
      toast(problemText(c, error));
      void account.refreshUsage();
    } finally {
      setBusy(false);
    }
  };

  return account.status !== 'signedIn' ? (
        <View style={styles.pad}>
          <Txt variant="row" color="secondary">
            {c.account.needed}
          </Txt>
          <Button
            variant="primary"
            icon="account_circle"
            label={c.account.signIn}
            onPress={() => {
              onClose();
              nav.openAccount();
            }}
          />
        </View>
      ) : (
        <>
          <SheetSection title={c.create.pickSet}>
            {sets.length === 0 && (
              <Txt variant="body" color="secondary" style={styles.inset}>
                {c.create.pickSetEmpty}
              </Txt>
            )}
            <View accessibilityRole="radiogroup" accessibilityLabel={c.create.pickSet}>
              {sets.map((set) => (
                <SheetOption
                  key={set.id}
                  icon={set.owner === 'loro' ? 'menu_book' : 'queue_music'}
                  label={set.title}
                  detail={c.common.phrases(set.phraseIds.length)}
                  selected={set.id === setId}
                  onPress={() => setSetId(set.id)}
                />
              ))}
            </View>
          </SheetSection>
          <SheetSection title={c.create.pickStyle}>
            <View style={styles.chips}>
              {SONG_STYLES.map((id) => (
                <Chip key={id} label={c.music.style[id]} selected={style === id} onPress={() => setStyle(id)} />
              ))}
            </View>
          </SheetSection>
          <SheetSection title={c.create.pickAlbum}>
            <View accessibilityRole="radiogroup" accessibilityLabel={c.create.pickAlbum}>
              <SheetOption icon="add" label={c.create.newAlbum} detail={chosen?.title} selected={albumId === null} onPress={() => setAlbumId(null)} />
              {albums.map((album) => (
                <SheetOption key={album.id} icon="album" label={album.title} detail={c.music.songs(album.songCount)} selected={albumId === album.id} onPress={() => setAlbumId(album.id)} />
              ))}
            </View>
          </SheetSection>
          <View style={styles.pad}>
            <Txt variant="label" weight={600} nativeID="song-title">
              {c.create.songTitleLabel}
            </Txt>
            <TextInput
              accessibilityLabelledBy="song-title"
              aria-label={c.create.songTitleLabel}
              value={title}
              onChangeText={setTitle}
              maxLength={60}
              placeholder={chosen?.title ?? ''}
              placeholderTextColor={placeholderColor}
              style={field}
            />
            {account.usage && (
              <Txt variant="label" color={spent ? 'error' : 'secondary'} accessibilityLiveRegion="polite">
                {spent ? c.account.spent(resetTime(c.locale, account.usage.resetsAt)) : c.account.usage.song(left ?? 0, account.usage.daily.song.limit)}
              </Txt>
            )}
            {account.usage?.writers.music === 'demo' && (
              <Txt variant="label" color="secondary">
                {c.account.writer.demo}
              </Txt>
            )}
            <Button variant="primary" icon="music_note" label={c.create.makeSong} disabled={!chosen || busy || spent} onPress={() => void make()} />
          </View>
        </>
      );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  inset: { paddingHorizontal: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
});
