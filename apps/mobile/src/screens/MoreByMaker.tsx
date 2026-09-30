// More of what a shared set's or album's maker made public (plan 106), on that set's or album's
// page: a set's page offers their sets, an album's their albums.
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { keepOpenedSet } from '@shared/api/contentCache';
import { fetchMoreAlbums, fetchMoreSets } from '@shared/api/library';
import type { Album, PhraseSet, PhraseWire } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { AlbumCard } from '../music/AlbumCard';
import { useCopy } from '../state/store';
import { Txt } from '../ui/Txt';
import { SetLine } from './PhraseShelves';

export function MoreSetsByMaker({ setId, author }: { setId: string; author: string | null }) {
  const c = useCopy();
  const nav = useNav();
  const [found, setFound] = useState<{ sets: PhraseSet[]; phrases: PhraseWire[] } | null>(null);

  useEffect(() => {
    let live = true;
    fetchMoreSets(setId).then(
      (reply) => live && setFound(reply),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [setId]);

  if (!found || found.sets.length === 0) return null;
  const open = (set: PhraseSet) => {
    void keepOpenedSet({ set, phrases: found.phrases.filter((p) => p.setId === set.id) }).then(() => nav.openSet(set.id));
  };
  return (
    <View style={styles.sets}>
      <Txt variant="heading" face="serif" weight={600} accessibilityRole="header">
        {author ? c.community.moreBy(author) : c.community.moreByLearner}
      </Txt>
      {found.sets.map((set) => (
        <SetLine key={set.id} set={set} onPress={() => open(set)} />
      ))}
    </View>
  );
}

export function MoreAlbumsByMaker({ albumId, author }: { albumId: string; author: string | null }) {
  const c = useCopy();
  const nav = useNav();
  const [albums, setAlbums] = useState<Album[] | null>(null);

  useEffect(() => {
    let live = true;
    fetchMoreAlbums(albumId).then(
      (reply) => live && setAlbums(reply.albums),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [albumId]);

  if (!albums || albums.length === 0) return null;
  return (
    <View style={styles.albums}>
      <Txt variant="heading" face="serif" weight={600} color="onSurface" accessibilityRole="header" style={styles.pad}>
        {author ? c.community.moreBy(author) : c.community.moreByLearner}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {albums.map((album) => (
          <AlbumCard key={album.id} album={album} width={140} onOpen={() => nav.openAlbum(album.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sets: { gap: 8, paddingHorizontal: 16, paddingTop: 24 },
  albums: { gap: 12, paddingTop: 28 },
  pad: { paddingHorizontal: 20 },
  row: { paddingHorizontal: 20, gap: 14 },
});
