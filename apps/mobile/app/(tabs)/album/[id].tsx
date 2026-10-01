import { useLocalSearchParams } from 'expo-router';
import { LIKED_ID } from '@shared/state/selectors';
import { LikedAlbumScreen } from '../../../src/music/LikedAlbumScreen';
import { AlbumScreen } from '../../../src/screens/AlbumScreen';

export default function Album() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Every learner's "Liked songs" is made of their likes, not an album of the server's.
  if (id === LIKED_ID) return <LikedAlbumScreen />;
  return <AlbumScreen key={id} id={id} />;
}
