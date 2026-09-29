import { useLocalSearchParams } from 'expo-router';
import { SharedScreen } from '../../src/screens/SharedScreen';

export default function Shared() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <SharedScreen key={code} code={code} />;
}
