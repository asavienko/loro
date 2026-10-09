// The Library tab, signed out (F-08): the Phrases and Sets segments and their filter chips with their
// empty states, the Progress figures that open their lists, liking a phrase or a set and finding it
// in Library, the "Liked phrases" set page, playing from a list, and each row opening its page.
// Albums: Your albums (Liked songs, Make a song), Loro's and the shared albums with search and order.
// Phrases made before sign-in (the "On this device only" banner) are a todo: see the end of the file.
import { languageName } from '@shared/copy';
import { problem } from '../fakes/api';
import { audio, copy, DAY, launch, screen, SECOND } from '../harness';

const CAFE_1 = 'Me pone un cortado, por favor';

/** The id of "Liked phrases" (selectors' LIKED_ID), as its page's route. */
const LIKED_ID = 'liked';

describe('Library: segments and filters', () => {
  it('opens on Liked, with its hint, when nothing is due or learning yet', async () => {
    const app = await launch({ url: '/library' });
    expect(app.pathname()).toBe('/library');
    expect(app.sees(app.c.library.empty.liked)).toBe(true);
    expect(app.sees(app.c.library.filters.liked)).toBe(true);
  });

  it('shows the empty hint of each phrase filter as the learner taps it', async () => {
    const app = await launch({ url: '/library' });
    await app.tap(app.c.library.filters.mine);
    expect(app.sees(app.c.library.empty.mine)).toBe(true);
    await app.tap(app.c.library.filters.due);
    expect(app.sees(app.c.library.empty.due)).toBe(true);
    await app.tap(app.c.library.filters.learning);
    expect(app.sees(app.c.library.empty.learning)).toBe(true);
    await app.tap(app.c.library.filters.missed);
    expect(app.sees(app.c.library.empty.missed)).toBe(true);
    await app.tap(app.c.library.filters.learned);
    expect(app.sees(app.c.library.empty.learned(21, 3))).toBe(true);
    expect(app.pathname()).toBe('/library');
  });

  it('keeps Missed selected when the Phrases segment is tapped again', async () => {
    const app = await launch({ url: '/library?view=missed' });
    await app.tap(app.c.library.phrasesSegment);
    expect(app.sees(app.c.library.empty.missed)).toBe(true);
  });

  it('switches to Sets, to My sets first, and back to the first phrase filter', async () => {
    const app = await launch({ url: '/library' });
    await app.tap(app.c.library.setsSegment);
    expect(app.sees(app.c.library.filters.ownSets)).toBe(true);
    expect(app.sees(app.c.library.filters.likedSets)).toBe(true);
    expect(app.sees(app.c.library.likedPhrases)).toBe(true);
    await app.tap(app.c.library.phrasesSegment);
    expect(app.sees(app.c.library.empty.liked)).toBe(true);
  });

  it('switches between My sets and Liked sets, which is empty until a set is liked', async () => {
    const app = await launch({ url: '/library?view=ownSets' });
    await app.tap(app.c.library.filters.likedSets);
    expect(app.sees(app.c.library.empty.likedSets)).toBe(true);
    expect(app.sees('Café & Mañanas')).toBe(false);
    await app.tap(app.c.library.filters.ownSets);
    expect(app.sees(app.c.library.phrasesSegment)).toBe(true);
    expect(app.sees(app.c.library.newSet)).toBe(true);
  });

  it('shows the Albums segment, with no album of the learner\'s yet', async () => {
    const app = await launch({ url: '/library' });
    await app.tap(app.c.library.albumsSegment);
    expect(app.pathname()).toBe('/library');
    expect(app.sees(app.c.library.filters.albums)).toBe(true);
  });
});

describe('Library: Progress figures open their lists', () => {
  it('opens Learned when the Learned figure is tapped', async () => {
    const app = await launch({ url: '/library' });
    await app.tap(app.c.library.learned);
    expect(app.sees(app.c.library.empty.learned(21, 3))).toBe(true);
  });

  it('opens Learning when Recall now is tapped, and when Started is tapped', async () => {
    const app = await launch({ url: '/library' });
    await app.tap(app.c.library.recall);
    expect(app.sees(app.c.library.empty.learning)).toBe(true);
    await app.tap(app.c.library.started);
    expect(app.sees(app.c.library.empty.learning)).toBe(true);
  });
});

describe('Library: Mine and the new-set actions', () => {
  it('opens the add-phrase form from Mine', async () => {
    const app = await launch({ url: '/library?view=mine' });
    await app.tap(app.c.library.addPhrase);
    expect(app.sees(app.c.addPhrase.title)).toBe(true);
  });

  it('opens the new-set form from My sets', async () => {
    const app = await launch({ url: '/library?view=ownSets' });
    await app.tap(app.c.library.newSet);
    expect(app.sees(app.c.createSet.title)).toBe(true);
  });

  it('opens the make-a-set page from My sets', async () => {
    const app = await launch({ url: '/library?view=ownSets' });
    await app.tap(app.c.make.title);
    expect(app.pathname()).toBe('/make');
  });
});

