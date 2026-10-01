// A song in the one player's bar (plan 107): the same bar as a phrase's (src/ui/MiniBar.tsx), told
// apart by the song's cover and a music-note badge. Tap to open the player; the button plays or
// pauses; swipe for the next or previous song of the album; rate it, as in the player, for the
// phrases it sings.
import { useRouter } from 'expo-router';
import type { Song } from '@shared/api/library';
import { useCopy, useNow, useStore } from '../state/store';
import { MiniCard, MiniCarousel, MiniItem, MiniProgress, MiniRating, Side } from '../ui/MiniBar';
import { Txt } from '../ui/Txt';
import { AlbumCover } from './AlbumCover';
import { useMusic } from './MusicPlayer';
import { songRating, useRateSong } from './songRating';

export function MusicMiniPlayer() {
  const c = useCopy();
  const router = useRouter();
  const music = useMusic();
  const { state, actions } = useStore();
  const now = useNow(60_000);
  const rateSong = useRateSong();
  if (!music.song) return null;
  const { index, queue } = music;
  const atEnd = index + 1 >= queue.length;

  /** A song's card: the playing one, or a neighbour as it will start (a skipped-to song plays). */
  const card = (song: Song, look: { playing: boolean; share: number; live: boolean }) => {
    const kind = song.audioBy === 'demo' ? (song.voiced ? c.music.spokenDemo : c.music.demoSound) : c.music.sung;
    const status = look.playing ? `${c.music.songKind} · ${kind}` : c.player.paused;
    const rating = songRating(state, song, now);
    const given = rating.given[0];
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
        rating={
          // A song that sings none of this course's phrases has nothing to rate.
          rating.count > 0 ? (
            <MiniRating
              rated={
                given
                  ? { grade: given.grade, detail: c.common.phrases(rating.given.length), label: c.music.songRated(c.common.grade[given.grade], rating.given.length) }
                  : null
              }
              onRate={look.live ? (grade) => rateSong(song, rating, grade) : undefined}
              onUndo={look.live ? () => actions.unratePhrases(song.id) : undefined}
            />
          ) : null
        }
        progress={<MiniProgress share={look.share} />}
      />
    );
  };

  const neighbour = (side: Side): MiniItem | null => {
    const song = queue[index + side];
    return song ? { key: `${index + side}:${song.id}`, card: card(song, { playing: true, share: 0, live: false }) } : null;
  };

  return (
    <MiniCarousel
      item={{
        key: `${index}:${music.song.id}`,
        card: card(music.song, { playing: music.playing, share: music.duration > 0 ? music.position / music.duration : 0, live: true }),
      }}
      position={index}
      queue={music.album?.id ?? ''}
      can={{ next: !atEnd, previous: index > 0 }}
      neighbour={neighbour}
      onSwipe={(side) => music.skip(side)}
      held={null}
    />
  );
}
