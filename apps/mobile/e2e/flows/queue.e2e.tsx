// The queue (/queue): now playing, up next and previously played. Covered: opening it from the
// full player's queue button and from the mini player; back; the session summary row; the gesture
// hint; shuffle on and off; up next by its handle's options (move up, move down, remove, their
// disabled ends and undo); the same moves as screen-reader actions and as arrow and Delete keys; the
// now-playing row's play and pause; play now from a row; previously played and its "play next"; clear
// queue and its undo; save as set, signed in and out; the empty state; queuing from a phrase's
// details (play next, add to queue) and from an idle player; swipes right (play now) and left
// (remove), a short swipe, dragging the handle; the Again tag on a Missed phrase; and the details
// of a previously played phrase.
import { audio, fireEvent, launch, screen, type App } from '../harness';
import { findPhrase, promptOf } from '@shared/state/catalog';

const SET = '/set/set-cafe';
const CAFE_TITLE = 'Café & Mañanas';

/** Starts the Café set and pauses it, so the queue holds still. */
async function pausedQueue(): Promise<App> {
  const app = await launch({ url: SET });
  await app.tap(app.c.set.playAll(CAFE_TITLE));
  await app.advance(1000);
  await app.tap(app.c.common.pause);
  return app;
}

/** Opens the queue from the mini player, through the full player's queue button. */
async function openQueue(app: App): Promise<void> {
  await app.tap(new RegExp(`^${app.c.player.dialog}: `));
  await app.tap(app.c.player.openQueue);
  await app.waitFor(app.c.queue.title);
}

/** The prompt (what the learner hears first) of a phrase, as the rows show it. */
function promptFor(id: string): string {
  const phrase = findPhrase({} as never, id);
  if (!phrase) throw new Error(`No phrase ${id}`);
  return promptOf(phrase, 'en-GB').text;
}

/** The target-language text of a phrase. */
function targetOf(id: string): string {
  return findPhrase({} as never, id)?.target ?? '';
}

/** The phrase ids of the queue, in order, as saved. */
async function order(app: App): Promise<string[]> {
  return (await app.saved()).player.order;
}

/** Up next as saved: the ids after the one playing. */
async function upNextOf(app: App): Promise<string[]> {
  const player = (await app.saved()).player;
  return player.order.slice(player.index + 1);
}

/** The "Play … now" labels of the up-next rows on screen, as the prompts, in the order shown. */
function upNextOnScreen(app: App): string[] {
  const [before, after] = app.c.queue.playNow('\u0001').split('\u0001');
  return screen
    .queryAllByRole('button')
    .map((el) => String(el.props.accessibilityLabel ?? ''))
    .filter((label) => label.startsWith(before) && label.endsWith(after))
    .map((label) => label.slice(before.length, label.length - after.length));
}

/** Opens a phrase's details from its row: the row shows its prompt when playing, else its target. */
async function detailsOf(app: App, id: string): Promise<void> {
  const byTarget = app.c.phrase.details(targetOf(id));
  await app.tap(app.sees(byTarget) ? byTarget : app.c.phrase.details(promptFor(id)));
}

/** Text on screen that starts with `text` (a row's text can carry more after it). */
function startsWith(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
}

