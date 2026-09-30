// An album (plan 106): its cover, who made it, and its songs. The owner shares it, draws it a new
// cover, adds songs or deletes it; anyone else who can see it saves it to their library. A song
// still being made shows as such and turns playable when it is ready.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteAlbum, deleteSong, fetchAlbum, generateCover, retrySong, saveItem, unsaveItem, type AlbumDetail, type Song } from '@shared/api/library';
import { useNav } from '@shared/nav/NavContext';
import { AlbumCover } from '../music/AlbumCover';
import { clockTime, useMusic } from '../music/MusicPlayer';
import { RenameSheet } from '../sheets/RenameSheet';
import { ReportSheet } from '../sheets/ReportSheet';
import { MoreAlbumsByMaker } from './MoreByMaker';
import { useAccount } from '../state/account';
import { useContent } from '../state/content';
import { NightStatusBar } from '../music/NightStatusBar';
import { useCopy, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { confirm } from '../ui/confirm';
import { problemText } from '../ui/problems';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET } from '../ui/theme';

/** How often a song still being made is asked about. */
const POLL_MS = 2500;

export function AlbumScreen({ id }: { id: string }) {
  const c = useCopy();
  const nav = useNav();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const music = useMusic();
  const account = useAccount();
  const content = useContent();
  const [detail, setDetail] = useState<AlbumDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const { state } = useStore();
  // The song whose retry or removal is on its way: its buttons wait, so a second tap sends nothing.
  const [acting, setActing] = useState<string | null>(null);

  // A failed song of the learner's own: made again (another of the day's songs), or taken out.
  const retry = async (song: Song) => {
    setActing(song.id);
    try {
      await retrySong(song.id, state.learner.profile.nativeLang);
      void account.refreshUsage();
      await load();
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setActing(null);
    }
  };
  const removeSong = async (song: Song) => {
    if (!(await confirm(c.music.removeSongConfirm(song.title), c.music.removeSong, c.common.cancel))) return;
    setActing(song.id);
    try {
      await deleteSong(song.id);
      await load();
      await content.refresh();
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setActing(null);
    }
  };

  const load = useCallback(async () => {
    try {
      setDetail(await fetchAlbum(id));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [id]);

  useEffect(() => {
    let live = true;
    fetchAlbum(id).then(
      (next) => live && setDetail(next),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [id]);

  const rendering = detail?.songs.some((s) => s.status === 'rendering') ?? false;
  useEffect(() => {
    if (!rendering) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [rendering, load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/music'));

  if (!detail) {
    return (
      <View style={[styles.page, styles.center, { paddingTop: insets.top }]}>
        {failed ? (
          <>
            <Txt variant="row" color="onNight">
              {c.music.loadFailed}
            </Txt>
            <Button variant="tonal" icon="refresh" label={c.connection.retry} onPress={() => void load()} />
            <Button variant="text" color="nightAccent" label={c.common.back} onPress={back} />
          </>
        ) : (
          <ActivityIndicator color={colors.nightAccent} />
        )}
      </View>
    );
  }

  const { album, songs } = detail;
  const mine = album.owner === 'me';
  const ready = songs.filter((s) => s.status === 'ready');
  const byline = album.owner === 'loro' ? c.music.loro : mine ? c.share.yours : album.author ? c.share.by(album.author) : c.share.byLearner;
  const isPlaying = (song: Song) => music.song?.id === song.id && music.playing;

  const drawCover = async () => {
    setDrawing(true);
    try {
      await generateCover({ kind: 'album', title: album.title, ...(album.description ? { description: album.description } : {}), attachTo: album.id });
      await Promise.all([load(), content.refresh(), account.refreshUsage()]);
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setDrawing(false);
    }
  };

  const remove = async () => {
    if (!(await confirm(c.share.deleteAlbumConfirm(album.title), c.share.delete, c.common.cancel))) return;
    try {
      await deleteAlbum(album.id);
      if (music.album?.id === album.id) music.stop();
      toast(c.share.deleted);
      await content.refresh();
      back();
    } catch (error) {
      toast(problemText(c, error));
    }
  };

  const toggleSaved = async () => {
    if (account.status !== 'signedIn') return nav.openAccount();
    try {
      if (album.saved) await unsaveItem('album', album.id);
      else await saveItem('album', album.id);
      toast(album.saved ? c.share.unsavedToast : c.share.savedToast);
      await Promise.all([load(), content.refresh()]);
    } catch (error) {
      toast(problemText(c, error));
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 4 }]}>
      <NightStatusBar />
      <View style={styles.top}>
        <Button variant="icon" icon="arrow_back" color="onNight" accessibilityLabel={c.common.back} onPress={back} />
      </View>
      <View style={styles.hero}>
        <View>
          <AlbumCover url={album.coverUrl} px={200} rounded={16} />
          {drawing && (
            <View style={styles.drawing}>
              <ActivityIndicator color={colors.onNight} />
              <Txt variant="label" color="onNight">
                {c.share.coverMaking}
              </Txt>
            </View>
          )}
        </View>
        <Txt variant="label" weight={700} color="nightAccent" style={styles.kicker}>
          {c.music.album.toLocaleUpperCase(c.locale)}
        </Txt>
        <Txt variant="displaySm" face="serif" weight={600} color="onNight" align="center" accessibilityRole="header">
          {album.title}
        </Txt>
        <Txt variant="body" color="onNightVariant" align="center">
          {`${byline} · ${c.music.songs(album.songCount)}${album.durationMs ? ` · ${clockTime(album.durationMs / 1000)}` : ''}`}
        </Txt>
        {(album.description ?? (album.owner === 'loro' ? c.music.loroAlbum : null)) && (
          <Txt variant="body" color="onNightVariant" align="center">
            {album.description ?? c.music.loroAlbum}
          </Txt>
        )}
      </View>

      <View style={styles.actions}>
        <Button variant="primary" icon="play_arrow" iconFill label={c.music.playAlbum} disabled={ready.length === 0} onPress={() => music.playAlbum(album, ready, 0)} />
        {mine ? (
          <>
            <Button variant="icon" icon="share" color="onNight" accessibilityLabel={c.share.share} onPress={() => nav.share({ kind: 'album', ...album })} />
            <Button variant="icon" icon="edit" color="onNight" accessibilityLabel={c.music.renameAlbum} onPress={() => setRenaming(true)} />
            <Button variant="icon" icon="palette" color="onNight" accessibilityLabel={c.share.cover} disabled={drawing} onPress={() => void drawCover()} />
            <Button variant="icon" icon="delete" color="onNight" accessibilityLabel={c.share.delete} onPress={() => void remove()} />
          </>
        ) : (
          <>
            {album.owner === 'other' && (
              <Button
                variant="icon"
                icon={album.saved ? 'bookmark_added' : 'bookmark_add'}
                iconFill={album.saved}
                color="onNight"
                accessibilityLabel={album.saved ? c.share.unsave : c.share.save}
                onPress={() => void toggleSaved()}
              />
            )}
            {album.shareCode && <Button variant="icon" icon="share" color="onNight" accessibilityLabel={c.share.share} onPress={() => nav.share({ kind: 'album', ...album })} />}
            {album.owner === 'other' && <Button variant="icon" icon="info" color="onNight" accessibilityLabel={c.share.report} onPress={() => setReporting(true)} />}
          </>
        )}
      </View>

      <ReportSheet item={reporting ? { kind: 'album', id: album.id } : null} onClose={() => setReporting(false)} />
      <RenameSheet item={renaming ? { kind: 'album', id: album.id, title: album.title } : null} onClose={() => setRenaming(false)} onRenamed={() => void load()} />
      <View style={styles.songs}>
        {songs.length === 0 && (
          <Txt variant="body" color="onNightVariant" style={styles.pad}>
            {c.music.noSongs}
          </Txt>
        )}
        {songs.map((song, index) => (
          <SongRow
            key={song.id}
            song={song}
            index={index}
            current={music.song?.id === song.id}
            playing={isPlaying(song)}
            onPlay={() => {
              if (music.song?.id === song.id) return router.push('/song');
              music.playAlbum(album, ready, ready.findIndex((s) => s.id === song.id));
            }}
            onRetry={mine && song.status === 'failed' ? () => void retry(song) : undefined}
            onRemove={mine && song.status === 'failed' ? () => void removeSong(song) : undefined}
            acting={acting === song.id}
          />
        ))}
        {rendering && (
          <Txt variant="label" color="onNightVariant" style={styles.pad}>
            {c.music.renderingNote}
          </Txt>
        )}
        {mine && <Button variant="tonal" icon="add" label={c.music.makeSong} onPress={() => nav.makeSong({ albumId: album.id })} style={styles.add} />}
      </View>
      {album.owner === 'other' && <MoreAlbumsByMaker key={album.id} albumId={album.id} author={album.author} />}
    </ScrollView>
  );
}

function SongRow({ song, index, current, playing, onPlay, onRetry, onRemove, acting = false }: { song: Song; index: number; current: boolean; playing: boolean; onPlay: () => void; onRetry?: () => void; onRemove?: () => void; acting?: boolean }) {
  const c = useCopy();
  const ready = song.status === 'ready';
  const meta = [c.music.style[song.styleId], song.durationMs ? clockTime(song.durationMs / 1000) : null, song.audioBy === 'demo' ? (song.voiced ? c.music.spokenDemo : c.music.demoSound) : song.audioBy === 'elevenlabs' ? c.music.sung : null]
    .filter(Boolean)
    .join(' · ');
  // The retry and remove buttons sit beside the row's own button, never inside it.
  return (
    <View style={[styles.songRow, current && styles.songCurrent]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ready ? c.music.playSong(song.title) : `${song.title}, ${song.status === 'rendering' ? c.music.rendering : c.music.failed}`}
        accessibilityState={{ disabled: !ready, selected: current }}
        disabled={!ready}
        onPress={onPlay}
        style={({ pressed }) => [styles.song, pressed && styles.songPressed]}
      >
        <View style={styles.songIndex}>
          {song.status === 'rendering' ? (
            <ActivityIndicator size="small" color={colors.nightAccent} />
          ) : playing ? (
            <Icon name="graphic_eq" color="nightAccent" />
          ) : song.status === 'failed' ? (
            <Icon name="error" color="onNightVariant" />
          ) : (
            <Txt variant="body" weight={600} color={current ? 'nightAccent' : 'onNightVariant'}>
              {index + 1}
            </Txt>
          )}
        </View>
        <View style={styles.songText}>
          <Txt variant="row" weight={600} color={current ? 'nightAccent' : 'onNight'} numberOfLines={1}>
            {song.title}
          </Txt>
          <Txt variant="label" color="onNightVariant" numberOfLines={1}>
            {song.status === 'rendering' ? c.music.rendering : song.status === 'failed' ? c.music.failed : meta}
          </Txt>
        </View>
        {ready && <Icon name={playing ? 'pause' : 'play_arrow'} fill color="onNight" />}
      </Pressable>
      {onRetry && <Button variant="icon" icon="refresh" color="onNight" accessibilityLabel={c.music.retrySong(song.title)} disabled={acting} onPress={onRetry} />}
      {onRemove && <Button variant="icon" icon="delete" color="onNight" accessibilityLabel={c.music.removeSong} disabled={acting} onPress={onRemove} />}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.night },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  content: { paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' },
  top: { flexDirection: 'row', paddingHorizontal: 8 },
  hero: { alignItems: 'center', gap: 6, paddingHorizontal: 24 },
  drawing: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(33,27,24,0.6)', borderRadius: 16 },
  kicker: { marginTop: 12, letterSpacing: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 16, paddingHorizontal: 16 },
  songs: { paddingTop: 20, gap: 2, paddingHorizontal: 12 },
  pad: { paddingHorizontal: 12, paddingVertical: 8 },
  songRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl },
  song: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TARGET + 12, paddingHorizontal: 8, borderRadius: radius.xl },
  songCurrent: { backgroundColor: colors.nightContainer },
  songPressed: { backgroundColor: colors.nightContainerHigh },
  songIndex: { width: 28, alignItems: 'center' },
  songText: { flex: 1, gap: 2 },
  add: { alignSelf: 'flex-start', marginTop: 12, marginLeft: 8 },
});