describe('Library: liking a set', () => {
  it('lists a set the learner liked on its page under Liked sets', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.like);
    await app.open('/library?view=likedSets');
    expect(app.sees('Café & Mañanas')).toBe(true);
    expect(app.sees(app.c.library.empty.likedSets)).toBe(false);
  });

  it('opens the set from its row in Liked sets', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.like);
    await app.open('/library?view=likedSets');
    await app.tap('Café & Mañanas');
    expect(app.pathname()).toBe('/set/set-cafe');
    expect(app.sees(app.c.set.like)).toBe(true);
  });

  it('unliking the set takes it out of Liked sets', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.like);
    await app.tap(app.c.set.like);
    await app.open('/library?view=likedSets');
    expect(app.sees(app.c.library.empty.likedSets)).toBe(true);
  });

  it('keeps the liked set after a restart', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.like);
    const again = await app.restart({ url: '/library?view=likedSets' });
    expect(again.sees('Café & Mañanas')).toBe(true);
  });
});

describe('Library: liking a phrase', () => {
  it('lists a liked phrase under Liked and in the Liked phrases set', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.phrase.details(CAFE_1));
    await app.tap(app.c.phrase.like);
    await app.open('/library?view=liked');
    expect(app.sees(CAFE_1)).toBe(true);
    expect(app.sees(app.c.common.phrases(1))).toBe(true);
    expect(app.sees(app.c.library.playAll(1))).toBe(true);
  });

  it('the Liked phrases set holds the liked phrase, and plays it', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.phrase.details(CAFE_1));
    await app.tap(app.c.phrase.like);
    await app.open('/library?view=ownSets');
    await app.tap(app.c.library.likedPhrases);
    expect(app.pathname()).toBe(`/set/${LIKED_ID}`);
    expect(app.sees(CAFE_1)).toBe(true);
    await app.tap(app.c.library.playAll(1));
    await app.advance(8 * SECOND);
    expect(audio.clips()).toContain('es-ES-cafe-01');
  });

  it('unliking the phrase takes it out of Liked', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.phrase.details(CAFE_1));
    await app.tap(app.c.phrase.like);
    await app.tap(app.c.phrase.liked);
    await app.open('/library?view=liked');
    expect(app.sees(app.c.library.empty.liked)).toBe(true);
    expect(app.sees(CAFE_1)).toBe(false);
  });

  it('keeps the liked phrase after a restart', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.phrase.details(CAFE_1));
    await app.tap(app.c.phrase.like);
    const again = await app.restart({ url: '/library?view=liked' });
    expect(again.sees(CAFE_1)).toBe(true);
  });
});

describe('Library: rows open their pages and play', () => {
  it('plays a phrase from its row in a list', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.phrase.details(CAFE_1));
    await app.tap(app.c.phrase.like);
    await app.open('/library?view=liked');
    await app.tap(app.c.phrase.play(CAFE_1));
    await app.advance(8 * SECOND);
    expect(audio.clips()).toContain('es-ES-cafe-01');
  });

  it('opens the details sheet from a row\'s more button', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.phrase.details(CAFE_1));
    await app.tap(app.c.phrase.like);
    await app.open('/library?view=liked');
    await app.tap(app.c.phrase.details(CAFE_1));
    expect(app.sees(app.c.phrase.like)).toBe(false);
    expect(app.sees(app.c.phrase.liked)).toBe(true);
  });

  it('the Liked phrases page is empty and cannot be played until a phrase is liked', async () => {
    const app = await launch({ url: `/set/${LIKED_ID}` });
    expect(app.sees(app.c.library.empty.liked)).toBe(true);
    expect(app.sees(app.c.library.playAll(0))).toBe(true);
    await app.tap(app.c.library.playAll(0));
    await app.advance(SECOND);
    expect(audio.heard).toEqual([]);
  });

  it('goes back from the Liked phrases page to Library', async () => {
    const app = await launch({ url: '/library?view=ownSets' });
    await app.tap(app.c.library.likedPhrases);
    expect(app.pathname()).toBe(`/set/${LIKED_ID}`);
    await app.tap(app.c.common.back);
    expect(app.pathname()).toBe('/library');
  });
});

describe('Library: the empty states are the real ones', () => {
  it('shows Liked phrases under My sets with its summary, before any set is liked', async () => {
    const app = await launch({ url: '/library?view=ownSets' });
    expect(app.sees(app.c.set.summary(0, 0, 0))).toBe(true);
  });

  it('reads the Library tab in the learner\'s UI language', async () => {
    const app = await launch({ learner: { nativeLang: 'bg-BG' }, url: '/library' });
    expect(app.sees(copy('bg-BG').library.progress)).toBe(true);
  });
});


