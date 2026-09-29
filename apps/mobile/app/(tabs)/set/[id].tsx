import { useLocalSearchParams } from 'expo-router';
import { SetScreen } from '../../../src/screens/SetScreen';

export default function SetPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SetScreen key={id} setId={id} />;
}
