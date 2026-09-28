import { useLocalSearchParams } from 'expo-router';
import { parseRoute } from '@shared/nav/routes';
import { LibraryScreen } from '../../src/screens/LibraryScreen';

export default function Library() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  const route = parseRoute(`#/library${view ? `?view=${encodeURIComponent(view)}` : ''}`);
  return <LibraryScreen view={route.name === 'library' ? route.view : undefined} />;
}