describe('the queue screen', () => {
  it('opens from the full player and shows now playing, then up next in order', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    expect(app.pathname()).toBe('/queue');
    const ids = await order(app);
    expect(upNextOnScreen(app)).toEqual(ids.slice(1).map(promptFor));
    expect(app.sees(app.c.queue.nowPlaying)).toBe(true);
    expect(app.sees(startsWith(app.c.queue.left(ids.length - 1)))).toBe(true);
    expect(app.sees(app.c.queue.upNext(ids.length - 1))).toBe(true);
  });

  it('opens from the mini player with the queue and its player left as they were', async () => {
    const app = await pausedQueue();
    const before = await order(app);
    await openQueue(app);
    expect(await order(app)).toEqual(before);
    expect((await app.saved()).player.status).toBe('paused');
  });

  it('goes back to the player with its back button', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    await app.tap(app.c.queue.back);
    expect(app.pathname()).toBe('/player');
  });

  it('opens the session summary from its row', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    expect(app.sees(app.c.summary.none)).toBe(false);
    await app.tap(startsWith(app.c.summary.title));
    expect(app.sees(app.c.summary.none)).toBe(true);
  });

  it('shows the gesture hint until a swipe or drag, and keeps it after a move from the options', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    expect(app.sees(app.c.queue.hint)).toBe(true);
    const ids = await order(app);
    await app.tap(app.c.queue.move(promptFor(ids[1])));
    await app.tap(app.c.queue.moveDown);
    expect(app.sees(app.c.queue.hint)).toBe(true);
  });

  it('shows the empty state when nothing is queued', async () => {
    const app = await launch({ url: '/queue' });
    await app.waitFor(app.c.queue.title);
    expect(app.sees(app.c.queue.nothing)).toBe(true);
    expect(app.sees(app.c.queue.clear)).toBe(false);
    expect(app.sees(app.c.queue.nowPlaying)).toBe(false);
  });

  it('the now-playing row plays and pauses the queue', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    await app.tap(app.c.common.play);
    expect(app.sees(app.c.common.pause)).toBe(true);
    await app.advance(2_000);
    expect(audio.clips().length).toBeGreaterThan(0);
    await app.tap(app.c.common.pause);
    expect(app.sees(app.c.common.play)).toBe(true);
    expect((await app.saved()).player.status).toBe('paused');
  });
});

describe('shuffle up next', () => {
  it('shuffles up next and keeps the playing phrase first', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const before = await order(app);
    await app.tap(app.c.queue.shuffle);
    const after = await order(app);
    expect(after[0]).toBe(before[0]);
    expect([...after].sort()).toEqual([...before].sort());
    expect(screen.getByLabelText(app.c.queue.shuffle).props.accessibilityState).toEqual({ selected: true });
    expect((await app.saved()).player.shuffle).toBe(true);
  });

  it('turning shuffle off puts up next back in the set order', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const setOrder = await order(app);
    await app.tap(app.c.queue.shuffle);
    await app.tap(app.c.queue.shuffle);
    expect(await order(app)).toEqual(setOrder);
    expect(screen.getByLabelText(app.c.queue.shuffle).props.accessibilityState).toEqual({ selected: false });
    expect((await app.saved()).player.shuffle).toBe(false);
  });
});

describe('up next options (the handle)', () => {
  it('opens the options for a row, titled by its prompt, with move and remove', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.tap(app.c.queue.move(promptFor(ids[2])));
    expect(app.sees(promptFor(ids[2]))).toBe(true);
    expect(app.sees(app.c.queue.moveUp)).toBe(true);
    expect(app.sees(app.c.queue.moveDown)).toBe(true);
    expect(app.sees(app.c.queue.removeFromQueue)).toBe(true);
  });

  it('moves a row up one place', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.tap(app.c.queue.move(promptFor(ids[3])));
    await app.tap(app.c.queue.moveUp);
    const moved = [ids[1], ids[3], ids[2], ids[4]];
    expect(await upNextOf(app)).toEqual(moved);
    expect(upNextOnScreen(app)).toEqual(moved.map(promptFor));
  });

  it('moves a row down one place', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.tap(app.c.queue.move(promptFor(ids[1])));
    await app.tap(app.c.queue.moveDown);
    const moved = [ids[2], ids[1], ids[3], ids[4]];
    expect(await upNextOf(app)).toEqual(moved);
    expect(upNextOnScreen(app)).toEqual(moved.map(promptFor));
  });

  it('does not move the first row up, nor the last row down', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.tap(app.c.queue.move(promptFor(ids[1])));
    await app.tap(app.c.queue.moveUp);
    expect(await upNextOf(app)).toEqual(ids.slice(1));
    await app.tap(app.c.queue.move(promptFor(ids[4])));
    await app.tap(app.c.queue.moveDown);
    expect(await upNextOf(app)).toEqual(ids.slice(1));
  });

  it('removes a row from the options, and undo puts it back where it was', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.tap(app.c.queue.move(promptFor(ids[2])));
    await app.tap(app.c.queue.removeFromQueue);
    const without = ids.filter((id) => id !== ids[2]);
    expect(await order(app)).toEqual(without);
    expect(upNextOnScreen(app)).toEqual(without.slice(1).map(promptFor));
    expect(app.sees(app.c.toast.removed)).toBe(true);
    await app.tap(app.c.common.undo);
    expect(await order(app)).toEqual(ids);
    expect(upNextOnScreen(app)).toEqual(ids.slice(1).map(promptFor));
  });

  it('closes the options once a move is made', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.tap(app.c.queue.move(promptFor(ids[1])));
    await app.tap(app.c.queue.moveDown);
    expect(app.sees(app.c.queue.removeFromQueue)).toBe(false);
  });
});

