# UI/UX review — Loro rapid prototype

**Date:** 2026-09-24
**Scope:** `design/design-v2.0/rapid-ui-prototype`, reviewed in source and in the browser at iPhone size (390×844).
Review only — no changes were made to the prototype.
**Goal under review:** a phrase-based language-learning mobile app with a Spotify-like UI.

## Verdict

The Spotify model fits a phrase-learning app: phrases are tracks, sets are albums, and study is
listening. The prototype copies Spotify's look well, with a mini-player docked above the tabs, a
full-screen player, a queue, album-style pack pages and shelves. It copies the look more than the
workflow, though. Spotify is fast because it has **one obvious action per screen, very little text,
and no jargon**. This prototype has a large vocabulary (Circadian Waves, Cadence Run, Acoustic
Recall, Earworm Codex, Spaced Interval, Heavy Rotation, Archival Notebook…) and 3–5 competing
controls in most areas. A new learner won't know what to press.

The main idea of the app is that the user listens to the phrases and repeats them. The vocabulary should be structured as JSON objects stored separately and the state should be managed by a state machine so it can be easily copied and saved to the server. Also we need to simplify the workflow so the user and learner know where to press.

## What works

- **Mini-player placement and behaviour.** It sits right above the tab bar, you swipe it for the
  next or previous phrase, and tapping it opens the full player. This is the strongest Spotify
  pattern in the prototype, and it's executed well.
- **The full-screen player's structure.** Cover art, phrase title, speaker line, scrubber,
  transport controls, and pull-down to close are all familiar right away.
- **The pack page as an album page.** Artwork, meta line, action row, big play button, then the
  list of phrases.
- **Queue with Up Next and Previously Played.**
- **Visual style.** The warm paper palette, serif italic for Spanish and sans for English give it
  an editorial feel that isn't a Spotify clone. Keeping the two languages in different fonts is a
  good idea: Spanish always in serif italic, the translation in sans.
- **Tactile feedback.** Taps, chimes and haptics make it feel physical.

## The big problems

### 1. It's a music player, not yet a learning app

Nowhere does the learner speak, recall or produce anything. The only learning act is tapping
**Hard/Easy**, and it appears in three places: the player, a floating dock on the pack page, and
implied on the phrase cards. The player shows **Easy already selected** before you've heard
anything. Rating while passively listening measures nothing. Rating should come after a recall
moment (hide the translation → reveal → grade), not float beside the transport controls.

Right, hard and easy should indicate the learning curve and it points to the user's activity and to the pace of the learning curve. Also the player should not be selected before hearing anything.

I agree that a rating should come after a recall moment but hiding the translation, revealing, and grading is not necessary because a user should first hear the phrase in the native language and then try to say it while it plays silence. After that the learning language is repeated. The great buttons should always be shown above the player before the user clicks them and appear after the next phrase is played.

### 2. There is no single clear action on Home

At the top it shows the greeting, 3 stats, 3 wave cards, Jump Back In, Heavy Rotation and an
insight card. Spotify's Home has one idea: *play something now*. Here, "14 phrases due" and "Ride
Wave" should be one large main button above everything else, something like
**"Today · 14 phrases · 4 min ▶"**. Everything else is secondary.

Let's skip that for now.

### 3. Jargon and the number of names

Waves, Packs, Decks, Earworms, Cadences, Drills and Sets all mean roughly "a group of phrases."
Pick two terms, for example **Set** (album) and **Phrase** (track). The same goes for the stats:
"Cadence Run: 38 Reps Spaced", "Acoustic Recall", "1,480 Beats" and "4 Zones" don't tell a
learner anything useful.

Let's change the naming.

### 4. Invented numbers

Examples are "72% Recall", "94% Retention", "14,890 scholars", "100% Spontaneous recall", "Rank V",
the BPM figures and a 1:12 duration for a phrase that takes 1.5 seconds to say. This breaks a Loro
rule: every number a learner sees has to be real (see the root `CLAUDE.md`). The ones that are
clearly made up also make the whole UI feel less trustworthy.

