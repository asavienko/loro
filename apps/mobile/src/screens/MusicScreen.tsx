// The Music tab (plan 106): songs sung from phrase sets, kept apart from the phrase side by the night
// palette. Loro's album of every set sung, the learner's own albums and the ones they saved, and
// what others have shared in this course. Making a song starts here.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { unreachable } from '@shared/api/client';
import { fetchCommunityAlbums, type CommunitySort } from '@shared/api/library';
import { Album, albumsForCourse } from '@shared/content';
import { useNav } from '@shared/nav/NavContext';
import { AlbumCard } from '../music/AlbumCard';
import { NightStatusBar } from '../music/NightStatusBar';
import { useStore, useCopy } from '../state/store';
import { Button, Chip } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { field } from '../ui/field';
import { Txt } from '../ui/Txt';
import { colors, radius, TARGET } from '../ui/theme';

export function MusicScreen() {
  const c = useCopy();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state } = useStore();
  const target = state.learner.profile.targetLang;
  const albums = albumsForCourse(target);
  const loro = albums.filter((a) => a.owner === 'loro');
  const mine = albums.filter((a) => a.owner === 'me');
  const saved = albums.filter((a) => a.owner === 'other' && a.saved);
  const [community, setCommunity] = useState<Album[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState('');
  // The search last sent: refetched with the tab's focus, so a search stays put across visits.
  const [searched, setSearched] = useState('');
  const [sort, setSort] = useState<CommunitySort>('new');

  useFocusEffect(
    useCallback(() => {
      let live = true;
      fetchCommunityAlbums(target, searched, sort)
        .then((reply) => {
          if (!live) return;
          setCommunity(reply.albums.filter((a) => a.owner !== 'me'));
          setOffline(false);
        })
        .catch((error: unknown) => live && setOffline(unreachable(error)));
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

  const card = Math.min(180, Math.max(132, (Math.min(width, 1024) - 56) / 2.3));

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <NightStatusBar />
      <View style={styles.head}>
        <Txt variant="display" face="serif" weight={600} color="onNight" accessibilityRole="header" style={{ flex: 1 }}>
          {c.music.title}
        </Txt>
        <Button variant="icon" icon="person" color="onNight" accessibilityLabel={c.settings.title} onPress={nav.openSettings} />
      </View>
      <Button variant="primary" icon="music_note" label={c.music.makeSong} onPress={() => nav.makeSong()} style={styles.make} />

      <Shelf title={c.music.loro} albums={loro} width={card} empty={c.music.empty} />
      {mine.length > 0 && <Shelf title={c.music.yours} albums={mine} width={card} />}
      {saved.length > 0 && <Shelf title={c.music.saved} albums={saved} width={card} />}
      <Shelf
        title={c.community.albums}
        icon="groups"
        albums={community ?? []}
        width={card}
        loading={community === null && !offline}
        empty={offline ? c.community.offline : searched ? c.community.noAlbumsFound(searched) : c.community.emptyAlbums}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          onBlur={search}
          accessibilityLabel={c.community.searchAlbums}
          placeholder={c.community.searchAlbums}
          placeholderTextColor={colors.onNightVariant}
          returnKeyType="search"
          style={[field, styles.search]}
        />
        <View style={styles.sort} accessibilityRole="radiogroup" accessibilityLabel={c.community.sortLabel}>
          <Chip tone="night" label={c.community.sortNew} selected={sort === 'new'} onPress={() => order('new')} />
          <Chip tone="night" label={c.community.sortPopular} selected={sort === 'popular'} onPress={() => order('popular')} />
        </View>
      </Shelf>
    </ScrollView>
  );
}

function Shelf({ title, albums, width, empty, icon, loading = false, children }: { title: string; albums: Album[]; width: number; empty?: string; icon?: 'groups'; loading?: boolean; children?: React.ReactNode }) {
  const nav = useNav();
  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHead}>
        {icon && <Icon name={icon} size="md" color="nightAccent" />}
        <Txt variant="heading" face="serif" weight={600} color="onNight" accessibilityRole="header">
          {title}
        </Txt>
      </View>
      {children}
      {loading ? (
        <ActivityIndicator color={colors.nightAccent} style={styles.loading} />
      ) : albums.length === 0 && empty ? (
        <Txt variant="body" color="onNightVariant" style={styles.empty}>
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
  page: { flex: 1, backgroundColor: colors.night },
  content: { paddingBottom: 48, width: '100%', maxWidth: 1024, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, minHeight: TARGET },
  make: { alignSelf: 'flex-start', marginHorizontal: 20, marginTop: 12 },
  shelf: { paddingTop: 28, gap: 12 },
  shelfHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  row: { paddingHorizontal: 20, gap: 14 },
  loading: { alignSelf: 'flex-start', marginHorizontal: 20 },
  // On night: the edge is onNightVariant (5:1 against the field) so the box is findable.
  sort: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  search: { marginHorizontal: 20, backgroundColor: colors.nightContainer, borderColor: colors.onNightVariant, color: colors.onNight },
  empty: { paddingHorizontal: 20, padding: 16, marginHorizontal: 20, borderRadius: radius['2xl'], backgroundColor: colors.nightContainer },
});