describe('screen-reader actions and keys on a row', () => {
  it('offers only the moves that can be made as accessibility actions', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    const first = screen.getByLabelText(app.c.queue.move(promptFor(ids[1])));
    expect((first.props.accessibilityActions as { name: string }[]).map((a) => a.name)).toEqual(['moveDown', 'remove']);
    const last = screen.getByLabelText(app.c.queue.move(promptFor(ids[4])));
    expect((last.props.accessibilityActions as { name: string }[]).map((a) => a.name)).toEqual(['moveUp', 'remove']);
  });

  it('moves a row with its move action, as a screen reader does', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    fireEvent(screen.getByLabelText(app.c.queue.move(promptFor(ids[1]))), 'accessibilityAction', { nativeEvent: { actionName: 'moveDown' } });
    await app.settle();
    expect(await upNextOf(app)).toEqual([ids[2], ids[1], ids[3], ids[4]]);
  });

  it('removes a row with its remove action', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    fireEvent(screen.getByLabelText(app.c.queue.move(promptFor(ids[1]))), 'accessibilityAction', { nativeEvent: { actionName: 'remove' } });
    await app.settle();
    expect(await upNextOf(app)).toEqual(ids.slice(2));
  });

  it('moves with the arrow keys and removes with Delete, on the web', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    const handle = screen.getByLabelText(app.c.queue.move(promptFor(ids[1])));
    const press = (key: string) => fireEvent(handle, 'keyDown', { key, preventDefault: () => undefined });
    press('ArrowDown');
    await app.settle();
    expect(await upNextOf(app)).toEqual([ids[2], ids[1], ids[3], ids[4]]);
    press('Delete');
    await app.settle();
    expect(await upNextOf(app)).toEqual([ids[2], ids[3], ids[4]]);
  });
});

describe('play now and previously played', () => {
  it('plays a row now: it is the phrase playing, and the order stays', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.tap(app.c.queue.playNow(promptFor(ids[2])));
    expect(app.sees(app.c.common.pause)).toBe(true);
    expect(await order(app)).toEqual(ids);
    await app.advance(2_000);
    expect(audio.clips().some((clip) => clip.endsWith(ids[2]))).toBe(true);
  });

  it('phrases heard before the one now playing move to previously played', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.tap(app.c.common.play);
    await app.advance(30_000);
    await app.tap(app.c.common.pause);
    expect(app.sees(app.c.queue.previously)).toBe(true);
    expect(app.sees(app.c.queue.playNext(targetOf(ids[0])))).toBe(true);
  });

  it('"play next" on a previously played phrase queues it straight after the one playing', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.tap(app.c.common.play);
    await app.advance(30_000);
    await app.tap(app.c.common.pause);
    const current = (await app.saved()).player.index;
    await app.tap(app.c.queue.playNext(targetOf(ids[0])));
    expect(app.sees(app.c.set.addedNext)).toBe(true);
    expect((await upNextOf(app))[0]).toBe(ids[0]);
    expect((await app.saved()).player.index).toBe(current);
  });
});