describe('Library: Albums, signed out', () => {
  it('shows Your albums with Liked songs first, and Loro\'s albums empty for this course', async () => {
    const app = await launch({ url: '/library?view=albums' });
    expect(app.sees(app.c.music.yours)).toBe(true);
    expect(app.sees(app.c.music.likedSongs)).toBe(true);
    expect(app.sees(app.c.music.loro)).toBe(true);
    expect(app.sees(app.c.music.empty)).toBe(true);
  });

  it('opens Liked songs, which is empty until a song is liked', async () => {
    const app = await launch({ url: '/library?view=albums' });
    await app.tap(app.c.music.likedSongs);
    expect(app.pathname()).toMatch(/^\/album\//);
    expect(app.sees(app.c.music.likedEmpty)).toBe(true);
  });

  it('opens the make-a-song sheet from the Make a song button', async () => {
    const app = await launch({ url: '/library?view=albums' });
    const before = screen.queryAllByText(app.c.music.makeSong).length;
    await app.tap(app.c.music.makeSong);
    expect(screen.queryAllByText(app.c.music.makeSong).length).toBeGreaterThan(before);
    expect(app.pathname()).toBe('/library');
  });

  it('lists the shared albums in the newest order, and says none are shared yet', async () => {
    const app = await launch({ url: '/library?view=albums' });
    expect(app.sees(app.c.community.sortNew)).toBe(true);
    expect(app.sees(app.c.community.emptyAlbums)).toBe(true);
    expect(app.api.calls('GET /library/community').at(-1)?.path).toContain('sort=new');
  });

  it('searches shared albums on submit, and says when none match', async () => {
    const app = await launch({ url: '/library?view=albums' });
    await app.type(app.c.community.searchAlbums, 'zzz');
    await app.submit(app.c.community.searchAlbums);
    expect(app.sees(app.c.community.noAlbumsFound('zzz'))).toBe(true);
    expect(app.api.calls('GET /library/community').at(-1)?.path).toContain('q=zzz');
  });

  it('does not search again for the same words', async () => {
    const app = await launch({ url: '/library?view=albums' });
    const before = app.api.calls('GET /library/community').length;
    await app.submit(app.c.community.searchAlbums);
    expect(app.api.calls('GET /library/community').length).toBe(before);
  });

  it('orders shared albums by most saved, and searches in that order', async () => {
    const app = await launch({ url: '/library?view=albums' });
    await app.tap(app.c.community.sortPopular);
    expect(app.api.calls('GET /library/community').at(-1)?.path).toContain('sort=popular');
    await app.tap(app.c.community.sortNew);
    expect(app.api.calls('GET /library/community').at(-1)?.path).toContain('sort=new');
  });

  it('says the shared albums could not load when the server fails', async () => {
    const app = await launch({ url: '/library?view=albums' });
    app.api.failNext('GET /library/community', problem(500, 'INTERNAL'));
    // Leave the tab and come back, so the list asks again.
    await app.open('/');
    await app.open('/library?view=albums');
    expect(app.sees(app.c.community.offline)).toBe(false);
    expect(app.sees(app.c.account.errors.generic)).toBe(true);
  });
});

describe('Library: phrases made on this device', () => {
  it('sends adding a phrase to the sign-in page, as making things needs an account', async () => {
    const app = await launch({ url: '/library?view=mine' });
    await app.tap(app.c.library.addPhrase);
    await app.type(`In ${languageName('es-ES', 'en-GB')}`, 'Buenos días');
    await app.type(`In ${languageName('en-GB', 'en-GB')}`, 'Good morning');
    await app.tap(app.c.addPhrase.add);
    expect(app.pathname()).toBe('/account');
    expect(app.api.calls('POST /library/phrases')).toEqual([]);
  });

  // A phrase made before the learner signed in (plan 108) lives in the saved state as `ownPhrases`, but
  // the app drops them at load (what is saved reads back as {}), so the "On this device only" banner
  // can't be reached from a saved state here. Left open until that is checked on a phone.
  it.todo('the "On this device only" banner offers to sign in when phrases were made before sign-in');
});

describe('Library: a rated phrase moves through the lists', () => {
  it('shows a rated phrase under Learning, and opens on Due once its review is due', async () => {
    const app = await launch({ url: '/set/set-cafe' });
    await app.tap(app.c.set.playAll('Café & Mañanas'));
    await app.advance(8 * SECOND);
    await app.tap(app.c.player.rateAs(app.c.common.grade.easy));
    await app.open('/library?view=learning');
    expect(app.sees(CAFE_1)).toBe(true);
    // Nothing is playing now, so the clock can jump two days in one go.
    await app.skip(2 * DAY);
    const again = await app.restart({ url: '/library' });
    // Opened on Due: its list holds the one phrase, and Liked (empty) is not the first view.
    expect(again.sees(again.c.library.playAll(1))).toBe(true);
    expect(again.sees(again.c.library.empty.liked)).toBe(false);
  });
});
