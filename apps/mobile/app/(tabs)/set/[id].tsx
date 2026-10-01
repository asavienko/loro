import { useLocalSearchParams } from 'expo-router';
import { LIKED_ID } from '@shared/state/selectors';
import { LikedSetScreen } from '../../../src/screens/LikedSetScreen';
import { SetScreen } from '../../../src/screens/SetScreen';

export default function SetPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Every learner's "Liked phrases" is made of their likes, not a set of the pack.
  if (id === LIKED_ID) return <LikedSetScreen />;
  return <SetScreen key={id} setId={id} />;
}
