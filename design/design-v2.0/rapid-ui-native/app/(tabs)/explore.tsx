import { useLocalSearchParams } from 'expo-router';
import { parseRoute } from '@shared/nav/routes';
import { ExploreScreen } from '../../src/screens/ExploreScreen';

/** Explore's filters live in the route, as on the web (?q=&topic=&level=&tag=), checked the same way. */
export default function Explore() {
  const params = useLocalSearchParams<{ q?: string; topic?: string; level?: string; tag?: string }>();
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string'));
  const route = parseRoute(`#/explore?${query}`);
  return <ExploreScreen filters={route.name === 'explore' ? route : {}} />;
}
