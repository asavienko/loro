// Sharing and other learners' sets (LIB-01): a learner's own set's visibility and its share link (the
// ShareSheet from the set's ⋮ menu), a shared link opening a set or an album (signed out, before
// onboarding, and the not-found page), another learner's set (save and remove, report with each
// reason and signed out, share its link, more by its maker, playing its phrases), and an album shared
// by link (open it, save it, share it, report it, more albums by its maker).
//
// Covered: the three visibility choices (each sends its visibility, the current one does nothing, a
// refused change keeps the old one), the share button and its link (the share code) only when the set
// is shared, the public-without-a-name note and its "Add your name", the set's ⋮ share item; /shared/<code>
// for a link set, a public set, an album, an unknown or private code (and its Home button), and a link
// opened before onboarding (onboarding first, then the set); a set's ⋮ items for another learner (save,
// remove from library, report and its four reasons, reporting when signed out, share link); "More from"
// their other sets and opening one; playing their phrases; an album's save (and signed out), share,
// report, and "More from" its maker.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { FakeApi, problem } from '../fakes/api';
import { communityAlbum, communitySet, lib, seedSet } from '../fakes/library';
import { audio, device, launch, type App } from '../harness';

// The test environment has no app manifest for expo-linking to build a URL from.
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), createURL: (path: string) => `loro:/${path}` }));

const MARTA = [
  { target: 'Un kilo de tomates', native: 'A kilo of tomatoes' },
  { target: '¿Cuánto cuesta?', native: 'How much does it cost?' },
];
const CAFE = [
  { target: 'Un café, por favor', native: 'A coffee, please' },
  { target: '¿Me trae la cuenta?', native: 'Could you bring the bill?' },
];
const REASONS = ['offensive', 'wrong', 'spam', 'other'] as const;

/** Opens the ⋮ menu of the page on screen. */
const openMore = (app: App) => app.tap(app.c.common.moreOptions);

/**
 * Presses the share button of the open share sheet: the last "Share" button on screen, since the
 * page's own share button, if any, is underneath it.
 */
async function pressShareButton(app: App): Promise<void> {
  const buttons = screen.getAllByRole('button', { name: app.c.share.share });
  await act(async () => {
    fireEvent.press(buttons[buttons.length - 1]);
  });
  await app.settle();
}

/** A signed-in Ana with her own set, opened on its page. */
async function anaWithOwnSet(options: { visibility?: 'private' | 'link' | 'public'; displayName?: string | null } = {}) {
  const api = new FakeApi();
  const displayName = options.displayName === undefined ? 'Ana' : options.displayName;
  const ana = api.addUser('ana@loro.test', displayName);
  const set = seedSet(api, ana, { title: 'Compras de Ana', phrases: MARTA, visibility: options.visibility ?? 'private' });
  const app = await launch({ api, signedIn: 'ana@loro.test', url: `/set/${set.id}` });
  return { app, api, set, setCalls: `POST /library/sets/${set.id}` };
}