Right every number should be real and it should come from the state machine.


### 5. Too many buttons for one job

- **Speed:** a 1.25× toggle in the mini-player, three speed chips in the player, and a speed chip
  on the pack page.
- **Play:** a big play button, a play button on each card, a speaker button on each phrase, the
  Re-drill link, the Slow drill link and the loop button.
- **Rating:** Hard/Easy appears in the dock and in the player.

Each job should have one control in one place.

Agree on this.

## Screen by screen

### Header (all tabs)

- It's mostly empty space: just the avatar and "38 pts".
- The fire icon means *streak*, but the label now says *pts*, so the icon and label say different
  things. Pick one meaning.
- On sub-pages the avatar and the back arrow sit next to each other, which makes the row
  cluttered.

Right we should change the icon from streak to points and points should be all the points across all the phrases the user created. For each listening phrase the user has to obtain 1 point for each card: obtain more points and for each obtain even more points. Keep the learning curve until the user learns the phrase and implement the forgetting curve.


### Home

![Home](home.png)

- The wave cards are 84% of the screen width, and the first one starts flush against the left
  edge.
- Two of the three wave cards are locked or unavailable, so the carousel mostly shows things you
  can't do. Show the next wave as one line, "Next: 13:00 · unlocks in 4h", instead of a card.
- The Jump Back In titles are cut off ("Café Cu…", "Tapas C…"), so the 2-column grid is too narrow
  at phone width.
- The insight card at the bottom is filler.

I agree. Implement this.

### Now Playing

![Now Playing](nowplaying.png)

- The mnemonic panel opens by default and covers the cover art.
- The metre tag appears twice.
- The dialect badge is empty, showing only a flag, because `phrase.dialect` isn't in the data.
- The time shows as **"0:72"**.
- The progress bar ticks once a second, which doesn't match phrases that last a few seconds. For
  phrase audio, show "repetition 2 of 3" instead of a scrubber.
- The 💡📖🗣️ emoji buttons clash with the Material icons used everywhere else.
- The whole screen closes when you drag it down, and the content inside it also scrolls
  vertically, so dragging can close it by accident. Only the top handle should close it.

I agree. The mnemonic panel shouldn't be open by default. The meter tag should appear once. The dialect page should show only the phrase and the language.
The timing should show real time.
And right, it should be not ticks but repetitions.
Right, replace emoji buttons with icons.
And agree that only the top handle should close the screen.

### Pack page

![Pack page](pack.png)

- The title reads "Cadence Pack Detail", a developer label.
- The bottom tab bar disappears; Spotify keeps it on album pages.
- The floating Hard/Easy dock plus the mini-player cover about 140px, a sixth of the screen,
  including the phrase list.
- Each phrase card holds a lot: category, metre, Spanish, a phonetic spelling, English, a
  retention bar, rank, a speaker button, a chevron and an expandable section. A Spotify track row
  is two lines. Put the rest in a phrase details sheet. // Agree, fix that.
- "Sort by Meter" does nothing.  agree. Adjust this
- The ↗ button labelled "More options" actually opens the player. Agree, fix this.
- "Spaced Interval" is a switch with no explanation. Agree, remove this.

### Queue

![Queue](queue.png)

- The current phrase also appears in Up Next (02 is listed twice), and the header says 6 phrases
  when there are 5 unique ones. 
- Reordering uses the browser's drag-and-drop, which **doesn't work with touch**, so it's broken
  on phones.  right, fix this
- Each row has three small icons plus two swipe actions. On phones, keep the swipe actions and the
  drag handle, and remove the ✕ and the speaker icon. Right, fix this.

### Explore

![Explore](explore.png)

- There are two titles, "Explore" and "Cadence Dialect Map". Fix this
- The search box and the filter chips do nothing. Fix this 
- Every set opens the same "Café & Mañanas" page. Fix the right set
- Grouping by dialect region is interesting but advanced. Spotify's Search tab is a grid of
  colourful category tiles; for learners, topic tiles (Café, Travel, Work, Small talk) would be
  more approachable.  Right implement this 

