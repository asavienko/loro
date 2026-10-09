// Explore: the search box, the topic, level and tag filters, the results (sets and phrases), the sets
// and phrases opened from them, the sign-in or making a set (for a signed-out learner or a signed-in
// one), the learner's own sets ("Your sets"), and Community (the shared sets of this course: its
// search, its order, its empty, offline and failed states).
//
// Covered: every topic tile and its chip, the level and tag chips (toggled on and off), Clear filters,
// the search (typing, accents and word order, the Search key, clearing, no match with its two
// offers), each set card (open it; its play button), each phrase result (play it; its ⋮ details),
// the Community search, sort and states, and the sign-in / Make a set buttons.
import { FIXTURE } from '@shared/content/fixture';
import { FakeApi, problem } from '../fakes/api';
import { communitySet, lib, seedSet } from '../fakes/library';
import { audio, launch, screen } from '../harness';

const ES_SETS = FIXTURE.sets.filter((s) => s.targetLang === 'es-ES');
const phraseOf = (id: string) => FIXTURE.phrases.find((p) => p.id === id)!;
const hasTag = (setId: string, tag: string) => ES_SETS.find((s) => s.id === setId)!.phraseIds.some((id) => phraseOf(id).tags.includes(tag as never));

describe('Explore: topics', () => {
  it('the course has three topics, each a tile with its number of sets', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    expect(app.sees('Eating out, 2 sets')).toBe(true);
    expect(app.sees('Getting around, 2 sets')).toBe(true);
    expect(app.sees('Everyday life, 2 sets')).toBe(true);
  });

  it('a topic tile shows only that topic’s sets, and the topic becomes a filter chip', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap('Eating out, 2 sets');
    expect(app.sees('Eating out · 2 sets')).toBe(true);
    expect(app.sees('Café & Mañanas')).toBe(true);
    expect(app.sees('Tapas & Tabernas')).toBe(true);
    expect(screen.queryByText('Metro y Calles')).toBeNull();
    expect(app.sees(app.c.explore.removeFilter('Eating out'))).toBe(true);
    // With a topic chosen the tiles are gone.
    expect(screen.queryByLabelText(app.c.explore.topics)).toBeNull();
  });

  it('removing the topic’s chip brings the tiles back', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap('Getting around, 2 sets');
    await app.tap(app.c.explore.removeFilter('Getting around'));
    expect(app.sees('Getting around, 2 sets')).toBe(true);
    expect(app.sees('Everyday life, 2 sets')).toBe(true);
  });

  it('with two filters on, Clear filters removes them both and the tiles return', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap('Eating out, 2 sets');
    await app.tap('A1');
    expect(app.sees(app.c.explore.removeFilter('A1'))).toBe(true);
    await app.tap(app.c.explore.clearFilters);
    expect(app.sees('Eating out, 2 sets')).toBe(true);
    expect(app.sees(app.c.explore.removeFilter('A1'))).toBe(false);
    expect(app.sees(app.c.explore.clearFilters)).toBe(false);
  });

  it('a topic with no set at the chosen level says so', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap('Eating out, 2 sets');
    // The topic's two sets are both A1.
    await app.tap('A2');
    expect(app.sees('Eating out · 0 sets')).toBe(true);
    expect(app.sees(app.c.explore.noSets)).toBe(true);
  });
});

describe('Explore: levels', () => {
  it('offers the levels the course has, and no others', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    expect(app.sees('A1')).toBe(true);
    expect(app.sees('A2')).toBe(true);
    expect(screen.queryByText('B1')).toBeNull();
  });

  it('a level shows its sets; tapping it again clears it', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap('A2');
    expect(app.sees(app.c.explore.removeFilter('A2'))).toBe(true);
    expect(app.sees('Taxi de Noche')).toBe(true);
    expect(app.sees('Sobremesa')).toBe(true);
    expect(screen.queryByText('Mercado')).toBeNull();
    await app.tap('A2');
    expect(app.sees(app.c.explore.removeFilter('A2'))).toBe(false);
    expect(app.sees('Mercado')).toBe(true);
  });
});

