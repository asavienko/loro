// The one player (plan 107): what was started last, a song or the phrase loop. Both open here, from
// the one bar above the tabs.
import { useMusic } from '../music/MusicPlayer';
import { NowPlayingScreen } from './NowPlayingScreen';
import { SongScreen } from './SongScreen';

export function PlayerScreen() {
  const music = useMusic();
  return music.front ? <SongScreen /> : <NowPlayingScreen />;
}
