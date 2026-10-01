// A song in the one player's bar (plan 107): the same bar as a phrase's (src/ui/MiniBar.tsx), told
// apart by the song's cover and a music-note badge. Tap to open the player; the button plays or
// pauses; swipe for the next or previous song of the album. Its grades float above the bar
// (SongBarGrades) and rate it, as in the player, for the phrases it sings.
import { useRouter } from 'expo-router';
import type { Song } from '@shared/api/library';
import { clock } from '@shared/state/clock';
import { windowLeft } from '@shared/state/selectors';
import type { PendingRating } from '@shared/state/types';
import { barRating } from '@shared/ui/rating';
import { useCopy, useStore } from '../state/store';
import { BarGrades, useRedrawIn } from '../ui/BarGrades';
import { MiniCard, MiniCarousel, MiniItem, MiniProgress, Side } from '../ui/MiniBar';
import { Txt } from '../ui/Txt';
import { AlbumCover } from './AlbumCover';
import { useMusic } from './MusicPlayer';
import { songRating, useRateSong } from './songRating';

export function MusicMiniPlayer() {
  const c = useCopy();
  const router = useRouter();
  const music = useMusic();
  if (!music.song) return null;
  const { index, queue } = music;
  const atEnd = index + 1 >= queue.length;

  /** A song's card: the playing one, or a neighbour as it will start (a skipped-to song plays). */
  const card = (song: Song, look: { playing: boolean; share: number }) => {
    const kind = song.audioBy === 'demo' ? (song.voiced ? c.music.spokenDemo : c.music.demoSound) : c.music.sung;
    const status = look.playing ? `${c.music.songKind} · ${kind}` : c.player.paused;
    return (
      <MiniCard
        cover={<AlbumCover url={music.album?.coverUrl ?? null} px={44} rounded={8} badges={false} />}
        badge="music_note"
        title={
          <Txt variant="row" weight={600} color="inverseOnSurface" numberOfLines={1}>
            {song.title}
          </Txt>
        }
        status={status}
        open={{ label: `${c.music.nowPlaying}: ${song.title}`, hint: c.music.songKind, onPress: () => router.push('/player') }}
        playing={look.playing}
        onToggle={music.toggle}
        next={{ label: c.music.next, onPress: music.next, disabled: atEnd }}
        progress={<MiniProgress share={look.share} />}
      />
    );
  };

  const neighbour = (side: Side): MiniItem | null => {
    const song = queue[index + side];
    return song ? { key: `${index + side}:${song.id}`, card: card(song, { playing: true, share: 0 }) } : null;
  };

  return (
    <MiniCarousel
      item={{
        key: `${index}:${music.song.id}`,
        card: card(music.song, { playing: music.playing, share: music.duration > 0 ? music.position / music.duration : 0 }),
      }}
      position={index}
      queue={music.album?.id ?? ''}
      can={{ next: !atEnd, previous: index > 0 }}
      neighbour={neighbour}
      onSwipe={(side) => music.skip(side)}
    />
  );
}

/**
 * A song's grades above the bar, as a phrase's: they review the phrases it sings. A song that sings
 * none of this course's phrases (or only ones rated some other way) has nothing to rate.
 */
export function SongBarGrades() {
  const music = useMusic();
  const { state, actions } = useStore();
  const rateSong = useRateSong();
  const song = music.song;
  const now = clock.now();
  const rating = song ? songRating(state, song, now) : null;
  const latest = rating?.given.reduce<PendingRating | null>((a, p) => (a === null || p.changedAt > a.changedAt ? p : a), null) ?? null;
  const windowOpen = rating && rating.given.length > 0 ? Math.min(...rating.given.map((p) => windowLeft(p, now))) : 0;
  const view = barRating({ ratable: rating !== null && rating.count > 0, rated: windowOpen > 0 }, latest, now);
  // Drawn again as Undo runs out, and as the window closes and the grades come back.
  useRedrawIn(view.kind === 'undo' ? view.left : windowOpen > 0 ? windowOpen : null);
  if (!song || !rating) return null;
  return <BarGrades view={view} onRate={(grade) => rateSong(song, rating, grade)} onUndo={() => actions.unratePhrases(song.id)} />;
}
