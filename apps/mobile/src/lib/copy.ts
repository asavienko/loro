/**
 * Every learner-facing string in the mobile app, in one place.
 *
 * WHY THIS FILE EXISTS
 *
 * 1. **A string the E2E suite asserts on must not be able to drift.** The Playwright
 *    suite in `apps/mobile/e2e/` matches many of these by accessible name and by
 *    visible text, so a screen that holds its own literal can be "improved" in a
 *    refactor and break a test that names the same words three files away. One
 *    declaration means one place to change, and the diff shows every screen the
 *    change reaches.
 *
 * 2. **Spanish and UI chrome are different content, and the difference must be
 *    visible.** Spanish renders under `lang="es"` so a screen reader switches voice
 *    (`src/ui/primitives.tsx`); English chrome must not. Nearly all Spanish the
 *    learner sees is catalog content and never appears here — the handful of
 *    authored Spanish strings below carry an `a11y-lang: SPANISH` comment, and every
 *    one of them must be rendered with `lang="es"`.
 *
 * 3. **The DRY win.** "Add phrases", "Mark learned", "✓ Learned", "Remove from
 *    loved", "reps today", "Nothing in rotation yet" and the ✓/●/♥/‹/› glyphs each
 *    appeared in two or three screens with no shared source. They now have one.
 *
 * WHAT BELONGS HERE, AND WHAT DOES NOT
 *
 * - Interpolated copy is a **function** with named parameters, so the template — not
 *   a fragment of it — is what lives here. Defaults (`?? 10`) and derivations
 *   (`Math.min`, `.split(' ').slice(0, 2)`) stay at the call site: they are state
 *   logic, not wording.
 * - Domain data stays out. The Refrain's mode LIST, the browse THEME list, and the
 *   onboarding step order are structure; only their text is here, keyed so the
 *   structural table can look it up. Core owns those semantic keys; this file owns
 *   every English label attached to them.
 * - Catalog text (phrase `es`/`en`, pack and scenario labels, word glosses, hints) is
 *   content shipped by `@loro/content`. It is not copy and is not here.
 *
 * LAYER: this is a leaf. `src/store/`, `src/ui/` and `app/` may all import it; it
 * imports only domain types, so it cannot pull a screen's dependencies into the store.
 */

import type {
  BrowsableTheme,
  Difficulty,
  EffortState,
  MasteryBucket,
  RefrainMode,
  Tag,
} from '@loro/core'

// ─── Shared atoms ────────────────────────────────────────────────────────────
// Declared once above the table because more than one entry composes them. A
// nested object literal cannot reference its own siblings.

/** Today and the Refrain say this in one sentence and two, respectively. */
const NOTHING_IN_ROTATION = 'Nothing in rotation yet'
const SET_BUILDS_ITSELF = "Add a few phrases and today's set builds itself."
const ADD_PHRASES = 'Add phrases'
const STREAM = 'Stream'
const PROGRESS = 'Progress'
const REPS_TODAY = 'reps today'
const UNDO = 'Undo'

const difficultyLabels = {
  easy: 'Easy',
  med: 'Learning',
  hard: 'Difficult',
} as const satisfies Record<Difficulty, string>

const tagLabels = {
  pron: 'Pronunciation',
  remember: 'Hard to remember',
  useful: 'Very useful',
  words: 'Tricky words',
} as const satisfies Record<Tag, string>

const masteryLabels = {
  new: 'New',
  learning: 'Learning',
  strong: 'Strong',
  mastered: 'Mastered',
} as const satisfies Record<MasteryBucket, string>

const refrainMicLabels = {
  echo: 'Say it',
  chorus: 'Chorus it',
  speed: 'Faster!',
  cloze: 'Fill & say',
  call: 'Respond',
  cold: 'Say it cold',
} as const satisfies Record<RefrainMode, string>

const effortLabels = {
  ready: 'tap to begin',
  cold: 'warming up',
  warm: 'getting smoother',
  hot: 'quick & smooth',
  peak: 'instant & smooth',
} as const satisfies Record<EffortState, string>

