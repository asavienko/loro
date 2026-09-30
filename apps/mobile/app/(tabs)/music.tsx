// The Music tab's address (plan 106), kept for links: it opens Library's albums (plan 107).
import { Redirect } from 'expo-router';

export default function Music() {
  return <Redirect href={{ pathname: '/library', params: { view: 'albums' } }} />;
}