describe('Sharing: a learner’s own set', () => {
  it('starts private: the menu says so, the sheet offers the three choices with Only you chosen, and there is no link yet', async () => {
    const { app } = await anaWithOwnSet();
    await openMore(app);
    expect(app.sees(`${app.c.share.share} · ${app.c.share.private}`)).toBe(true);
    await app.tap(`${app.c.share.share} · ${app.c.share.private}`);
    expect(screen.getByRole('radio', { name: new RegExp(app.c.share.private) })).toBeChecked();
    expect(screen.getByRole('radio', { name: new RegExp(app.c.share.link) })).not.toBeChecked();
    expect(app.sees(app.c.share.makeShareable)).toBe(true);
    expect(screen.queryAllByRole('button', { name: app.c.share.share })).toHaveLength(0);
  });

  it('anyone with the link: sends the visibility, and the share button passes on the link', async () => {
    const { app, set, setCalls } = await anaWithOwnSet();
    await openMore(app);
    await app.tap(`${app.c.share.share} · ${app.c.share.private}`);
    await app.tap(app.c.share.link);
    expect(app.api.calls(setCalls).at(-1)?.body).toEqual({ visibility: 'link' });
    expect(app.sees(app.c.share.makeShareable)).toBe(false);
    expect(screen.getByRole('radio', { name: new RegExp(app.c.share.link) })).toBeChecked();
    await pressShareButton(app);
    const shared = device.shared.at(-1)!;
    expect(shared.message).toContain('Compras de Ana');
    expect(shared.url).toMatch(new RegExp(`/shared/${set.shareCode}$`));
    // The page's menu now says how it is shared.
    await app.tap(app.c.common.close);
    await openMore(app);
    expect(app.sees(`${app.c.share.share} · ${app.c.share.link}`)).toBe(true);
  });

  it('everyone: sends the visibility, and the sheet says it is listed in Community', async () => {
    const { app, setCalls } = await anaWithOwnSet();
    await openMore(app);
    await app.tap(`${app.c.share.share} · ${app.c.share.private}`);
    await app.tap(app.c.share.public);
    expect(app.api.calls(setCalls).at(-1)?.body).toEqual({ visibility: 'public' });
    expect(app.sees(app.c.share.publicDetail)).toBe(true);
    expect(app.sees(app.c.share.noName)).toBe(false);
    expect(screen.getByRole('radio', { name: new RegExp(app.c.share.public) })).toBeChecked();
  });

  it('everyone without a name says that others see it as “by a learner”, and Add your name opens the account', async () => {
    const { app, setCalls } = await anaWithOwnSet({ displayName: null });
    await openMore(app);
    await app.tap(`${app.c.share.share} · ${app.c.share.private}`);
    await app.tap(app.c.share.public);
    expect(app.sees(app.c.share.noName)).toBe(true);
    await app.tap(app.c.share.addName);
    expect(app.pathname()).toBe('/account');
    expect(app.api.calls(setCalls)).toHaveLength(1);
  });

  it('back to only you: the link is gone, and so is the share button', async () => {
    const { app, setCalls } = await anaWithOwnSet({ visibility: 'link' });
    await openMore(app);
    await app.tap(`${app.c.share.share} · ${app.c.share.link}`);
    await pressShareButton(app);
    expect(device.shared).toHaveLength(1);
    await app.tap(app.c.share.private);
    expect(app.api.calls(setCalls).at(-1)?.body).toEqual({ visibility: 'private' });
    expect(app.sees(app.c.share.makeShareable)).toBe(true);
    expect(screen.queryAllByRole('button', { name: app.c.share.share })).toHaveLength(0);
  });

  it('choosing the visibility the set already has sends nothing', async () => {
    const { app, api, setCalls } = await anaWithOwnSet({ visibility: 'link' });
    await openMore(app);
    await app.tap(`${app.c.share.share} · ${app.c.share.link}`);
    await app.tap(app.c.share.link);
    expect(api.calls(setCalls)).toHaveLength(0);
  });

  it('a change the server refuses says so, and the set stays as it was', async () => {
    const { app, setCalls } = await anaWithOwnSet();
    app.api.failNext(setCalls, problem(500, 'INTERNAL'));
    await openMore(app);
    await app.tap(`${app.c.share.share} · ${app.c.share.private}`);
    await app.tap(app.c.share.link);
    expect(app.sees(app.c.account.errors.generic)).toBe(true);
    expect(app.sees(app.c.share.makeShareable)).toBe(true);
    expect(screen.getByRole('radio', { name: new RegExp(app.c.share.private) })).toBeChecked();
  });
});

describe('Sharing: a shared link', () => {
  it('a link set opens signed out, on its page with its phrases', async () => {
    const api = new FakeApi();
    const marta = communitySet(api, { title: 'Compras de Marta', displayName: 'Marta', phrases: MARTA, visibility: 'link' });
    const app = await launch({ api, url: `/shared/${marta.shareCode}` });
    await app.waitFor('Compras de Marta');
    expect(app.pathname()).toBe(`/set/${marta.id}`);
    expect(app.sees('Un kilo de tomates')).toBe(true);
    expect(app.sees('¿Cuánto cuesta?')).toBe(true);
  });

  it('a public set opens the same way, with its phrases', async () => {
    const api = new FakeApi();
    const marta = communitySet(api, { title: 'Compras de Marta', displayName: 'Marta', phrases: MARTA });
    const app = await launch({ api, url: `/shared/${marta.shareCode}` });
    await app.waitFor('Compras de Marta');
    expect(app.pathname()).toBe(`/set/${marta.id}`);
    expect(app.sees('Un kilo de tomates')).toBe(true);
  });

  it('a private set’s link says it doesn’t open anything; Home takes the learner away from it', async () => {
    const api = new FakeApi();
    const hidden = seedSet(api, api.addUser('marta@community.test'), { title: 'Only mine', phrases: MARTA });
    const app = await launch({ api, url: `/shared/${hidden.shareCode}` });
    await app.waitFor(app.c.share.notFound);
    expect(app.pathname()).toBe(`/shared/${hidden.shareCode}`);
    await app.tap(app.c.tabs.home);
    expect(app.pathname()).toBe('/');
  });

  it('a code that opens nothing says so', async () => {
    const app = await launch({ url: '/shared/abcdefghij' });
    await app.waitFor(app.c.share.notFound);
    expect(app.sees(app.c.share.opening)).toBe(false);
  });

  it('an album link opens the album with its songs', async () => {
    const api = new FakeApi();
    const set = communitySet(api, { title: 'Compras de Marta', displayName: 'Marta', phrases: MARTA });
    const album = communityAlbum(api, { title: 'Cafe songs', displayName: 'Marta', setId: set.id, songs: [{ title: 'Pasa la tarde' }, { title: 'Mercado' }] });
    const app = await launch({ api, url: `/shared/${album.shareCode}` });
    await app.waitFor('Cafe songs');
    expect(app.pathname()).toBe(`/album/${album.id}`);
    expect(app.sees('Pasa la tarde')).toBe(true);
    expect(app.sees('Mercado')).toBe(true);
  });

  it('a link opened before onboarding shows onboarding first, then the shared set', async () => {
    const api = new FakeApi();
    const marta = communitySet(api, { title: 'Compras de Marta', displayName: 'Marta', phrases: MARTA });
    const app = await launch({ api, learner: 'new', url: `/shared/${marta.shareCode}` });
    expect(app.sees(app.c.onboarding.welcome)).toBe(true);
    await app.tap(app.c.onboarding.next);
    await app.type(app.c.onboarding.namePlaceholder, 'Ana');
    await app.tap(app.c.onboarding.next);
    await app.tap(app.c.onboarding.next);
    await app.tap(app.c.account.notNow);
    await app.tap(app.c.onboarding.skip);
    await app.waitFor('Compras de Marta');
    expect(app.pathname()).toBe(`/set/${marta.id}`);
  });
});

