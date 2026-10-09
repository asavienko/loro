// Every screen and sheet the capture (capture.mjs) records, each in the states worth seeing. A
// scenario opens `path` with a saved learner `state` (seed.ts: new, fresh, learning, playing),
// signed in or not, and its `steps` put the screen in the state captured; `api` answers a request
// before the default answers ({ status, body }, null for offline, 'hang' for never).
// Controls are found as a learner's screen reader finds them: by role and accessible name, so a
// renamed label fails here as it would for them. `--probe NAME` prints what a scenario's page offers.

/** The API's origin in the web build the capture serves: only the capture answers it. */
export const API_ORIGIN = 'http://api.screens.test';
/** The clock in the browser, and the moment the seeded progress is relative to. */
export const NOW = Date.UTC(2026, 9, 9, 9, 0, 0);

const by = (page, name, role = 'button') => page.getByRole(role, { name, exact: typeof name === 'string' }).first();
/** Taps each control in turn (a string is its exact name, a RegExp a match), waiting for the sheet or page. */
const tap =
  (...names) =>
  async (page) => {
    for (const name of names) {
      const [role, label] = Array.isArray(name) ? name : ['button', name];
      await by(page, label, role).click();
      await page.waitForTimeout(600);
    }
  };
/** Types into the text field with this accessible name. */
const type = (label, text) => async (page) => {
  await page.getByRole('textbox', { name: label }).first().fill(text);
  await page.waitForTimeout(600);
};
const steps =
  (...all) =>
  async (page) => {
    for (const step of all) await step(page);
  };
const continueOnboarding = (times) => tap(...Array(times).fill('Continue'));

