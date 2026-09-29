import { useLocalSearchParams } from 'expo-router';
import { AlbumScreen } from '../../../src/screens/AlbumScreen';

export default function Album() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AlbumScreen key={id} id={id} />;
}