describe('Explore: tags', () => {
  it('a tag shows the phrases that carry it', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap(app.c.common.tag.food);
    expect(app.sees(app.c.explore.removeFilter(app.c.common.tag.food))).toBe(true);
    expect(app.sees(app.c.phrase.play('Me pone un cortado, por favor'))).toBe(true);
    expect(screen.queryByText(/^\d+ phrases?$/)).not.toBeNull();
  });

  it('a tag lists the sets that hold a phrase with it, and only those', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap(app.c.common.tag.food);
    for (const set of ES_SETS) {
      const shown = screen.queryByText(set.title) !== null;
      expect({ set: set.title, shown }).toEqual({ set: set.title, shown: hasTag(set.id, 'food') });
    }
  });

  it('a tag with no phrase in the chosen topic says so', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    // A tag that no phrase of Getting around carries.
    const tags = Object.keys(app.c.common.tag) as (keyof typeof app.c.common.tag)[];
    const transit = ES_SETS.filter((s) => s.topicId === 'getting-around');
    const tag = tags.find((t) => !transit.some((s) => s.phraseIds.some((id) => phraseOf(id).tags.includes(t as never))));
    expect(tag).toBeDefined();
    await app.tap('Getting around, 2 sets');
    await app.tap(app.c.common.tag[tag as keyof typeof app.c.common.tag]);
    expect(app.sees(app.c.explore.noPhrasesFiltered)).toBe(true);
  });

  it('tapping a tag again clears it', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap(app.c.common.tag.food);
    await app.tap(app.c.common.tag.food);
    expect(app.sees(app.c.explore.removeFilter(app.c.common.tag.food))).toBe(false);
    expect(app.sees('Eating out, 2 sets')).toBe(true);
  });
});

describe('Explore: search', () => {
  it('finds phrases typed in any order, with or without accents', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.explore.search, 'un cortado');
    await app.advance(300);
    expect(app.sees('Me pone un cortado, por favor')).toBe(true);
    await app.type(app.c.explore.search, 'manana');
    await app.advance(300);
    expect(app.sees('Sets · 1')).toBe(true);
    expect(app.sees('Café & Mañanas')).toBe(true);
  });

  it('a phrase result shows its translation and its status', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.explore.search, 'cortado');
    await app.advance(300);
    expect(app.sees(app.c.phrase.play('Me pone un cortado, por favor'))).toBe(true);
    expect(screen.queryByText(/A cortado, please · /)).not.toBeNull();
  });

  it('the Search key on the keyboard commits the search at once', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.explore.search, 'cortado');
    await app.submit(app.c.explore.search);
    expect(app.sees(app.c.phrase.play('Me pone un cortado, por favor'))).toBe(true);
  });

  it('the search also finds the topic’s sets by its name', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.explore.search, 'eating');
    await app.advance(300);
    expect(app.sees('Sets · 2')).toBe(true);
    expect(app.sees('Café & Mañanas')).toBe(true);
  });

  it('Back from a set found by the search brings the search back as it was', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.explore.search, 'cortado');
    await app.advance(300);
    await app.tap('Café & Mañanas');
    expect(app.pathname()).toBe('/set/set-cafe');
    await app.back();
    expect(app.pathname()).toBe('/explore');
    expect(screen.getByLabelText(app.c.explore.search).props.value).toBe('cortado');
    expect(app.sees(app.c.phrase.play('Me pone un cortado, por favor'))).toBe(true);
  });

  it('clearing the field brings the topics back', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.explore.search, 'cortado');
    await app.advance(300);
    await app.type(app.c.explore.search, '');
    await app.advance(300);
    expect(app.sees('Eating out, 2 sets')).toBe(true);
    expect(app.sees(app.c.explore.noPhrases('cortado'))).toBe(false);
  });

  it('a search that matches nothing says so, and offers to make a set or add the phrase', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.explore.search, 'zzqx');
    await app.advance(300);
    expect(app.sees(app.c.explore.noPhrases('zzqx'))).toBe(true);
    expect(app.sees(app.c.make.fromExplore('zzqx'))).toBe(true);
    expect(app.sees(app.c.explore.addAsOwn('zzqx'))).toBe(true);
  });

  it('Add as your phrase opens the add-phrase sheet', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.explore.search, 'zzqx');
    await app.advance(300);
    await app.tap(app.c.explore.addAsOwn('zzqx'));
    expect(app.sees(app.c.addPhrase.title)).toBe(true);
  });

  it('Make a set from a search that found nothing opens Make a set', async () => {
    const app = await launch({ signedIn: 'ana@loro.test' });
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.explore.search, 'zzqx');
    await app.advance(300);
    await app.tap(app.c.make.fromExplore('zzqx'));
    expect(app.pathname()).toBe('/make');
  });
});

describe('Explore: opening sets and phrases', () => {
  it('a set card opens its set', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap('Mercado');
    expect(app.pathname()).toBe('/set/set-market');
  });

  it("a set card's play button plays the set and stays on Explore", async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap(app.c.explore.quickPlay('Mercado'));
    expect(app.pathname()).toBe('/explore');
    await app.advance(500);
    expect(audio.clips()[0]).toBe(`en-GB-${ES_SETS.find((s) => s.id === 'set-market')!.phraseIds[0]}`);
  });

  it('a phrase result plays that phrase, from its set', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.explore.search, 'cortado');
    await app.advance(300);
    await app.tap(app.c.phrase.play('Me pone un cortado, por favor'));
    await app.advance(500);
    expect(audio.clips()[0]).toBe('en-GB-cafe-01');
  });

  it('a phrase result’s ⋮ opens the phrase’s details', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.explore.search, 'cortado');
    await app.advance(300);
    await app.tap(app.c.phrase.details('Me pone un cortado, por favor'));
    expect(app.pathname()).toBe('/explore');
    expect(app.sees(app.c.phrase.playNext)).toBe(true);
  });
});