### Library

![Library](library.png)

- The four stat cards are made up. Use the state machine to show real numbers.
- The Mastered section shows the first three phrases with "100% Retained". Use the state machine to show real retention.
- Spotify's Library is a filterable list (Playlists · Albums · Liked). Here the useful version
  would be **Saved phrases · My sets · Downloaded**. There's a heart and a bookmark ("Save to
  Codex") on the player, but nothing in Library lists what they saved. Fix this 

## Bugs found

| Where | Bug | Source |
|---|---|---|
| Player | The **shuffle** button goes to the previous phrase instead of shuffling | `src/screens/NowPlayingScreen.tsx:520-533` |
| Player | The **repeat 3×** button just speaks the phrase once; it's not a loop setting | `src/screens/NowPlayingScreen.tsx:589-605` |
| Player | Time shows as "0:72" | `src/screens/NowPlayingScreen.tsx:511-514` |
| Player | Empty dialect badge (`phrase.dialect` isn't in the data) | `src/screens/NowPlayingScreen.tsx:312-315` | - should be language instead of dialect and show the flag only 
| Player | Phonetics panel shows the same "[uŋ koɾˈta.ðo]" for every phrase | `src/screens/NowPlayingScreen.tsx:383` | - should be language flag
| Player | "Café & Mañanas (Vol. …" typed into the code, with "…" hard-coded | `src/screens/NowPlayingScreen.tsx:138-140` | - use json object for this 
| Player | Easy rating is selected before the learner has rated anything | `src/screens/NowPlayingScreen.tsx:37` | - fix that
| Pack page | The shuffle button also skips to the next phrase | `src/screens/CadencePackDetailScreen.tsx:228-245` |
| Pack page | "PLAYING" shows on the selected phrase even when playback is paused | `src/screens/CadencePackDetailScreen.tsx:428-432` |
| Pack page | "More options" button opens the player | `src/screens/CadencePackDetailScreen.tsx:262-269` |
| Queue | Current phrase is duplicated in Up Next; count is wrong | `src/App.tsx:21`, `src/screens/ListeningQueueScreen.tsx` |
| Queue | Drag-to-reorder uses the browser's drag-and-drop, which doesn't work with touch | `src/screens/ListeningQueueScreen.tsx` |
| Explore | Search and filter chips do nothing; every set opens the same page | `src/screens/ExploreScreen.tsx`, `src/App.tsx` (`handleOpenPack`) |

fix 

## Mobile-specific issues

- **Touch targets below 44pt:** the tab bar is 48px tall with small tab buttons, the mini-player
  controls are 32px, the speed chips and Hard/Easy buttons are about 26–30px, and the queue row
  icons are 28px.
- **No safe-area handling.** The fixed tab bar and header ignore the iPhone home indicator and
  notch areas (`env(safe-area-inset-*)`).
- **The tab bar is a narrow centred cluster.** Native tab bars spread their tabs across the full
  width.
- **Hover effects are used throughout,** but phones have no hover, so that feedback never appears.
- **Text too small to read:** 9–10px labels appear in many places. The minimum should be about
  11pt, and the layout should also work with the phone's larger-text settings.
- **Scrolling animations everywhere:** pulsing dots, pinging badges, scrolling titles and bouncing
  equalisers. On a phone they distract and use battery. Keep only the equaliser on the phrase
  that's playing, and respect the reduce-motion setting.
- **The player speaks phrases with the browser's built-in voice.** That's fine for a prototype,
  but the app must not ship with it.

## Accessibility

- Colour carries meaning on its own: green/orange/red retention bars and orange for "due".
- The Hard/Easy colours (red-orange vs. green) are hard to tell apart for colour-blind users, so
  add icons and text weight as well.
- The emoji buttons are read aloud by screen readers as "light bulb", "book", and so on.
- Several clickable areas are plain elements instead of buttons: pack cards, Library rows and the
  phrase card title area.

## What I'd prioritise

1. **Define the core loop first:** listen → try to recall (play the silence so user can repeat on his own) → play the learning languge phrase  → rate, then build the player
   around it. 
2. **Put one main "Today" action at the top of Home,** and reduce the rest of Home to 2–3 shelves.
3. **Reduce the vocabulary to Set and Phrase,** and remove every invented number. - Right
4. **Make each job one control:** speed lives in the player only;
5. **Simplify phrase rows to two lines,** with details in a sheet. 
6. **Fix the mobile basics:** 44pt targets, safe areas, a full-width tab bar, touch reordering, no
   hover-only feedback.
7. **Fix the bugs:** shuffle, repeat, "0:72", the duplicate in the queue, and the empty dialect
   badge.

## Implementation status — 2026-09-24

Every comment above is implemented in `rapid-ui-prototype`, except the Home "Today" action you
asked to skip. Checked at 390×844 in the browser; `npm test` (16 state-machine tests),
`npm run lint` and `npm run build` pass.

| Comment | What changed |
|---|---|
| Vocabulary as separate JSON | `src/content/{phrases,sets,topics,languages,profile}.json`, typed in `src/content/index.ts`. No progress numbers in content. |
| State machine, copyable, saveable | `src/state/machine.ts` — pure `transition(state, event)`; the whole `AppState` is JSON. Persisted on the device; Library → *Copy JSON*; `saveToServer()` in `src/state/persistence.ts` is the sync seam. |
| Listen → silence → repeat | Player loop per phrase: English prompt → pause sized to the measured Spanish audio → Spanish, repeated 1× or 3×. Steps and "Repetition 2 of 3" are shown instead of a scrubber. |
| Rating | Hard/Easy sit above the transport, never preselected, show the real next interval, hide once used and return on the next phrase. |
| Points + forgetting curve | +1 per repetition, +2 Hard, +3 Easy, +10 once when learned (`src/state/memory.ts`). FSRS power curve; due at 90 % recall; learned at ≥ 21 days stability; a lapse un-learns. Header chip shows total points with a points icon. |
| Real numbers only | Every figure comes from `src/state/selectors.ts`; elapsed time is measured. The invented metre tags were removed ("8 Syll" was also wrong). |
| Naming | Set and Phrase throughout; tabs are Home · Explore · Library. |
| One control per job | Speed only in the player; rating only in the player; one heart (save phrase) in the player. |
| Home | Waves replaced by a Review card and a one-line "Next: …"; Jump back in is one column; filler card removed. |
| Now Playing | Notes closed by default; metre tag gone; language flag only; icons instead of emoji; only the top handle drags to close; shuffle and repeat work. |
| Set page | Real title; tab bar stays; floating rating dock and Spaced Interval removed; two-line rows with a details sheet; working sort; *More* opens Add to queue / Share. |
| Queue | Up next never contains the current phrase; handle-drag reorder works with touch; swipe right plays, left removes; ✕ and speaker removed. |
| Explore | One title; topic tiles; accent-insensitive search over phrases and sets; each set opens its own page. |
| Library | Real stats; Saved phrases · Learned · My sets · Downloaded. |
| Mobile and accessibility | Safe areas; full-width tab bar; every control ≥ 44 px and all text ≥ 11 px (audited on each screen); no hover-only feedback; reduced motion respected; icon text hidden from screen readers; zoom allowed. |

Speech still uses the browser's voices, which the production app must replace with recorded audio.

---

# Round 2 — 2026-09-24

**Scope:** the same prototype after the round-1 changes. I reviewed it in the browser at 390×844
and read every source file. Before this round, `npm test` (16 tests) and `tsc` passed, and every
control was ≥ 44 px with all text ≥ 11 px. The problems were in **whether the loop teaches** and
in a few places where round-1 rules had slipped. Everything below is implemented; comment inline
as before.

![Player during "Your turn"](r2-player.png)

## What was wrong, and what changed

### The loop gave away the answer

During **English** and **Your turn**, the player and the mini-player both showed the Spanish text.
You could read the answer instead of recalling it.

→ Until the Spanish audio starts, the player shows a bar the length of the phrase, and the
mini-player shows the English. Screen readers hear "Spanish hidden until you hear it".

The queue's *Now playing* row still shows the Spanish. Should it follow the same rule?

### Ratings could be farmed

Rating Easy, pressing Previous and rating Easy again doubled stability each time, so four taps
made a phrase "learned" and paid +10 plus +3 per tap.

→ You can still rate once per play, and rate again after restarting, as you asked. Easy now grows
stability in proportion to how much you had forgotten, as FSRS does:
- ×2.3 when rated on time, at 90% recall;
- ×1 when rated again seconds later.

The +10 is paid once per phrase (tested through the state machine, not just the memory model).

### Points without audio

When the device had no Spanish voice, or speech failed, the loop ran through silence and still
paid +1 per repetition. It also saved the error time as the phrase's "measured" length.

→ Playback stops and the player says: *"This device has no Spanish voice, so the phrase can't
play…"*. No points are paid and no measurement is saved. Play tries again.

### Invented content was back

- **Cover art.** The Café cover had a phone mockup with "42 LESSONS — BEGINNER" and invented track
  times. All 32 images were hotlinked from expiring AI Studio URLs.
  → Covers are now drawn locally from content: the topic's colour plus a set icon (for example
  coffee, tapas, metro or taxi). The player's cover also shows the set title. Nothing loads over
  the network except the fonts.