export const SCENARIOS = [
  // Onboarding: a first start, step by step.
  { group: 'Onboarding', name: 'onboarding-1-language', state: 'new', description: 'Which language do you speak?' },
  { group: 'Onboarding', name: 'onboarding-2-name', state: 'new', steps: continueOnboarding(1) },
  { group: 'Onboarding', name: 'onboarding-2-name-filled', state: 'new', steps: steps(continueOnboarding(1), async (page) => page.getByRole('textbox').first().fill('Ana')) },
  { group: 'Onboarding', name: 'onboarding-3-course', state: 'new', steps: continueOnboarding(2) },
  { group: 'Onboarding', name: 'onboarding-4-account', state: 'new', steps: continueOnboarding(3) },
  { group: 'Onboarding', name: 'onboarding-5-loop', state: 'new', steps: steps(continueOnboarding(3), tap('Not now')) },
  { group: 'Onboarding', name: 'onboarding-bulgarian', state: 'new', description: 'Interface in Bulgarian', steps: tap(['radio', 'Български']) },

  // Before the course is installed.
  { group: 'Connection', name: 'connection-first-start-loading', state: 'new', noContent: true, api: () => 'hang', description: 'No languages yet, the server answering slowly' },
  { group: 'Connection', name: 'connection-first-start-offline', state: 'new', noContent: true, offline: true },
  { group: 'Connection', name: 'connection-course-loading', state: 'fresh', noContent: true, api: ({ path }) => (path === '/library/pack' ? 'hang' : undefined) },
  { group: 'Connection', name: 'connection-course-offline', state: 'fresh', noContent: true, offline: true, keepLanguages: true },

  // Home.
  { group: 'Home', name: 'home-new-learner', state: 'fresh', description: 'Onboarded, nothing played yet' },
  { group: 'Home', name: 'home-learning', state: 'learning', description: 'A month of reviews' },
  { group: 'Home', name: 'home-mini-player', state: 'playing', description: 'A queue paused: the mini player above the tabs' },
  { group: 'Home', name: 'home-history', state: 'learning', steps: tap('History') },
  { group: 'Home', name: 'home-offline', state: 'learning', offline: true, description: 'The course installed, the server out of reach' },

  // Settings sheet.
  { group: 'Settings', name: 'settings-signed-out', state: 'learning', steps: tap('Ana: settings') },
  { group: 'Settings', name: 'settings-signed-in', state: 'learning', signedIn: true, steps: tap('Ana: settings') },

  // Explore.
  { group: 'Explore', name: 'explore', path: '/explore', state: 'learning' },
  { group: 'Explore', name: 'explore-new-learner', path: '/explore', state: 'fresh' },
  { group: 'Explore', name: 'explore-search', path: '/explore', steps: type('Phrases, notes, topics', 'café') },
  { group: 'Explore', name: 'explore-search-nothing', path: '/explore', steps: type('Phrases, notes, topics', 'zzzz') },
  { group: 'Explore', name: 'explore-topic', path: '/explore', steps: tap(/^Eating out, \d+ sets?$/) },
  { group: 'Explore', name: 'explore-level', path: '/explore', steps: tap('A2') },
  { group: 'Explore', name: 'explore-signed-in', path: '/explore', signedIn: true, description: 'Community lists a shared set' },

  // Create.
  { group: 'Create', name: 'create-signed-out', path: '/create' },
  { group: 'Create', name: 'create-signed-in', path: '/create', signedIn: true },
  { group: 'Create', name: 'make-set-signed-out', path: '/make' },
  { group: 'Create', name: 'make-set-topic', path: '/make', signedIn: true },
  { group: 'Create', name: 'make-set-topic-typed', path: '/make', signedIn: true, steps: type('A topic or a situation', 'At the bakery') },
  { group: 'Create', name: 'make-set-keywords', path: '/make', signedIn: true, steps: tap(['radio', 'Keywords']) },
  { group: 'Create', name: 'make-set-text', path: '/make', signedIn: true, steps: tap(['radio', 'Text']) },
  { group: 'Create', name: 'make-set-server-error', path: '/make', signedIn: true, steps: tap('Health & pharmacy'), description: 'The server could not write the phrases' },
  { group: 'Create', name: 'make-song-sheet', path: '/create', signedIn: true, steps: tap(/^A song from a set/) },

  // Library: phrases, sets, albums.
  { group: 'Library', name: 'library-due', path: '/library', state: 'learning' },
  { group: 'Library', name: 'library-liked', path: '/library', steps: tap('Liked') },
  { group: 'Library', name: 'library-mine-signed-out', path: '/library', steps: tap('Mine') },
  { group: 'Library', name: 'library-mine-signed-in', path: '/library', signedIn: true, steps: tap('Mine') },
  { group: 'Library', name: 'library-learning', path: '/library', steps: tap('Learning') },
  { group: 'Library', name: 'library-missed', path: '/library', steps: tap('Missed recently') },
  { group: 'Library', name: 'library-learned', path: '/library', steps: tap('Learned') },
  { group: 'Library', name: 'library-new-learner', path: '/library', state: 'fresh' },
  { group: 'Library', name: 'library-sets', path: '/library', steps: tap(['tab', 'Sets']) },
  { group: 'Library', name: 'library-sets-liked', path: '/library', steps: tap(['tab', 'Sets'], 'Liked sets') },
  { group: 'Library', name: 'library-sets-signed-in', path: '/library', signedIn: true, steps: tap(['tab', 'Sets']) },
  { group: 'Library', name: 'library-albums', path: '/music' },

  // A set's page.
  { group: 'Set', name: 'set-in-progress', path: '/set/set-cafe' },
  { group: 'Set', name: 'set-not-started', path: '/set/set-cafe', state: 'fresh' },
  { group: 'Set', name: 'set-more-options', path: '/set/set-cafe', steps: tap('More options') },
  { group: 'Set', name: 'set-liked-phrases', path: '/library', steps: tap(['tab', 'Sets'], /^Liked phrases/) },
  { group: 'Set', name: 'set-own', path: '/set/set-mine', signedIn: true },
  { group: 'Set', name: 'set-own-more-options', path: '/set/set-mine', signedIn: true, steps: tap('More options') },
  { group: 'Set', name: 'set-own-rename', path: '/set/set-mine', signedIn: true, steps: tap('More options', 'Name and description') },
  { group: 'Set', name: 'set-own-share', path: '/set/set-mine', signedIn: true, steps: tap('More options', /^Share/) },
  { group: 'Set', name: 'set-own-add-phrases', path: '/set/set-mine', signedIn: true, steps: tap(/^Add phrases/) },
  { group: 'Set', name: 'set-other-learner', path: '/set/set-other', signedIn: true, description: "Another learner's public set, saved" },
  { group: 'Set', name: 'set-other-report', path: '/set/set-other', signedIn: true, steps: tap('More options', /^Report/) },
  { group: 'Set', name: 'set-make-song', path: '/set/set-cafe', signedIn: true, steps: tap('Make a song') },

  // A phrase's details sheet.
  { group: 'Phrase', name: 'phrase-details-mnemonic', path: '/set/set-cafe', steps: tap('Details for Me pone un cortado, por favor') },
  { group: 'Phrase', name: 'phrase-details-grammar', path: '/set/set-cafe', steps: tap('Details for Me pone un cortado, por favor', ['tab', 'Grammar']) },
  { group: 'Phrase', name: 'phrase-details-sounds', path: '/set/set-cafe', steps: tap('Details for Me pone un cortado, por favor', ['tab', 'Sounds']) },
  { group: 'Phrase', name: 'phrase-details-new', path: '/set/set-cafe', state: 'fresh', steps: tap('Details for Me pone un cortado, por favor') },
  { group: 'Phrase', name: 'phrase-add-signed-in', path: '/library', signedIn: true, steps: tap('Mine', /^Add your phrase/) },

  // The player.
  { group: 'Player', name: 'player-paused', path: '/player', state: 'playing' },
  { group: 'Player', name: 'player-rated', path: '/player', state: 'playing', steps: tap('Easy') },
  { group: 'Player', name: 'player-playing-new-phrase', path: '/set/set-cafe', state: 'fresh', description: 'Playing a new phrase, in the pause to say it', steps: tap('Play Café & Mañanas', /^Now playing/) },
  { group: 'Player', name: 'player-notes', path: '/player', state: 'playing', steps: tap('Notes') },
  { group: 'Player', name: 'player-add-to-set', path: '/player', state: 'playing', steps: tap('Add to set…') },
  { group: 'Player', name: 'player-add-to-set-signed-in', path: '/player', state: 'playing', signedIn: true, steps: tap('Add to set…') },
  { group: 'Player', name: 'player-song', path: '/set/set-cafe', steps: tap('Play Un Cortado al Sol', /^Now playing/) },

  // The queue.
  { group: 'Queue', name: 'queue', path: '/queue', state: 'playing' },
  { group: 'Queue', name: 'queue-session-summary', path: '/queue', state: 'playing', steps: tap(/^This session/) },
  { group: 'Queue', name: 'queue-row-options', path: '/queue', state: 'playing', steps: tap('Move A single ticket, please') },
  { group: 'Queue', name: 'queue-save-as-set', path: '/queue', state: 'playing', signedIn: true, steps: tap('Save as set') },
  { group: 'Queue', name: 'queue-cleared', path: '/queue', state: 'playing', steps: tap('Clear queue') },

  // Albums.
  { group: 'Album', name: 'album', path: '/album/album-screens' },
  { group: 'Album', name: 'album-liked-songs', path: '/music', steps: tap(/^Liked songs/) },

  // Account.
  { group: 'Account', name: 'account-sign-in', path: '/account' },
  { group: 'Account', name: 'account-sign-in-email', path: '/account', steps: type('Email', 'ana@example.com') },
  { group: 'Account', name: 'account-signed-in', path: '/account', signedIn: true },

  // Links.
  { group: 'Shared link', name: 'shared-set', path: '/shared/othercode1', description: "A link to another learner's set" },
  { group: 'Shared link', name: 'shared-missing', path: '/shared/abcdefghij', description: 'A link to nothing' },
];