describe('clear queue', () => {
  it('clears everything after the phrase playing, with no confirmation, and undo brings it back', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.tap(app.c.queue.clear);
    expect(await order(app)).toEqual([ids[0]]);
    expect(app.sees(app.c.queue.nothing)).toBe(true);
    expect(app.sees(app.c.queue.clear)).toBe(false);
    expect(app.sees(app.c.toast.cleared)).toBe(true);
    expect(app.api.calls('POST /library/sets')).toHaveLength(0);
    await app.tap(app.c.common.undo);
    expect(await order(app)).toEqual(ids);
    expect(upNextOnScreen(app)).toEqual(ids.slice(1).map(promptFor));
  });
});

describe('save as set', () => {
  it('asks a learner who is signed out to sign in first, and saves nothing', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    await app.tap(app.c.queue.saveAsSet);
    expect(app.sees(app.c.account.signInTitle)).toBe(true);
    expect(app.api.calls('POST /library/sets')).toHaveLength(0);
  });

  it('saves the queue as a new set of the learner’s own, named after the set', async () => {
    const app = await launch({ url: SET, signedIn: 'ana@example.test' });
    await app.tap(app.c.set.playAll(CAFE_TITLE));
    await app.advance(1000);
    await app.tap(app.c.common.pause);
    await openQueue(app);
    await app.tap(app.c.queue.saveAsSet);
    const sent = app.api.calls('POST /library/sets');
    expect(sent).toHaveLength(1);
    expect(app.sees(app.c.toast.saved(`${CAFE_TITLE} · ${app.c.queue.defaultSetName}`))).toBe(true);
  });
});

describe('queuing from a phrase', () => {
  it('a phrase queued from an idle player starts a paused queue on it', async () => {
    const app = await launch({ url: SET });
    await detailsOf(app, 'cafe-03');
    await app.tap(app.c.phrase.addToQueue);
    expect(app.sees(app.c.set.addedEnd)).toBe(true);
    const saved = await app.saved();
    expect(saved.player.status).toBe('paused');
    expect(saved.player.order).toEqual(['cafe-03']);
  });

  it('add to queue puts a phrase at the end, after what is queued', async () => {
    const app = await launch({ url: SET });
    await detailsOf(app, 'cafe-03');
    await app.tap(app.c.phrase.addToQueue);
    await detailsOf(app, 'cafe-01');
    await app.tap(app.c.phrase.addToQueue);
    expect((await app.saved()).player.order).toEqual(['cafe-03', 'cafe-01']);
  });

  it('play next puts a phrase straight after the one playing, ahead of what is queued', async () => {
    const app = await launch({ url: SET });
    await detailsOf(app, 'cafe-03');
    await app.tap(app.c.phrase.addToQueue);
    await detailsOf(app, 'cafe-01');
    await app.tap(app.c.phrase.addToQueue);
    await detailsOf(app, 'cafe-05');
    await app.tap(app.c.phrase.playNext);
    expect(app.sees(app.c.set.addedNext)).toBe(true);
    expect((await app.saved()).player.order).toEqual(['cafe-03', 'cafe-05', 'cafe-01']);
  });

  it('play next moves a queued phrase to the top of up next, without a duplicate', async () => {
    const app = await pausedQueue();
    const ids = await order(app);
    await detailsOf(app, ids[4]);
    await app.tap(app.c.phrase.playNext);
    expect(await upNextOf(app)).toEqual([ids[4], ids[1], ids[2], ids[3]]);
  });

  it('the phrase playing cannot be queued again', async () => {
    const app = await pausedQueue();
    const ids = await order(app);
    await detailsOf(app, ids[0]);
    await app.tap(app.c.phrase.addToQueue);
    expect(await order(app)).toEqual(ids);
  });
});