- **Speaker credits.** "Sara Martín & Clara" credited speakers who don't exist, since the audio
  is the browser's voice, and "Clara" is also the learner's name.
  → The player shows the real device voice, for example *Device voice · Eddy (Spanish (Spain))*.
- **Avatar.** It was an Unsplash photo.
  → It's now the learner's initial, and tapping it opens settings.
- **Download.** It toggled a flag that pretended to download.
  → Removed, along with the Library "Downloaded" tab.
- **Hardcoded copy.** "90% recall" and "3 weeks" are now read from `TARGET_RETENTION` and
  `LEARNED_STABILITY_DAYS`. The wrong "recall it three weeks later" is now "expected to last
  21 days or more".
- **"1m ago".** Things that happened seconds ago showed as "1m ago".
  → They now show as "just now".

### Numbers that disagreed

- **Learned counts.** The Learned count and the Learned list used different rules: a learned
  phrase that was due again counted in one and not the other.
  → There's now one rule, `learnedPhraseIds`.
- **Points shown three times.** Points appeared in the header, the Home stats and a Library card.
  → Only the header chip shows them now. Home shows *Learned · Due now*. Library shows
  *Learned · Recall now · Started*. The "Repetitions" card, which repeated points, is gone.

### Home

"Start here" always opened the first set in the content, and only as "Open set".

