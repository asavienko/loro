// Making a song from a set (plans 106, 113): which set, which of the twelve styles, how it is sung
// (voice, tempo, mood, length: folded under one row), what it is about, which album and a title;
// then the lyrics first, written by the server's text model in the background and shown
// here line by line with their meanings. The learner has them written again, or changed as they ask
// in their own words, and only then has them sung: the song is made from exactly those lines and
// appears in its album as it is made. Spent allowances (lyrics, songs) are shown before they ask.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { DEFAULT_SONG_OPTIONS, generateSong, rewriteLyrics, SONG_STYLES, SONG_THEME_MAX, writeLyrics, type Lyrics, type SongOptions, type SongStyle } from '@shared/api/library';
import { albumsForCourse, librarySets, setsForCourse } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { tidy } from '@shared/state/limits';
import { useMusic } from '../music/MusicPlayer';
import { remaining, useAccount } from '../state/account';
import { useContent } from '../state/content';
import { registerForPush } from '../state/push';
import { useCopy, useStore } from '../state/store';
import { Button, Chip } from '../ui/Button';
import { field, placeholderColor } from '../ui/field';
import { Icon } from '../ui/Icon';
import { problemText, resetTime } from '../ui/problems';
import { Sheet, SheetOption, SheetSection } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, radius } from '../ui/theme';
import { optionsSummary, SongOptionsPanel } from './SongOptions';

export interface MakeSongRequest {
  setId?: string;
  albumId?: string;
}