const browseThemeCopy = {
  Café: { label: 'Café', emoji: '☕' },
  Dining: { label: 'Dining', emoji: '🍽' },
  Travel: { label: 'Travel', emoji: '🚆' },
  Directions: { label: 'Directions', emoji: '🧭' },
  Shopping: { label: 'Shopping', emoji: '🛍' },
  'Small talk': { label: 'Small talk', emoji: '🤝' },
  Survival: { label: 'Survival', emoji: '🆘' },
  Hotel: { label: 'Hotel', emoji: '🏨' },
} as const satisfies Record<BrowsableTheme, { readonly label: string; readonly emoji: string }>

/** Today's phrase rows and the Refrain's warming card both end on this. */
const percentAutomatic = (pct: number): string => `${pct} percent automatic.`

/** Browse tiles say it visibly; the tile's accessible name repeats it. */
const toAdd = (count: number): string => `${count} to add`

export const copy = {
  /** Strings genuinely shared by more than one screen. */
  common: {
    /** `_layout` header title, Today's empty-set button, the Refrain's empty state. */
    addPhrases: ADD_PHRASES,
    /** `_layout` header title and Today's footer button. */
    stream: STREAM,
    /** `_layout` header title and Today's footer button. */
    progress: PROGRESS,
    /** Phrase detail and the stream. */
    markLearned: 'Mark learned',
    /** Phrase detail's status badge and the stream's re-rating row. */
    learnedBadge: '✓ Learned',
    /** Today's stat tile and the Refrain's finish card. */
    repsToday: REPS_TODAY,
    /** The add sheet and phrase detail share one difficulty editor. */
    difficultyQuestion: 'How hard is it for you?',
    /** Appended to a tag chip's label when the tag is on. Leading space is deliberate. */
    selectedSuffix: ' ✓',
    /**
     * An absence, not a zero. Today's and Progress's streak badges, and an
     * unanswered onboarding summary row. Non-negotiable 3: nothing here apologises
     * for a day that has not happened.
     */
    noValue: '—',
    /** A practised day, a finished set, the 10-minute option, a milestone. */
    flame: '🔥',
    marks: {
      /** Multi-select tick: onboarding packs, tag chips, milestones. */
      check: '✓',
      /** Single-select / ready marker: onboarding radios, Today's wave rail. */
      dot: '●',
      /** The unreached half of the same pair. */
      ring: '○',
    },
    hearts: {
      filled: '♥',
      outline: '♡',
    },
    chevron: {
      /** Onboarding's back affordance and the add screen's "‹ Themes". */
      left: '‹',
      /** Progress's tricky rows. */
      right: '›',
    },
  },

  /** Presentation labels for closed domain sets. Their keys remain core-owned. */
  difficulty: difficultyLabels,
  tags: tagLabels,
  mastery: masteryLabels,

  /** Stack header titles (`app/_layout.tsx`). */
  nav: {
    add: ADD_PHRASES,
    /**
     * Deliberately empty: phrase detail's hero IS the title, and a header repeating
     * the Spanish would read it twice, in the wrong language.
     */
    phrase: '',
    refrain: 'The Refrain',
    stream: STREAM,
    progress: PROGRESS,
  },

  /** Today — the ritual home. */
  today: {
    title: 'Today',
    subtitle: (weekday: string): string => `${weekday} · the daily refrain`,
    /** "Today's set" before there is a set; "Today's 5" once there is. */
    setHeading: (count: number): string => (count === 0 ? "Today's set" : `Today's ${count}`),
    lockedIn: (locked: number, total: number): string => `${locked} of ${total} locked in`,
    /** The badge on a phrase that reached 100% automaticity today. */
    lockedBadge: 'Locked',
    empty: {
      body: `${NOTHING_IN_ROTATION}. ${SET_BUILDS_ITSELF}`,
    },
    wavesHeading: "Today's three waves",
    /**
     * The three waves. `time` is the DISPLAY form; the scheduler's own times live in
     * the store's `EngineContext` settings (`waveTimes`) and are 24-hour.
     */
    waves: {
      morning: { label: 'Morning', sub: 'Meet & first reps', time: '8:00' },
      midday: { label: 'Midday', sub: 'Re-rep, from memory', time: '1:00' },
      evening: { label: 'Evening', sub: 'Cold + perform', time: '7:00' },
    },
    stats: {
      repsToday: REPS_TODAY,
      inYourStream: 'in your stream',
      graduated: 'graduated',
    },
    actions: {
      add: 'Add',
    },
    cta: {
      /** Nothing to practise: the button invites, it does not scold. */
      empty: 'Add phrases to begin',
      start: 'Start the wave →',
    },
  },

  /** Add phrases — discover, browse, and the tagging sheet. */
  add: {
    inStream: (count: number): string => `${count} in stream`,
    /**
     * The discover/browse switch. Rendered lowercase, exactly as the blueprint has
     * it. The MODE ids are state (`'discover' | 'browse'`); these are their labels.
     */
    modes: {
      discover: 'discover',
      browse: 'browse',
    },
    searchPlaceholder: 'Type a phrase, or a topic…',
    scenarioLabel: 'Scenario',
    /** What the suggestion list is showing, in the learner's terms. */
    context: {
      matches: (query: string): string => `Matches for "${query}"`,
      noMatches: 'No matches in the library',
      forScenario: (scenario: string): string => `For: ${scenario}`,
      moreLike: (theme: string): string => `More like ${theme}`,
      popular: 'Popular starters',
    },
    /**
     * Browse themes.
     *
     * SPLIT: the theme NAMES are domain data — `Theme` in `@loro/core`, and the key
     * the catalog is filtered on — so the list itself stays in the screen (or moves
     * to core) as `Theme[]`. What is copy is the tile's emoji and the fact that the
     * tile shows the theme name verbatim; both are looked up by theme.
     *
     * a11y-lang: these are ENGLISH UI category labels. "Café" is the English
     * loanword, so a screen reader must read this list in the interface language and
     * these must NOT be given `lang="es"`.
     */
    themes: browseThemeCopy,
    toAdd,
    allAdded: 'all added ✓',
    /** Back out of a theme, to the grid of themes. */
    backToThemes: '‹ Themes',
    empty: {
      body: 'Nothing more to suggest here.\nTry another theme, scenario, or search above.',
    },
    /** The + on a suggestion row. */
    addGlyph: '+',
    tagsQuestion: "What's tricky about it?",
    tagsHelper: 'pick any',
    confirm: 'Add to my stream',
  },

  /** Onboarding — welcome → goal → level → time → packs → ready. */
  onboarding: {
    welcome: {
      emoji: '🦜',
      /** a11y-lang: SPANISH. Render with `lang="es"`. */
      greeting: "¡Hola! I'm Loro",
      /** The line break is the design: two lines, centred. */
      title: 'Learn Spanish\nby the phrase',
      body:
        "Forget grammar drills. You'll collect phrases that matter to you and learn them by " +
        "listening and repeating — like a parrot, until they're yours.",
    },
    /**
     * SPLIT: the step ORDER, each step's `kind`/`key`/`multi`, and each option's
     * `val` are structure — they drive `completeOnboarding` and stay in the screen's
     * `STEPS` table. The question, the helper, and each option's label/sub/emoji are
     * copy and live here, keyed by step key and option value.
     */
    steps: {
      goal: {
        question: 'What brings you to Spanish?',
        helper: "We'll lead with the phrases that fit.",
        options: {
          trip: { emoji: '🧳', label: 'A trip coming up', sub: 'Survival & travel first' },
          convo: { emoji: '💬', label: 'Real conversations', sub: 'Small talk & everyday' },
          move: { emoji: '🌍', label: 'Moving abroad', sub: 'The full picture, fast' },
          curious: { emoji: '🪶', label: 'Just curious', sub: 'A relaxed mix' },
        },
      },
      level: {
        question: 'How much Spanish do you have?',
        helper: 'Sets how long and tricky your first phrases are.',
        options: {
          beg: { emoji: '🌱', label: 'Starting out', sub: 'Little to none' },
          some: { emoji: '🌿', label: 'Some basics', sub: 'I know a few things' },
          conf: { emoji: '🌳', label: 'Fairly confident', sub: 'I can hold a chat' },
        },
      },
      mins: {
        question: 'How much time per day?',
        helper: 'Your daily stream is built to fit.',
        options: {
          '5': { emoji: '⚡', label: '5 minutes', sub: 'Light & steady' },
          '10': { emoji: '🔥', label: '10 minutes', sub: 'A good rhythm' },
          '20': { emoji: '🚀', label: '20 minutes', sub: 'Serious progress' },
        },
      },
      packs: {
        question: 'Pick a few starter packs',
        helper: 'Choose at least one — these seed your stream now.',
      },
    },
    /**
     * A starter pack's subtitle. The pack's own label and emoji are catalog content
     * (`@loro/content`), so only the count line is copy.
     */
    packSub: (phrases: number): string => `${phrases} phrases`,
    ready: {
      emoji: '✅',
      title: "You're all set",
      /** The line break is the design: the count leads, the phrase follows. */
      seeded: (count: number): string => `${count} phrases are\nin your stream`,
      /** `mins` is already stringified at the call site, where its `?? 10` default lives. */
      sessionReady: (mins: string): string =>
        `Your first ${mins}-minute session is ready whenever you are.`,
      summary: {
        goal: 'Goal',
        daily: 'Daily',
        packs: 'Packs',
        minutes: (mins: string): string => `${mins} min`,
        packsSelected: (count: number): string => `${count} selected`,
      },
    },
    cta: {
      welcome: "Let's go →",
      next: 'Continue',
      ready: 'Start learning 🎧',
    },
  },

  /** Phrase detail — one source of truth per phrase. */
  phrase: {
    missing: {
      title: 'No phrase selected',
      body: 'Add or tap a phrase to view it',
    },
    sections: {
      wordByWord: 'Word by word',
      tricky: "What's tricky",
      inContext: 'In context',
      memoryHook: 'Memory hook',
    },
    tagsHelper: 'tap to toggle',
    hookHelper: 'helps it stick',
    hookGlyph: '💡',
    /** Under a hook the learner has adopted: tapping clears it. */
    tapToChange: 'tap to change',
    /**
     * The three generated memory hooks, offered when the catalog has no hint of its
     * own. `tie` takes the phrase's opening words — the slicing is derivation and
     * stays at the call site.
     */
    hooks: {
      sayAloud: 'Say it out loud 3× now — your mouth remembers what your eyes forget.',
      tie: (opening: string): string => `Tie “${opening}…” to the exact moment you would use it.`,
      picture: 'Picture the scene: who you are talking to, and what happens next.',
    },
    status: {
      /** "Learned" / "Learning" are STATUSES here, not difficulty ratings. */
      learned: 'Learned',
      learning: 'Learning',
      reps: (reps: number, bucket: string): string => `${reps} reps · ${bucket}`,
    },
    actions: {
      remove: 'Remove',
      practiceNow: 'Practice now →',
    },
  },

  /** The Refrain — one phrase, six reps, a different manner each rep. */
  refrain: {
    empty: {
      title: NOTHING_IN_ROTATION,
      body: SET_BUILDS_ITSELF,
    },
    /**
     * SPLIT: the mode LIST and its order (`echo → chorus → speed → cloze → call →
     * cold`) are the RefrainEngine's decision and belong in `@loro/core` — the
     * screen's local `MODES` array is domain data, not copy. What is copy is each
     * mode's CUE (shown on the warming card, and read as the mic button's hint), its
     * ICON, and the label on the mode strip. All three are keyed by mode name.
     */
    modes: {
      echo: { label: 'echo', icon: '🔁', cue: 'Hear it, then say it back' },
      chorus: { label: 'chorus', icon: '🎵', cue: 'Say it in unison — ride the beat' },
      speed: { label: 'speed', icon: '⚡', cue: 'Again, faster — keep the groove' },
      cloze: { label: 'cloze', icon: '◻️', cue: 'Fill the gap out loud' },
      call: { label: 'call', icon: '💬', cue: 'Say the Spanish for the cue' },
      cold: { label: 'cold', icon: '❄️', cue: 'From memory — no model' },
    },
    mic: refrainMicLabels,
    phraseCounter: (n: number, total: number): string => `Phrase ${n} / ${total}`,
    /** What the warming card shows instead of the phrase, per mode. */
    prompt: {
      callLabel: 'say the Spanish for',
      coldLabel: 'from memory',
      /** The blanked word in cloze mode. The word CHOICE is domain logic. */
      clozeBlank: '___',
    },
    automaticity: {
      /** Serves as both the visible label and the progress bar's accessible name. */
      label: 'Automaticity',
      percent: (pct: number): string => `${pct}%`,
    },
    /** What is falling is EFFORT, not a score. */
    effortLabel: 'effort ↓',
    effort: effortLabels,
    repCounter: (rep: number, target: number): string => `Rep ${rep} / ${target}`,
    /** Shown only for modes that play a model; the null check stays at the call site. */
    modelRate: (rate: number): string =>
      `Model plays at ${rate}× · audio lands with the native module`,
    locked: {
      gem: '💎',
      title: 'Locked in for today',
      body: 'It comes out without thinking now.',
      next: 'Next phrase →',
      finish: 'Finish the set →',
    },
    done: {
      /** a11y-lang: SPANISH. Render with `lang="es"`. */
      headline: '¡Hecho! Today is done',
      title: "Today's set is warmed up",
      workedLabel: 'worked',
      cta: 'Back to today',
    },
  },

  /** The adaptive stream — the one screen every persona uses. */
  stream: {
    empty: {
      title: 'Your stream is empty',
      body: 'Add phrases to start listening',
    },
    counter: (n: number, total: number): string => `${n} / ${total}`,
    repeatLabel: 'repeat',
    /** The transport row. Glyphs, not icons: they are the rendered text. */
    controls: {
      prev: '◄◄',
      play: '►',
      skip: '►►',
    },
    rateQuestion: "How's this one?",
    lovedBadge: '♥ Loved',
    loveLabel: '♡ Love',
    upNext: 'Up next',
    /** Roll-up pills. "Difficult" describes the phrase, never the learner. */
    pills: {
      loved: (count: number): string => `♥ ${count}`,
      hard: (count: number): string => `Difficult ${count}`,
      learned: (count: number): string => `Learned ${count}`,
    },
    /**
     * Non-negotiable 2: the screen says plainly which of its numbers are real, rather
     * than letting silence imply the audio works.
     */
    audioNote:
      'Audio playback arrives with the native audio module — see ADR-0007. The queue, the ' +
      'repeat counts, and the live re-ranking are real.',
  },

  /** Progress — the connective thread closing its loop. Nothing here shames a missed day. */
  progress: {
    streak: {
      label: 'Current streak',
      /** No streak yet is an invitation, not a zero. */
      empty: 'start today',
      days: (streak: number): string => `${streak === 1 ? 'day' : 'days'} 🔥`,
    },
    stats: {
      phrasesInStream: 'phrases in stream',
      repsDone: 'reps done',
      mastered: 'mastered',
    },
    mastery: {
      title: 'Phrase mastery',
      total: (count: number): string => `${count} total`,
      /**
       * Every chart carries a visible summary — checked in CI. The bucket labels come
       * from `masteryMeta` in `src/ui/theme.ts`; this lowercases them into a sentence.
       */
      chartSummary: (buckets: readonly { count: number; label: string }[]): string =>
        `${buckets.map((b) => `${b.count} ${b.label.toLowerCase()}`).join(', ')}.`,
    },
    tricky: {
      title: "What's tricky in your stream",
      empty:
        "Nothing tagged yet. Tag a phrase with what's hard about it and it shows up here — and " +
        'steers what you practise.',
    },
    milestones: {
      title: 'Milestones',
      /**
       * SPLIT: whether a milestone is `done` is state (and each predicate stays in the
       * screen); the emoji, title, and progress line are copy.
       */
      first10: {
        emoji: '🌱',
        title: 'First 10 phrases',
        sub: (collected: number): string => `${collected} collected`,
      },
      firstTag: { emoji: '💬', title: 'First tagged phrase', sub: 'The thread begins' },
      firstLockIn: { emoji: '🔥', title: 'First locked in', sub: 'Six reps in one day' },
      mastered25: {
        emoji: '🏆',
        title: '25 mastered',
        sub: (mastered: number): string => `${mastered} of 25`,
      },
    },
  },

  /**
   * Toasts.
   *
   * These explain the CONSEQUENCE of an action ("Difficult — repeats more, comes back
   * sooner") rather than confirming it ("Saved"). That is what teaches the learner the
   * model, so the wording is a product contract, not decoration.
   */
  toast: {
    /** The affordance in the toast pill: visible label and accessible name. */
    undo: UNDO,
    added: 'Added — here are more like it',
    addedOwn: 'Added to your stream',
    difficulty: {
      hard: 'Difficult — repeats more, comes back sooner',
      easy: 'Easy — drifting to the back',
      med: 'Back to normal',
    },
    loved: {
      added: '♥ Loved — surfacing more often',
      removed: 'Removed from Loved',
    },
    learned: {
      marked: '✓ Learned — removed from the stream',
      unmarked: 'Back into your stream',
    },
    /** Curly quotes are the blueprint's. `label` is lowercased here, once. */
    drilling: (count: number, label: string): string =>
      `Drilling ${count} “${label.toLowerCase()}” phrases`,
  },

  /**
   * Accessible names and hints.
   *
   * Kept apart from visible copy because they answer a different question — what the
   * control IS, spoken, with no layout to lean on — and because two of these props
   * never reach a browser (react-native-web forwards neither `accessibilityHint` nor
   * `accessibilityLanguage`), so the E2E suite cannot catch a regression in a hint.
   */
  a11y: {
    common: {
      back: 'Back',
      dismiss: 'Dismiss',
      undo: UNDO,
      /** Phrase detail's heart, and the stream's love button, when the phrase is loved. */
      removeFromLoved: 'Remove from loved',
      /** Today's set rows and the stream's up-next rows both open phrase detail. */
      opensPhraseDetails: 'Opens phrase details',
    },
    today: {
      /** One focusable element per row, so the row's name carries the number. */
      phraseRow: (es: string, pct: number): string => `${es}. ${percentAutomatic(pct)}`,
      startHint: (phrases: number, repsEach: number): string =>
        `${phrases} phrases, ${repsEach} reps each`,
    },
    add: {
      searchInput: 'Search phrases',
      themeTile: (theme: string, count: number): string => `${theme}, ${toAdd(count)}`,
      backToThemes: 'Back to themes',
      /** A suggestion row: Spanish, then the English. */
      suggestionRow: (es: string, en: string): string => `${es}. ${en}`,
      opensSheet: 'Opens the tagging sheet',
    },
    onboarding: {
      option: (label: string, sub: string): string => `${label}. ${sub}`,
    },
    phrase: {
      markLoved: 'Mark as loved',
      markStillLearning: 'Mark as still learning',
      currentHook: (note: string): string => `Memory hook: ${note}. Tap to change.`,
      useHook: (hook: string): string => `Use hook: ${hook}`,
    },
    refrain: {
      /** The warming card, read as one thing: what to do, the phrase, how automatic. */
      card: (cue: string, es: string, pct: number): string =>
        `${cue}. ${es}. ${percentAutomatic(pct)}`,
    },
    stream: {
      previous: 'Previous',
      next: 'Next phrase',
      skip: 'Skip',
      loveThisPhrase: 'Love this phrase',
      queueRow: (es: string, en: string, difficulty: string): string =>
        `${es}. ${en}. ${difficulty}.`,
    },
    progress: {
      /** Seven bars as ONE group: seven cells would read as seven meaningless letters. */
      weekSummary: (practisedDays: number): string =>
        `Last seven days: practised on ${practisedDays} of them.`,
      trickyRow: (label: string, count: number): string => `${label}, ${count} phrases`,
      trickyHint: 'Drills exactly these phrases',
    },
  },
} as const