describe('swipes and drags', () => {
  it('a swipe right plays that row now', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.swipe(app.c.queue.playNow(promptFor(ids[2])), { dx: 200 });
    expect(app.sees(app.c.common.pause)).toBe(true);
    expect(await order(app)).toEqual(ids);
    expect(app.sees(app.c.queue.hint)).toBe(false);
    await app.advance(2_000);
    expect(audio.clips().some((clip) => clip.endsWith(ids[2]))).toBe(true);
  });

  it('a swipe left removes the row, and undo puts it back', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.swipe(app.c.queue.playNow(promptFor(ids[1])), { dx: -200 });
    expect(await order(app)).toEqual([ids[0], ids[2], ids[3], ids[4]]);
    expect(upNextOnScreen(app)).toEqual(ids.slice(2).map(promptFor));
    expect(app.sees(app.c.toast.removed)).toBe(true);
    await app.tap(app.c.common.undo);
    expect(await order(app)).toEqual(ids);
  });

  it('a short swipe does nothing, and is not taken for a tap', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.swipe(app.c.queue.playNow(promptFor(ids[1])), { dx: -40 });
    await app.swipe(app.c.queue.playNow(promptFor(ids[1])), { dx: 40 });
    expect(await order(app)).toEqual(ids);
    expect(app.sees(app.c.common.pause)).toBe(false);
    expect(app.sees(app.c.toast.removed)).toBe(false);
  });

  it('dragging the handle down moves the row two places down', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.swipe(app.c.queue.move(promptFor(ids[1])), { dy: 140 });
    const moved = [ids[0], ids[2], ids[3], ids[1], ids[4]];
    expect(await order(app)).toEqual(moved);
    expect(upNextOnScreen(app)).toEqual(moved.slice(1).map(promptFor));
    expect(app.sees(app.c.queue.hint)).toBe(false);
  });

  it('dragging the handle up moves the row up', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.swipe(app.c.queue.move(promptFor(ids[4])), { dy: -140 });
    expect(await order(app)).toEqual([ids[0], ids[1], ids[4], ids[2], ids[3]]);
  });
});

/** Plays the first phrase through to its rating and rates it, with the mini player's grades. */
async function rateFirstPhrase(app: App, grade: string): Promise<void> {
  await app.tap(app.c.common.play);
  await app.advance(8_000);
  await app.tap(app.c.player.rateAs(grade));
}

describe('again', () => {
  it.each(['missed', 'hard'] as const)('a %s phrase comes back at the end of the queue, tagged Again', async (grade) => {
    const app = await pausedQueue();
    const ids = await order(app);
    await rateFirstPhrase(app, app.c.common.grade[grade]);
    await openQueue(app);
    expect(await order(app)).toEqual([...ids, ids[0]]);
    expect(app.sees(app.c.queue.again)).toBe(true);
  });

  it('an easy rating does not bring the phrase back', async () => {
    const app = await pausedQueue();
    const ids = await order(app);
    await rateFirstPhrase(app, app.c.common.grade.easy);
    await openQueue(app);
    expect(await order(app)).toEqual(ids);
    expect(app.sees(app.c.queue.again)).toBe(false);
  });
});

describe('details from a previously played row', () => {
  it('opens the phrase’s details, with its add-to-queue option', async () => {
    const app = await pausedQueue();
    await openQueue(app);
    const ids = await order(app);
    await app.tap(app.c.common.play);
    await app.advance(30_000);
    await app.tap(app.c.common.pause);
    await detailsOf(app, ids[0]);
    expect(app.sees(app.c.phrase.addToQueue)).toBe(true);
    expect(app.sees(app.c.phrase.playNext)).toBe(true);
  });
});