/** What the learner may ask to change, as the server bounds it. */
const INSTRUCTION_MAX = 200;

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
  const nativeLang = state.learner.profile.nativeLang;
  const sets = [...librarySets(target), ...setsForCourse(target)];
  const albums = albumsForCourse(target).filter((a) => a.owner === 'me');
  const [setId, setSetId] = useState<string | null>(request.setId ?? null);
  const [style, setStyle] = useState<SongStyle>('modern_pop');
  const [options, setOptions] = useState<SongOptions>(DEFAULT_SONG_OPTIONS);
  const [theme, setTheme] = useState('');
  const [albumId, setAlbumId] = useState<string | null>(request.albumId ?? null);
  const [title, setTitle] = useState('');
  // The lyrics step: the draft as the server last sent it, and what the learner asks to change.
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState<'writing' | 'singing' | null>(null);
  // The sheet closed while the server was writing: the answer goes nowhere.
  const open = useRef(true);
  useEffect(
    () => () => {
      open.current = false;
    },
    [],
  );
  const { refreshUsage } = account;

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const songsLeft = remaining(account.usage, 'song');
  const lyricsLeft = remaining(account.usage, 'lyrics');
  const aiWrites = account.usage?.writers.lyrics === 'ai';
  const chosen = sets.find((s) => s.id === setId) ?? null;
  const cleanTitle = tidy(title);
  // What the song is about only reaches a writer; the set's phrases arranged have no lines to give it.
  const asked: SongOptions = { ...options, theme: aiWrites ? tidy(theme) || null : null };

  /** Step one's end: the lyrics, written in the background while this waits. */
  const write = async () => {
    if (!chosen) return;
    setBusy('writing');
    try {
      const draft = await writeLyrics({ setId: chosen.id, styleId: style, nativeLang, options: asked, ...(cleanTitle ? { title: cleanTitle } : {}) });
      if (!open.current) return;
      setLyrics(draft);
      if (draft.status === 'failed') toast(c.create.lyricsFailed);
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setBusy(null);
      void account.refreshUsage();
    }
  };

  /** The same draft again: anew, or changed as asked. */
  const rewrite = async () => {
    if (!lyrics) return;
    const asked = tidy(instruction);
    setBusy('writing');
    try {
      const draft = await rewriteLyrics(lyrics.id, asked || undefined);
      if (!open.current) return;
      setLyrics(draft);
      if (draft.status === 'ready') setInstruction('');
      else if (draft.status === 'failed') toast(c.create.lyricsFailed);
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setBusy(null);
      void account.refreshUsage();
    }
  };

  /** Approved: the song is sung from these lines. */
  const sing = async () => {
    if (!chosen || !lyrics || lyrics.status !== 'ready') return;
    setBusy('singing');
    try {
      // Sung with the options the lyrics were written for (the server reads them from the draft): they
      // change only by going back to the setup, which writes new lyrics.
      const made = await generateSong({ setId: chosen.id, styleId: style, nativeLang, lyricsId: lyrics.id, ...(cleanTitle ? { title: cleanTitle } : {}), ...(albumId ? { albumId } : {}) });
      toast(c.create.songStarted, { tone: 'success' });
      music.watch(made.song, made.album);
      // The phone hears when it is ready, even with the app closed (plan 113).
      void registerForPush(c);
      onClose();
      void account.refreshUsage();
      await content.refresh();
      nav.openAlbum(made.album.id);
    } catch (error) {
      toast(problemText(c, error));
      void account.refreshUsage();
    } finally {
      setBusy(null);
    }
  };

  if (account.status !== 'signedIn')
    return (
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
    );

  if (lyrics)
    return (
      <>
        <View style={styles.pad}>
          <View style={styles.draftHead}>
            <Txt variant="body" weight={700} accessibilityRole="header" style={{ flex: 1 }}>
              {chosen?.title ?? ''}
            </Txt>
            <Txt variant="label" color="secondary">
              {`${c.create.draft(lyrics.revision)} · ${c.music.style[style]}`}
            </Txt>
          </View>
          <View style={styles.tags}>
            <Icon name="graphic_eq" size="xs" color="secondary" />
            <Txt variant="label" color="secondary" style={{ flex: 1 }}>
              {[optionsSummary(c, lyrics.options ?? asked), ...(lyrics.options?.theme ? [`“${lyrics.options.theme}”`] : [])].join(' · ')}
            </Txt>
          </View>
          <Txt variant="label" color="secondary">
            {lyrics.lyricsBy === 'phrases' && !aiWrites ? c.create.lyricsPlain : c.create.lyricsReady}
          </Txt>
          {busy === 'writing' && (
            <View style={styles.writing} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.primaryContainer} />
              <Txt variant="label" color="secondary">
                {c.create.writingLyrics}
              </Txt>
            </View>
          )}
        </View>
        <View style={[styles.lyrics, busy === 'writing' && styles.dim]}>
          {lyrics.sections.map((section, s) => (
            <View key={`${section.name}-${s}`} style={styles.section}>
              <Txt variant="label" weight={700} color="primaryContainer">
                {c.music.section[section.name].toLocaleUpperCase(c.locale)}
              </Txt>
              {section.lines.map((line, l) => (
                <View key={l} style={styles.line}>
                  <Txt variant="title" face="serif" weight={500} lang={chosen?.targetLang}>
                    {line.text}
                  </Txt>
                  <Txt variant="body" color="secondary">
                    {line.meaning}
                  </Txt>
                </View>
              ))}
            </View>
          ))}
          {lyrics.lyricsBy && (
            <View style={styles.by}>
              <Icon name="lyrics" size="xs" color="primaryContainer" />
              <Txt variant="label" weight={600}>
                {c.music.lyricsBy[lyrics.lyricsBy]}
              </Txt>
            </View>
          )}
        </View>
        {aiWrites && (
          <View style={styles.pad}>
            <Txt variant="label" weight={600} nativeID="lyrics-change">
              {c.create.rewriteLabel}
            </Txt>
            <TextInput
              accessibilityLabelledBy="lyrics-change"
              aria-label={c.create.rewriteLabel}
              value={instruction}
              onChangeText={setInstruction}
              maxLength={INSTRUCTION_MAX}
              placeholder={c.create.rewritePlaceholder}
              placeholderTextColor={placeholderColor}
              editable={busy === null}
              multiline
              style={[field, styles.instruction]}
            />
            {account.usage && (
              <Txt variant="label" color={lyricsLeft === 0 ? 'error' : 'secondary'} accessibilityLiveRegion="polite">
                {lyricsLeft === 0 ? c.account.spent(resetTime(c.locale, account.usage.resetsAt)) : c.account.usage.lyrics(lyricsLeft ?? 0, account.usage.daily.lyrics?.limit ?? 0)}
              </Txt>
            )}
            <Button variant="tonal" icon="edit_note" label={tidy(instruction) ? c.create.rewriteAsAsked : c.create.rewrite} disabled={busy !== null || lyricsLeft === 0} onPress={() => void rewrite()} />
          </View>
        )}
        <View style={styles.pad}>
          {account.usage && (
            <Txt variant="label" color={songsLeft === 0 ? 'error' : 'secondary'} accessibilityLiveRegion="polite">
              {songsLeft === 0 ? c.account.spent(resetTime(c.locale, account.usage.resetsAt)) : c.account.usage.song(songsLeft ?? 0, account.usage.daily.song.limit)}
            </Txt>
          )}
          {account.usage?.writers.music === 'demo' && (
            <Txt variant="label" color="secondary">
              {c.account.writer.demo}
            </Txt>
          )}
          <Button variant="primary" icon="music_note" label={c.create.approve} disabled={lyrics.status !== 'ready' || busy !== null || songsLeft === 0} onPress={() => void sing()} />
          <Button variant="text" icon="arrow_back" label={c.create.backToSetup} disabled={busy !== null} onPress={() => setLyrics(null)} />
        </View>
      </>
    );

  return (
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
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={c.create.pickStyle}>
          {SONG_STYLES.map((id) => (
            <Chip key={id} label={c.music.style[id]} selected={style === id} onPress={() => setStyle(id)} />
          ))}
        </View>
      </SheetSection>
      <SongOptionsPanel c={c} options={options} onChange={setOptions} demoSound={account.usage?.writers.music === 'demo'} />
      {aiWrites && (
        <View style={styles.pad}>
          <Txt variant="label" weight={600} nativeID="song-theme">
            {c.create.themeLabel}
          </Txt>
          <TextInput
            accessibilityLabelledBy="song-theme"
            aria-label={c.create.themeLabel}
            value={theme}
            onChangeText={setTheme}
            maxLength={SONG_THEME_MAX}
            placeholder={c.create.themePlaceholder}
            placeholderTextColor={placeholderColor}
            multiline
            style={[field, styles.instruction]}
          />
        </View>
      )}
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
        {account.usage && aiWrites && (
          <Txt variant="label" color={lyricsLeft === 0 ? 'error' : 'secondary'} accessibilityLiveRegion="polite">
            {lyricsLeft === 0 ? c.account.spent(resetTime(c.locale, account.usage.resetsAt)) : c.account.usage.lyrics(lyricsLeft ?? 0, account.usage.daily.lyrics?.limit ?? 0)}
          </Txt>
        )}
        {account.usage && !aiWrites && (
          <Txt variant="label" color="secondary">
            {c.account.writer.phrases}
          </Txt>
        )}
        {busy === 'writing' ? (
          <View style={styles.writing} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primaryContainer} />
            <Txt variant="label" color="secondary">
              {c.create.writingLyrics}
            </Txt>
          </View>
        ) : (
          <Button variant="primary" icon="lyrics" label={c.create.writeLyrics} disabled={!chosen || busy !== null || (aiWrites && lyricsLeft === 0)} onPress={() => void write()} />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  inset: { paddingHorizontal: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  draftHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  writing: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  lyrics: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  dim: { opacity: 0.5 },
  section: { gap: 4, paddingTop: 8 },
  line: { paddingVertical: 4, gap: 2 },
  by: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, marginTop: 8 },
  instruction: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
});