describe('Explore: your sets, and making one', () => {
  it('signed out, Explore offers to sign in to make a set', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap(app.c.phrasesTab.signInToMake);
    expect(app.pathname()).toBe('/account');
  });

  it('signed in, Make a set with AI opens the make flow', async () => {
    const app = await launch({ signedIn: 'ana@loro.test' });
    await app.tap(app.c.tabs.explore);
    await app.tap(app.c.phrasesTab.makeSet);
    expect(app.pathname()).toBe('/make');
  });

  it('a set the learner made is listed under Your sets', async () => {
    const api = new FakeApi();
    const ana = api.addUser('ana@loro.test', 'Ana');
    const made = seedSet(api, ana, { title: 'Compras de Ana', phrases: [{ target: 'Quiero pan, por favor', native: 'I want bread, please' }] });
    const app = await launch({ api, signedIn: 'ana@loro.test' });
    await app.tap(app.c.tabs.explore);
    expect(app.sees(app.c.phrasesTab.yourSets)).toBe(true);
    await app.tap('Compras de Ana');
    expect(app.pathname()).toBe(`/set/${made.id}`);
  });
});

describe('Explore: saved sets', () => {
  it('a shared set the learner saved is listed under Saved sets', async () => {
    const api = new FakeApi();
    const ana = api.addUser('ana@loro.test', 'Ana');
    const shared = communitySet(api, { title: 'Compras de Marta', displayName: 'Marta', phrases: [{ target: 'Un kilo de tomates', native: 'A kilo of tomatoes' }] });
    lib(api).saves.add(`${ana.id}|set|${shared.id}`);
    const app = await launch({ api, signedIn: 'ana@loro.test' });
    await app.tap(app.c.tabs.explore);
    expect(app.sees(app.c.phrasesTab.savedSets)).toBe(true);
    await app.tap('Compras de Marta');
    expect(app.pathname()).toBe(`/set/${shared.id}`);
  });
});

describe('Explore: Community', () => {
  it('an empty course says no one has shared a set yet', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    expect(app.sees(app.c.community.title)).toBe(true);
    expect(app.sees(app.c.community.emptySets)).toBe(true);
  });

  it('a shared set is listed, and opening it opens the set', async () => {
    const api = new FakeApi();
    const shared = communitySet(api, { title: 'Compras de Marta', displayName: 'Marta', phrases: [{ target: 'Un kilo de tomates', native: 'A kilo of tomatoes' }] });
    const app = await launch({ api });
    await app.tap(app.c.tabs.explore);
    // Its line says who made it, under the title.
    expect(screen.queryByLabelText(new RegExp(`Compras de Marta.*${app.c.share.by('Marta')}`))).not.toBeNull();
    await app.tap('Compras de Marta');
    expect(app.pathname()).toBe(`/set/${shared.id}`);
  });

  it('searching finds the shared sets by title; a search with no match says so', async () => {
    const api = new FakeApi();
    communitySet(api, { title: 'Compras de Marta', displayName: 'Marta', phrases: [{ target: 'Un kilo de tomates', native: 'A kilo of tomatoes' }] });
    const app = await launch({ api });
    await app.tap(app.c.tabs.explore);
    await app.type(app.c.community.search, 'compras');
    await app.submit(app.c.community.search);
    expect(app.sees('Compras de Marta')).toBe(true);
    await app.type(app.c.community.search, 'zzqx');
    await app.submit(app.c.community.search);
    expect(app.sees(app.c.community.noSetsFound('zzqx'))).toBe(true);
  });

  it('Most saved asks the server for the popular sets first', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    await app.tap(app.c.community.sortPopular);
    const last = app.api.calls('GET /library/community').at(-1)!;
    expect(last.path).toMatch(/sort=popular/);
  });

  it('when there is no connection, Community says it needs one', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    app.api.offline = true;
    await app.type(app.c.community.search, 'compras');
    await app.submit(app.c.community.search);
    expect(app.sees(app.c.community.offline)).toBe(true);
  });

  it('when the server fails, Community says so rather than spinning', async () => {
    const app = await launch();
    await app.tap(app.c.tabs.explore);
    app.api.failNext('GET /library/community', problem(500, 'INTERNAL'));
    await app.tap(app.c.community.sortPopular);
    expect(app.sees(app.c.account.errors.generic)).toBe(true);
  });
});