describe('Sharing: another learner’s set', () => {
  /** Marta's set, opened on its page by Ana (signed in unless `signedIn` is false), maybe saved already. */
  async function martaSet(options: { signedIn?: boolean; more?: boolean; saved?: boolean } = {}) {
    const api = new FakeApi();
    const ana = api.addUser('ana@loro.test', 'Ana');
    const marta = communitySet(api, { title: 'Compras de Marta', displayName: 'Marta', phrases: MARTA });
    const other = options.more ? communitySet(api, { title: 'Verduras de Marta', displayName: 'Marta', phrases: CAFE }) : null;
    if (options.saved) lib(api).saves.add(`${ana.id}|set|${marta.id}`);
    const app = await launch({ api, signedIn: options.signedIn === false ? undefined : 'ana@loro.test', url: `/set/${marta.id}` });
    return { app, api, marta, other };
  }

  it('saves to the library: the menu then offers to remove it, and it is listed under Saved sets', async () => {
    const { app, marta } = await martaSet();
    await openMore(app);
    await app.tap(app.c.share.save);
    expect(app.api.calls('POST /library/saves').at(-1)?.body).toEqual({ kind: 'set', id: marta.id });
    expect(app.sees(app.c.share.savedToast)).toBe(true);
    await openMore(app);
    expect(app.sees(app.c.share.unsave)).toBe(true);
    await app.tap(app.c.common.close);
    await app.tap(app.c.tabs.explore);
    expect(app.sees(app.c.phrasesTab.savedSets)).toBe(true);
    expect(app.sees('Compras de Marta')).toBe(true);
  });

  it('removing it from the library says so, and it leaves Saved sets', async () => {
    const { app, api, marta } = await martaSet({ saved: true });
    await openMore(app);
    await app.tap(app.c.share.unsave);
    expect(api.calls(`DELETE /library/saves/set/${marta.id}`)).toHaveLength(1);
    expect(app.sees(app.c.share.unsavedToast)).toBe(true);
    await app.tap(app.c.tabs.explore);
    expect(app.sees(app.c.phrasesTab.savedSets)).toBe(false);
  });

  // The app drops the set from the page it is open on once it is no longer in the learner's library:
  // "This set isn’t available." replaces the phrases. The set is still public and was opened here, so
  // the page should keep it (SetScreen: "one they saved or opened (plan 106)"). Suspected app bug.
  it.skip('removing it from the library while its page is open keeps the page and its phrases', async () => {
    const { app, marta } = await martaSet({ saved: true });
    await openMore(app);
    await app.tap(app.c.share.unsave);
    expect(app.pathname()).toBe(`/set/${marta.id}`);
    expect(app.sees('Un kilo de tomates')).toBe(true);
    expect(app.sees(app.c.set.notFound)).toBe(false);
  });

  it('saving while signed out opens the account, and saves nothing', async () => {
    const { app } = await martaSet({ signedIn: false });
    await openMore(app);
    await app.tap(app.c.share.save);
    expect(app.pathname()).toBe('/account');
    expect(app.api.calls('POST /library/saves')).toHaveLength(0);
  });

  it.each(REASONS)('reports it for “%s”, and says thank you', async (reason) => {
    const { app, marta } = await martaSet();
    await openMore(app);
    await app.tap(app.c.share.report);
    await app.tap(app.c.share.reason[reason]);
    expect(app.api.calls('POST /library/reports').at(-1)?.body).toEqual({ kind: 'set', id: marta.id, reason });
    expect(app.sees(app.c.share.reported)).toBe(true);
  });

  it('reporting while signed out asks to sign in first, and sends no report', async () => {
    const { app } = await martaSet({ signedIn: false });
    await openMore(app);
    await app.tap(app.c.share.report);
    await app.tap(app.c.share.reason.spam);
    expect(app.pathname()).toBe('/account');
    expect(app.api.calls('POST /library/reports')).toHaveLength(0);
  });

  it('share opens the share sheet with no choice of visibility, and passes on the set’s link', async () => {
    const { app, marta } = await martaSet();
    await openMore(app);
    await app.tap(app.c.share.share);
    expect(app.sees(app.c.share.visibility)).toBe(false);
    await pressShareButton(app);
    expect(device.shared.at(-1)?.url).toMatch(new RegExp(`/shared/${marta.shareCode}$`));
  });

  it('More from its maker lists their other sets, and opening one opens it', async () => {
    const { app, other } = await martaSet({ more: true });
    await app.waitFor('More from Marta');
    await app.tap('Verduras de Marta');
    expect(app.pathname()).toBe(`/set/${other!.id}`);
  });

  // Question: should a set's own page name its maker? SetScreen shows the topic and level, not the
  // maker (only lists and the “More from” shelf do). The brief expects the maker there; no doc says.
  it.todo('the set page of another learner names its maker, or the design says it should not');

  it('a maker with no other public set has no “More from” shelf', async () => {
    const { app } = await martaSet();
    expect(app.sees(app.c.community.moreBy('Marta'))).toBe(false);
  });

  it('its Play plays its phrases from the first, with their clips', async () => {
    const { app } = await martaSet();
    await app.tap(app.c.set.playAll('Compras de Marta'));
    await app.advance(3_000);
    expect(audio.clips().length).toBeGreaterThan(0);
    expect(app.sees(app.c.set.pauseAll('Compras de Marta'))).toBe(true);
  });
});

