// The one player (plan 107): what was started last, a song or the phrase loop (a song still loaded
// when no phrase is queued). Both open here, from the one bar above the tabs.
import { currentPhraseId } from '@shared/state/selectors';
import { useMusic } from '../music/MusicPlayer';
import { useStore } from '../state/store';
import { NowPlayingScreen } from './NowPlayingScreen';
import { SongScreen } from './SongScreen';

export function PlayerScreen() {
  const music = useMusic();
  const { state } = useStore();
  const queued = currentPhraseId(state.player) !== null;
  return music.song !== null && (music.front || !queued) ? <SongScreen /> : <NowPlayingScreen />;
}