→ The card now picks the most recent set you haven't finished, or the least-learned one. It plays
directly, for example **Play 6 phrases**.

![Home](r2-home.png)

### Queue

- **Duplicates.** Re-adding a played phrase made *Play now* jump back to the old copy, and
  *Remove* deleted every copy.
  → Both now work by position.
- **Reordering.** Reorder accepted any list with the same ids, so duplicates got through.
  → It now needs the exact same items.
- **Mixed queues.** After adding another set, the queue still said it was playing from the
  first set.
  → A mixed queue is now titled *Queue · N phrases*.
- **Add to queue.** On an empty queue it started playing.
  → It now only queues.
- **Two close controls.** The chevron and *Done* both closed the queue.
  → Only the chevron is left.
- **Gestures only.** Swipe and drag had no keyboard or screen-reader route.
  → On the drag handle, the arrow keys move a phrase and Delete removes it.

![Queue](r2-queue.png)

### Player

- **Speed.** Changing speed restarted the current step.
  → It now applies from the next step.
- **Replaying the last phrase.** At the end of the queue, pressing Play again kept the old timer
  and no rating.
  → It's now a fresh play.
- **Drag to close.** The drag area covered the Close and Queue buttons.
  → Only the grab bar and the title drag the player closed.
- **Notes.** Note buttons sat over the cover.
  → They're now labelled chips under the phrase, shown only when that phrase has notes.