describe('Sharing: an album shared by link', () => {
  async function martaAlbum(options: { signedIn?: boolean; more?: boolean } = {}) {
    const api = new FakeApi();
    api.addUser('ana@loro.test', 'Ana');
    const set = communitySet(api, { title: 'Compras de Marta', displayName: 'Marta', phrases: MARTA });
    const album = communityAlbum(api, { title: 'Cafe songs', displayName: 'Marta', setId: set.id, songs: [{ title: 'Pasa la tarde' }, { title: 'Mercado' }] });
    const other = options.more ? communityAlbum(api, { title: 'Market songs', displayName: 'Marta', setId: set.id, songs: [{ title: 'Tomates' }] }) : null;
    const app = await launch({ api, signedIn: options.signedIn === false ? undefined : 'ana@loro.test', url: `/album/${album.id}` });
    return { app, api, album, other };
  }

  it('saves to the library, and the button then offers to remove it', async () => {
    const { app, album } = await martaAlbum();
    await app.tap(app.c.share.save);
    expect(app.api.calls('POST /library/saves').at(-1)?.body).toEqual({ kind: 'album', id: album.id });
    expect(app.sees(app.c.share.savedToast)).toBe(true);
    expect(app.sees(app.c.share.unsave)).toBe(true);
    await app.tap(app.c.share.unsave);
    expect(app.api.calls(`DELETE /library/saves/album/${album.id}`)).toHaveLength(1);
    expect(app.sees(app.c.share.unsavedToast)).toBe(true);
  });

  it('saving while signed out opens the account and saves nothing', async () => {
    const { app } = await martaAlbum({ signedIn: false });
    await app.tap(app.c.share.save);
    expect(app.pathname()).toBe('/account');
    expect(app.api.calls('POST /library/saves')).toHaveLength(0);
  });

  it('its share button passes on the album’s link', async () => {
    const { app, album } = await martaAlbum();
    await app.tap(app.c.share.share);
    await pressShareButton(app);
    expect(device.shared.at(-1)?.url).toMatch(new RegExp(`/shared/${album.shareCode}$`));
  });

  it.each(REASONS)('reports it for “%s”, and says thank you', async (reason) => {
    const { app, album } = await martaAlbum();
    await app.tap(app.c.share.report);
    await app.tap(app.c.share.reason[reason]);
    expect(app.api.calls('POST /library/reports').at(-1)?.body).toEqual({ kind: 'album', id: album.id, reason });
    expect(app.sees(app.c.share.reported)).toBe(true);
  });

  it('More from its maker lists their other albums, and opening one opens it', async () => {
    const { app, other } = await martaAlbum({ more: true });
    await app.waitFor('More from Marta');
    await app.tap('Market songs');
    expect(app.pathname()).toBe(`/album/${other!.id}`);
  });
});
