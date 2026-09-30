// Albums, in Library (plan 107; the Music tab of plan 106): Loro's album of every set sung, the
// learner's own and the ones they saved, and what others have shared in this course, with search and
// order. Songs live in their sets and play in the one player; albums group them.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { unreachable } from '@shared/api/client';
import { fetchCommunityAlbums, type CommunitySort } from '@shared/api/library';
import { Album, albumsForCourse } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { AlbumCard } from '../music/AlbumCard';
import { LikedSongs } from '../music/LikedSongs';
import { useCopy, useStore } from '../state/store';
import { Button, Chip } from '../ui/Button';
import { field, placeholderColor } from '../ui/field';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Txt';
import { colors, radius } from '../ui/theme';

export function AlbumsView() {
  const c = useCopy();
  const nav = useNav();
  const { width } = useWindowDimensions();
  const { state } = useStore();
  const target = state.learner.profile.targetLang;
  const albums = albumsForCourse(target);
  const loro = albums.filter((a) => a.owner === 'loro');
  const mine = albums.filter((a) => a.owner === 'me');
  const saved = albums.filter((a) => a.owner === 'other' && a.saved);
  const [community, setCommunity] = useState<Album[] | null>(null);
  // Why the list couldn't load: no connection, or the server failed (either way no endless spinner).
  const [problem, setProblem] = useState<'offline' | 'failed' | null>(null);
  const [query, setQuery] = useState('');
  // The search last sent and the order: refetched on focus, so both stay put across visits.
  const [searched, setSearched] = useState('');
  const [sort, setSort] = useState<CommunitySort>('new');

  useFocusEffect(
    useCallback(() => {
      let live = true;
      fetchCommunityAlbums(target, searched, sort)
        .then((reply) => {
          if (!live) return;
          setCommunity(reply.albums.filter((a) => a.owner !== 'me'));
          setProblem(null);
        })
        .catch((error: unknown) => live && setProblem(unreachable(error) ? 'offline' : 'failed'));
      return () => {
        live = false;
      };
    }, [target, searched, sort]),
  );

  const search = () => {
    const next = query.trim();
    if (next === searched) return;
    setCommunity(null);
    setSearched(next);
  };
  const order = (next: CommunitySort) => {
    if (next === sort) return;
    setCommunity(null);
    setSort(next);
  };

  const card = Math.min(170, Math.max(128, (Math.min(width, 1024) - 48) / 2.3));

  return (
    <View style={styles.stack}>
      <Button variant="tonal" icon="music_note" label={c.music.makeSong} onPress={() => nav.makeSong()} style={styles.make} />
      <LikedSongs />
      <Shelf title={c.music.loro} albums={loro} width={card} empty={c.music.empty} />
      {mine.length > 0 && <Shelf title={c.music.yours} albums={mine} width={card} />}
      {saved.length > 0 && <Shelf title={c.music.saved} albums={saved} width={card} />}
      <Shelf
        title={c.community.albums}
        icon="groups"
        albums={community ?? []}
        width={card}
        loading={community === null && !problem}
        empty={problem === 'offline' ? c.community.offline : problem ? c.account.errors.generic : searched ? c.community.noAlbumsFound(searched) : c.community.emptyAlbums}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          onBlur={search}
          accessibilityLabel={c.community.searchAlbums}
          placeholder={c.community.searchAlbums}
          placeholderTextColor={placeholderColor}
          returnKeyType="search"
          style={field}
        />
        <View style={styles.sort} accessibilityRole="radiogroup" accessibilityLabel={c.community.sortLabel}>
          <Chip label={c.community.sortNew} selected={sort === 'new'} onPress={() => order('new')} />
          <Chip label={c.community.sortPopular} selected={sort === 'popular'} onPress={() => order('popular')} />
        </View>
      </Shelf>
    </View>
  );
}

function Shelf({ title, albums, width, empty, icon, loading = false, children }: { title: string; albums: Album[]; width: number; empty?: string; icon?: 'groups'; loading?: boolean; children?: React.ReactNode }) {
  const nav = useNav();
  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHead}>
        {icon && <Icon name={icon} size="md" color="primaryContainer" />}
        <Txt variant="heading" face="serif" weight={600} accessibilityRole="header">
          {title}
        </Txt>
      </View>
      {children}
      {loading ? (
        <ActivityIndicator color={colors.primaryContainer} style={styles.loading} />
      ) : albums.length === 0 && empty ? (
        <Txt variant="body" color="secondary" style={styles.empty}>
          {empty}
        </Txt>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} width={width} onOpen={() => nav.openAlbum(album.id)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 20 },
  make: { alignSelf: 'flex-start' },
  shelf: { gap: 10 },
  shelfHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sort: { flexDirection: 'row', gap: 8 },
  row: { gap: 14 },
  loading: { alignSelf: 'flex-start' },
  empty: { padding: 16, borderRadius: radius['2xl'], backgroundColor: colors.surfaceContainer },
});