- **Label styling.** The all-caps "PLAYING FROM SET" label is gone. The repetition counter now
  uses the body font instead of monospace.
- **Chime.** The celebration chime played on every Easy.
  → It now plays only when a phrase becomes learned. Easy gives a light haptic.

### Library and Explore

- **Filter chips.** The chips loaded scrolled, cutting off "Saved phrases".
  → There are three tabs now and they fit.
- **Developer tools.** *Copy JSON / Reset* were on the learner screen.
  → They're now under the avatar in settings, and Reset asks for confirmation.
- **Topic tiles.** Explore's fifth tile sat alone in its row.
  → It now spans the row, and every tile shows its set count.

![Explore](r2-explore.png) ![Library](r2-library.png) ![Set](r2-set.png)

### Robustness

- **Saved state.** Old or damaged saved state could crash the app: a removed phrase made
  `getPhrase` throw on start. Saves are now:
  - versioned, with a v1 → v2 migration;
  - cleaned against the content, dropping unknown ids, clamping the index and back-filling
    fields.
- **Error boundary.** If something still fails, a screen offers *Reset progress*.
- **Stuck clicks.** A row removed in the middle of a swipe could leave every click blocked. The
  blocker now always clears.

### Accessibility

- **Focus.** The player, queue and sheets now:
  - move focus in when they open;
  - keep Tab inside;
  - close on Escape;
  - return focus to what opened them.

  The app behind them is `inert`.
- **Live region.** The live region announces step changes only, not the timer every second.
- **Confirmation chips.** Each one now goes through a single live region. With reduced motion
  it stays visible instead of fading out at once.
- **Tabs and radios.**
  - Library and note tabs have `tabpanel`, `aria-controls`, and arrow/Home/End keys.
  - Sort options are radios.
  - Home stats use `dt` before `dd`.
  - The sheet backdrop is no longer a second "Close" button in the tab order.

### Found while fixing: icon sizes never applied

Google's Material Symbols stylesheet sets `.material-symbols-outlined { font-size: 24px }` without
a layer, which overrides Tailwind's size classes. Every `text-[26px]` or `text-[34px]` on an icon
in the app has always rendered at 24 px. The covers now set their size inline. Tell me whether the
other icons should get the sizes their classes intended (bigger transport icons, for example) or
stay at 24 px.

### Cleanup

- **Dependencies.** Removed `@google/genai`, `express`, `dotenv`, `@types/express`,
  `autoprefixer`, `esbuild` and `lucide-react`. Build plugins moved to devDependencies.
- **AI Studio leftovers.** Removed `.env.example`, the Gemini capability in `metadata.json`, the
  README banner, and the `DISABLE_HMR`/`@` alias in `vite.config.ts`.
- **Audio file.** `utils/audioEngine.ts` became `audio/feedbackSounds.ts`, with only the cues
  that are used.
- **Notes content.** Removed the leftover "Wave" and "rhythmic surge" wording, fixed the phrase-1
  IPA so it includes "por favor", and renamed "Madrid Lisp" (Castilian [θ] isn't a lisp).

## Checks

- `npm test`: **36 tests** (was 16), with new `persistence.test.ts` and `selectors.test.ts`.
  Tests read phrase ids from the content, so editing phrases doesn't break them.
- `npm run lint` and `npm run build` pass.
- Browser at 390×844:
  - The Spanish is hidden during English and silence on every repetition.
  - A speed change mid-silence doesn't restart the step.
  - Hiding the Spanish voices stops playback with the message and pays 0 points.
  - Keyboard reorder works in the queue.
  - Escape closes the player and focus returns to the mini-player.
  - Every button is ≥ 44 px and all text is ≥ 11 px on Home, Explore, Library, the set page and
    the player.
  - No remote images load.

## Open questions

1. Should the queue's *Now playing* row also hide the Spanish during recall?
2. The drawn covers replace the photos. Do you want photos back, and if so, which photos? They
   should be stored locally and must not contain invented text.
3. Icon sizes: keep everything at 24 px, or apply the sizes the classes intended?
