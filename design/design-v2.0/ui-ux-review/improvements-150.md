# Loro rapid UI prototype (v2.0): 150 improvements

## Context

`design/design-v2.0/rapid-ui-prototype` has been through two review rounds
(`design/design-v2.0/ui-ux-review/README.md`). Both rounds are implemented, and 36 state tests, `tsc` and
the build pass. I read every source file and the round-2 screenshots. The list below covers what is
still wrong, what should change, and what is missing. Everything was checked against the code; file
references are relative to `rapid-ui-prototype/src/`.

**How to edit.** Each item has a checkbox, a type (**Bug** / **Change** / **Add**) and a priority:
**P1** means do it next, **P2** means soon, **P3** means later or optional. To approve an item, tick it
(`[x]`). To drop one, delete it or strike it through. Write your answers under an item as you did in
the review README. Once you approve, I'll implement the ticked items in priority order.

---

## A. Learning loop and memory model (1–20)

1. [ Skip ] **Bug · P1**: You can rate a phrase before trying it. Hard/Easy work during repetition 1's English step, before the learner has said anything (`screens/NowPlayingScreen.tsx:246`, `RATE` in `state/machine.ts:331`). Keep the buttons visible but disabled until the first "Your turn" of this play has finished.
2. [ 3 buttons ] **Change · P1**: "Hard" works like FSRS "Again". It cuts stability ×0.25 and un-learns the phrase (`state/memory.ts:97`). In FSRS, Hard means "recalled with effort" and still grows the interval. Either rename the button to *Missed* or add a third grade: Missed / Hard / Easy.
3. [ Points earns per phrases listened in 5 minuts interval. Not a day ] **Bug · P1**: Points can be farmed by listening passively. Each repetition pays +1 with no limit, so a looping queue keeps earning (`recordRepetition`, `machine.ts:194`). Cap repetition points per phrase per day, or pay them only while the phrase is new or due.
4. [ Pay rating points only when the phrase is new or 5 minutes window ] **Bug · P1**: Re-rating can be farmed too. Restarting a phrase and rating Easy pays +3 each time, even though stability barely moves (`machine.ts:331`). Pay rating points only when the phrase is new or due.
5. [ Skip this ] **Change · P2**: An unrated play never feeds the schedule. A phrase heard 30 times stays "Listened, not rated". At the end of the last repetition, if the phrase is still unrated, hold briefly on the rating ("Rate or skip") before moving on. Make this a setting.
6. [ Implement ] **Add · P2**: Relearning within the session. A phrase rated Missed/Hard is due in 10 minutes but never comes back in the current queue. Put it back 3–5 phrases later.
7. [ Implement ] **Add · P2**: Per-phrase difficulty (FSRS *D*), driven by the hard/easy history, so difficult phrases grow more slowly than easy ones. Right now every phrase grows at the same rate.
8. [ Impelement ] **Change · P2**: "Learned" is reached after 3 on-time Easy ratings over about 13 days (4d → 9.2d → 21.2d). Confirm this definition, or require N successful reviews as well as 21 days of stability.
9. [ Make a pause to rate and continue playing phrases. The playing phrases can be in 2 mods, 1 - repeat the album 2 - continue to other phrases ] **Add · P2**: A daily limit on new phrases, so the review load can't snowball. Reviews come before new phrases.
10. [ Implement ] **Change · P2**: "Play review" loads every due phrase × 3 repetitions. Cap a session (for example 10 phrases) and show a real duration when the durations have been measured.
11. [ Implement ] **Change · P2**: Make repetitions adaptive: 3 for new or missed phrases, 1 for learned reviews. The global 1×/3× toggle stays as an override.
12. [ Skip ] **Add · P2**: A "more time to answer" setting that scales the pause (currently 1.3× + 600 ms, clamped 1.5–8 s in `audio/usePlaybackDriver.ts:17`). Missed phrases should also get a longer pause next time.
13. [ Implement ] **Bug · P2**: The measured target length includes the speech engine's start-up delay, and each play overwrites it (`speech.ts:80`, `machine.ts:205`). Keep a running median and ignore outliers.
14. [ Skip ] **Add · P1**: "I've said it". A tap during *Your turn* skips to the target at once, so easy phrases don't wait out the whole silence.
15. [ Skip ] **Add · P3**: Loop variants: *shadowing* (target → pause → target) and *comprehension* (target → pause → native), chosen per session.
16. [ Implement ] **Change · P2**: The Library's "Recall now" average includes phrases rated 10 minutes ago, which pulls it towards 100%. Either count only reviewed phrases or label what it covers.
17. [ Skip ] **Add · P2**: A real review history in phrase details: every rating with its date, the current stability, and the next due date.
18. [ Skip ] **Add · P3**: Gentle due reminders (web push or PWA) with copy that never shames a missed day, following the Loro non-negotiable.
19. [ Implement ] **Change · P2**: The first Easy always gives 4 days, even for a phrase heard once. Consider 1 day for a first-time Easy and 4 days only after 2+ plays.
20. [ Implement ] **Add · P2**: A session summary when a queue ends: phrases played, ratings given, points earned and next due, all from state.

## B. State machine and architecture (21–36)

21. [ Implement, rating has window 5 minutes, only after this window we add hard/easy rates and listing points ] **Bug · P1**: The rating result is computed twice. The screen calls `applyGrade` for the chip, then the machine calls it again (`NowPlayingScreen.tsx:56–68`). Store `lastRating {grade, points, bonus, stabilityDays}` in state and have the UI read it.
22. [ Implement ] **Bug · P1**: `RESTORE` accepts any object without cleaning it (`machine.ts:425`). Route it through `parseState` sanitising.
23. [ Implement ] **Change · P2**: Write the player as an explicit statechart: a table of states × events with allowed transitions. Illegal events become visible, and the chart can be exported as a diagram for the docs.
24. [ Implement ] **Change · P1**: History is trimmed at 500 entries while points are stored separately (`machine.ts:20,186`). After trimming, points can no longer be checked or rebuilt. Keep a compact append-only review log and treat points as derived.
25. [ Implement ] **Change · P2**: History entries have no unique id and no device id. Both are needed to merge and de-duplicate on sync.
26. [ Implement ] **Change · P2**: Phrase memory is keyed by `phraseId` alone. Key it by language pair too, ready for more than one course.
27. [ Implement ] **Bug · P2**: Shuffle is global and saved. Starting a set from Home silently shuffles it if shuffle was left on earlier (`machine.ts:229`). Reset it on each new `LOAD`, or show it clearly.
28. [ Implement ] **Bug · P3**: `JUMP` always starts playback, but `NEXT`/`PREV` keep the paused state (`machine.ts:327`). Pick one rule.
29. [ Implement, as i described before, it has loop mode on one set and continue explore mode ] **Change · P2**: *Next* is disabled on the last phrase. Allow it to end the queue and open the summary (item 20).
30. [ Implement ] **Change · P2**: The player re-renders completely 4 times a second (`useNow(250)`, `NowPlayingScreen.tsx:27`). Move the timer into a small component of its own.
31. [ Implement ] **Change · P2**: The whole state, history included, is written to localStorage on every phase change (`state/store.tsx:50`). Debounce the writes and flush on `visibilitychange`/`pagehide`.
32. [ Implement ] **Add · P1**: Navigation state (tab, open set, overlay) is not in the URL. A refresh loses your place, and browser or Android Back leaves the app instead of closing the player. Add hash routing with History API entries for the overlays.
33. [ Implement ] **Add · P1**: Validate content at runtime (for example with zod) and add a content test: unique ids, every `set.phraseIds` entry exists, each phrase belongs to exactly one set, and every language and topic is known. Right now `content/index.ts:64` only casts.
34. [ Implement ] **Change · P2**: A phrase's set is recorded twice, in `phrase.setId` and in `set.phraseIds`. Keep one source and derive the other.
35. [ Implement ] **Change · P3**: `Navigation` is rebuilt on every render and passed through props (`App.tsx:97`). Move it into a context with stable callbacks.
36. [ Implement ] **Change · P3**: Store the content version in `AppState`, so migrations know which content a save was made against.

## C. Audio and playback (37–52)

37. [ Skip ] **Add · P1**: Put an `AudioSource` interface in front of `audio/speech.ts` and support recorded clips: `audio.target` and `audio.native` URLs in content, played with `HTMLAudioElement`, with the duration read from the file's metadata.
38. [ It will be implemented on the backend ] **Add · P1**: Generate reference clips for all 26 phrases, for example with the main repo's `content:render` pipeline and pinned voices. Store them locally so every device sounds the same and the prototype works offline.
39. [ Will be implemented on the backend ] **Bug · P1**: When there is no exact match, the voice picker falls back to any `es-*` voice (`speech.ts:28`), so Castilian content can play in a Mexican voice. Warn, or require the exact region.
40. [ skp ] **Add · P2**: A voice picker in settings for the target and native languages, until recorded audio replaces device speech.
41. [ Will be implemented on backend ] **Bug · P2**: On a cold start, `getVoices()` can be empty, so the first utterance plays with `voice = null`. Wait for `voiceschanged`, with a timeout, before the first `speak`.
42. [ Implement ] **Add · P1**: Support the Media Session API: lock-screen title and artwork, play/pause and next/previous, including headset buttons. This is the core of an eyes-free, Spotify-style experience.
43. [ Fix this ] **Bug · P2**: A `timeout` result counts as a success and pays repetition points (`usePlaybackDriver.ts:49`), which contradicts "no points without audio". Decide how timeouts should work.
44. [ fix ] **Bug · P2**: Background tabs, a locked screen or a phone call can kill speech while the state still says `playing`. On `visibilitychange`, pause cleanly.
45. [ Apply to both ] **Change · P2**: Speed applies to the native prompt as well. Learners usually want only the target slowed down. Apply speed to the target, or offer separate controls.
46. [ Apply ] **Add · P2**: Short, fixed gaps between phases and between repetitions (for example 300 ms). They currently run back to back.
47. [ Make some sound for turn ] **Add · P1**: A soft audible cue when *Your turn* starts, so the learner knows to speak without looking at the screen.
48. [ Implement ] **Change · P2**: The Hard cue is a falling sawtooth "error" buzz (`audio/feedbackSounds.ts:28`). That's a punishing tone. Use a neutral, soft cue.
49. [ Skip ] **Add · P3**: Optionally record *Your turn* and play it back, on the device only. Recorded audio never leaves the device, following the Loro non-negotiable.
50. [ Implement ] **Add · P2**: Preload the next phrase's clips once recorded audio exists.
51. [ Skip ] **Add · P3**: Normalise loudness between the native and target clips.
52. [ Skip ] **Add · P3**: A sound and haptics switch in settings. There is no way to mute the cues today.

## D. Content and data (53–70)

53. [ Implement ] **Bug · P1**: Only the 6 Café phrases have notes. The other 20 have none, so the notes UI never shows on most sets. Write notes for all 26, or make it clear that notes are optional.
54. [ Implement ] **Bug · P1**: The notes aren't accurate enough and are too flowery. For example, phrase 1's grammar note says «me pone» translates literally as "Does your honor put/serve me". Rewrite every note in one or two plain sentences and have a native speaker review them.
55. [ Implement ] **Change · P1**: A bilingual review of all 26 phrases and translations: register (*jefe*, *tú* vs *usted*), Castilian vs Latin American usage, and naturalness.
56. [ Implement ] **Bug · P2**: "Una caña bien tirada, jefe" (a beer) is in the morning-café set *Café & Mañanas*. Move it to Tapas.
57. [ Implement ] **Change · P2**: The ids are inconsistent (`phrase-1` next to `tapas-1`). Use one stable pattern, such as `cafe-01`, and migrate saved state.
58. [ Implement ] **Add · P2**: Content fields for `register` (formal/informal), `region`, a `literal` word-by-word gloss, and `audio`/`durationMs`.
59. [ Implement ] **Add · P2**: Tap a word in the revealed phrase to see its gloss (needs item 58).
60. [ Implement ] **Add · P1**: Your own phrases (you mentioned "all the phrases the user created"). An *Add phrase* flow for native and target text, stored in learner state rather than content, and played with TTS.
61. [ Implement ] **Add · P2**: Your own sets. Group your phrases and saved phrases into sets. *My sets* would then mean sets you made, not sets you hearted.
62. [ Implement ] **Change · P2**: Move the profile (name, native language, target language) from `content/profile.json` into learner state, so it can be edited.
63. [ Implement ] **Add · P2**: A second course, for example Bulgarian or Russian (the main app supports es/bg/ru), to prove the model works for more than one pair. Check that Newsreader and DM Sans cover Cyrillic.
64. [ Implement ] **Add · P2**: Levels (A1/A2/B1) on sets, and an order for beginners.
65. [ Will be implemented later, create a plan for this ] **Add · P2**: A stress fixture (for example 30 sets and 500 phrases) to test scheduling, search and layout at scale.
66. [ Skip. Will be implemented on backend] **Change · P2**: With only 3 tones, several sets share a colour (Café and Sobremesa are both *primary*). Give each set its own accent colour or pattern.
67. [ Implement ] **Change · P2**: Move all UI strings into one copy module, as the main app does with `copy.ts`, so the UI can follow the native language.
68. [ Implement ] **Change · P3**: Set subtitles and topic names are English-only. Localise them per native language.
69. [ Implement ] **Add · P3**: Phrase tags (for example politeness, question, numbers) for search and filtering.
70. [ Implement ] **Change · P3**: Topics with a single set (Café, Shopping, Small talk) feel thin. Merge them, or add sets.

## E. Now Playing (71–86)

71. [ Implement ] **Bug · P1**: At 390×844 the transport and speed controls sit below the fold (see `r2-player.png`), so you have to scroll to reach Pause. Shrink the cover (about 26 dvh) and keep the transport visible without scrolling.
72. [ Undo / change the rating with 5 minutes widnow] **Add · P1**: Undo a rating for about 5 seconds after it's given. Mis-taps are easy with two large buttons.
73. [ Implement ] **Change · P1**: Shuffle is in both the player and the set page. That's two controls for one job, which breaks the round-1 rule. Keep it only on the set page and in the queue.
74. [ Skip ] **Change · P2**: The repeat icon with a small "3×" badge is ambiguous (`NowPlayingScreen.tsx:314`). Put *Repetitions 1 · 3* next to speed, either as a segmented control or in a player settings sheet.
75. [ Implement ] **Change · P2**: The notes chips expand inline and push the transport down. Open notes in a sheet instead.
76. [ Implement ] **Bug · P2**: When paused, every step pill looks inactive (`NowPlayingScreen.tsx:205`). Show the current step as paused rather than idle.
77. [ Implement ] **Change · P2**: The set title shows twice, in the header and on the large cover. Keep one.
78. [ Implement ] **Add · P2**: Show the queue position ("3 of 6") under the header title.
79. [ Skip, will be implemented on backend ] **Change · P2**: "Device voice · Eddy (Spanish (Spain))" has nested brackets. Show "Voice: Eddy · es-ES".
80. [ Like should be for phrase where all liked phrases stored and for album save album or like album] **Change · P2**: The heart saves a phrase in the player but likes a set on the set page, so the same icon means two things. Use a bookmark for phrases.
81. [ Implement ] **Add · P2**: Swipe the cover left or right for next/previous, matching the mini-player.
82. [ Skip ] **Add · P2**: Give the audio-error message actions, *Choose voice* and *Skip phrase*. At the moment it only explains the problem.
83. [ The per phase timer is for full audio play at x1 ] **Change · P2**: Decide what the per-phrase timer ("0:13") is for. It is real but tells the learner little. Move listening time to the session summary.
84. [ skip ] **Add · P3**: An optional "Always show text" mode for beginners or for accessibility. The default hides the answer until it's heard.
85. [ Implement ] **Change · P3**: The reserved rating area (`min-h-[76px]`) and the "Rated — back in" line jump vertically (`mt-6`). Stop the layout from shifting.
86. [ Implement ] **Change · P3**: The redaction bar's width comes from character count × 2.4% (`NowPlayingScreen.tsx:144`), and long phrases clamp to 100%. Measure the text width instead, so the bar hints at the length honestly.

## F. Home (87–96)

87. [ Implement ] **Bug · P2**: The greeting is always "¡Hola, Clara!" in Spanish. Build it from the profile and the target language.
88. [ Implement ] **Change · P1**: *Keep going → Play 6 phrases* plays the whole set, learned phrases included. Play only the new, learning and due phrases.
89. [ Implement ] **Change · P2**: When anything is due, the *Keep going* suggestion disappears (`screens/HomeScreen.tsx:41`). Show Review as the main action and Continue as the second.
90. [ Implement ] **Bug · P2**: "Next: 1 phrase Mon 05:02 PM" uses a 12-hour clock with a leading zero, and the format depends on the locale. Use relative time ("in 4 days") and add the clock time only when it's today.
91. [ Implement ] **Change · P2**: *Jump back in* repeats the set already suggested in *Keep going*. Leave it out.
92. [ Implement ] **Change · P2**: The *Sets* shelf repeats Explore's *All sets*. Replace it with "Not started yet", or remove it.
93. [ the history should list history of played albums ] **Change · P2**: The History sheet lists raw events ("Listened" 3 times per phrase). Group it per phrase and per session.
94. [ Implement ] **Change · P2**: "Learned 0 of 26" counts all content, so the number moves whenever content is added. Consider "Learned" and "Started" instead.
95. [ Implement ] **Add · P3**: A gentle "Today" line (phrases heard and rated today). It shows real numbers only, has no streak and never shames a missed day.
96. [ Implement ] **Add · P2**: A first-run empty state with a 20-second demo of the loop on one phrase (see item 118).

## G. Set page (97–104)

97. [ Implement ] **Bug · P2**: *Play* uses the current sort order without saying so (`screens/SetScreen.tsx:60`). Label it, for example "Playing: Due first".
98. [ Implement ] **Add · P2**: *Play due and new only*, next to *Play all*.
99. [ Implement ] **Add · P2**: Per-phrase *Play next* and *Add to queue* in the details sheet. At the moment only whole sets can be queued.
100. [  Implement ] **Change · P3**: The chosen sort resets every time the set page opens. Remember it per set.
101. [ Implement ] **Change · P2**: *Share* only copies "Title — subtitle". Once routing exists (item 32), share a deep link.
102. [ The heart can add the phrase to liked phrases or to album ] **Change · P2**: The set heart says "Add set to your library", but the Library tab is called *My sets*. Use one wording (see item 61).
103. [ Implement ] **Add · P3**: Show a real set duration once all its clips have been measured (or once recorded audio exists). Never show an estimate.
104. [ Skip] **Add · P3**: Long-press a phrase row for quick actions.

## H. Queue (105–111)

105. [ Implement ] **Change · P1**: The *Now playing* row in the queue shows the Spanish during recall (round-2 open question 1). Hide it while the target is hidden, following the loop rule.
106. [ Implement ] **Bug · P2**: A tap on a *Previously played* row replaces the whole queue without warning (`screens/QueueScreen.tsx:123`). Make it *Play next*, or ask first.
107. [ Implement ] **Add · P2**: Undo *Remove* with a snackbar.
108. [ Implement ] **Change · P2**: The header counts every phrase in the queue, played ones included. Show "N left".
109. [ Implement ] **Add · P2**: *Clear queue* and *Save queue as set* (needs item 61).
110. [ Implement ] **Change · P3**: `aria-description` is non-standard (`QueueScreen.tsx:203`). Use `aria-describedby`, and announce the new position after a keyboard move.
111. [ Implement ] **Add · P3**: Distinguish *Play next* (insert after the current phrase) from *Add to end* in `ENQUEUE`.

## I. Explore (112–117)

112. [ Implement ] **Change · P2**: Picking a topic tile doesn't bring the results into view. They sit below the fold. Scroll to them, or show the filtered sets in place of the tiles.
113. [ Implement ] **Change · P2**: Topic and search combine without saying so. Show an active-filter chip with ✕.
114. [ Implement ] **Add · P2**: Highlight the matched text in results, and search notes and topic names too.
115. [ Implement ] **Add · P2**: A status badge on set cards (*New* / *In progress* / *All learned*) and a quick-play button.
116. [ Implement ] **Bug · P2**: The Explore state (search text and topic) is lost when you open a set and go back, because the component unmounts. Keep it.
117. [ Implement ] **Add · P3**: Browse by level (needs item 64).

## J. Library and progress (118–124)

118. [ Implement ] **Add · P2**: Phrase-status filters: *Due*, *Learning* and *Missed recently*, alongside *Saved* and *Learned*.
119. [ Implement ] **Add · P2**: *Play all* for Saved phrases and for each filter.
120. [ Implement ] **Add · P2**: Retention buckets in a small chart (how many phrases are at 90–100%, 80–90% and so on), drawn from state and checked for real rendering.
121. [ Implement ] **Add · P3**: A chart of phrases learned per week from the review log (needs item 24).
122. [ Implement ] **Change · P2**: At 390 px the three stat cards with 11 px notes are cramped. Use two lines, or move the notes into a tooltip or sheet.
123. [ Remove the export progress it will be stored on the backend and sync automatically] **Add · P2**: Export and import progress as a file from settings (`parseState` already sanitises). Right now you can only copy to the clipboard.
124. [ Implement ] **Add · P3**: Tap a stat to open the phrases behind it, for example Learned → the Learned list.

## K. Shell, navigation, settings and onboarding (125–134)

125. [ Implement ] **Add · P1**: Onboarding: choose the native and target languages and your name, check that a voice is available **before** the first play, and explain the loop in one screen.
126. [Skip  ] **Add · P1**: Learner settings: default repetitions, pause length, speed, "always show text", voice, sounds and haptics.
127. [ Implement ] **Change · P2**: Move *Copy JSON* and *Reset* into a *Developer* section.
128. [ Implement ] **Change · P2**: Replace `window.confirm` for Reset (`components/SettingsSheet.tsx:21`) with an in-app confirmation sheet.
129. [ Implement ] **Change · P2**: The error boundary's only option wipes all progress (`App.tsx:64`). Offer *Copy progress JSON* before *Reset*.
130. [ Implement ] **Change · P2**: Switching tabs loses each tab's scroll position. Keep it per tab.
131. [ Implement ] **Change · P2**: The set page's header shows only a Back arrow. Show the set title once the page scrolls.
132. [ Implement ] **Add · P2**: Make it a PWA: manifest, icons and a service worker so it installs and works offline.
133. [ Implement ] **Change · P2**: Serve fonts and icons locally. Google Fonts and the full variable Material Symbols font (several MB) are loaded at runtime (`index.html:14–16`). Subset the icons.
134. [ Implement ] **Change · P2**: Replace `floatingChip`'s direct DOM changes (`lib/feedback.ts`) with a React toast component, and keep the single live region.

## L. Visual design and polish (135–142)

135. [ Implement ] **Bug · P1**: Icon sizes (round-2 open question 3). Most `text-[Npx]` icon sizes never apply. Fix it once in CSS (`index.css:77` sets `font-size: 24px` outside a layer) so transport icons render at their intended 34–40 px.
136. [ Skip ] **Add · P2**: Dark mode. Evening listening is a core use. Add dark tokens next to the light ones in `index.css:3`.
137. [ Implement ] **Change · P2**: Hex colours are repeated in `index.html` (body class) and `@layer base`. Use the tokens only.
138. [Implement ] **Change · P2**: Font sizes are ad hoc (`text-[13px]`, `[15px]`, `[28px]` …). Define a type scale.
139. [ Implement ] **Change · P2**: *Hard* uses the error palette, which reads as failure. Give it a neutral tone and keep the icon.
140. [ Implement ] **Change · P2**: The page fade uses `mode="wait"`, which adds about 150 ms to every navigation (`App.tsx:131`). Switch tabs instantly and slide the set page in.
141. [ Implement ] **Change · P3**: The covers (round-2 open question 2). Decide between drawn covers and local photos with no text.
142. [ Implement ] **Add · P3**: A layout for tablets and landscape, such as a two-column player. Everything is currently capped at `max-w-lg`.

## M. Accessibility (143–146)

143. [ Implement ] **Change · P2**: The live region announces every step of every repetition (9 announcements per phrase). Offer a quieter mode that announces only *Your turn* and the reveal.
144. [ Implement ] **Bug · P2**: The player and sheets use `outline-none` on containers. Make sure every control has a visible `:focus-visible` ring.
145. [ Implement ] **Add · P2**: Add `lang` to the native text (it assumes `en`), so it stays correct when the native language changes.
146. [ Implement ] **Add · P2**: Run an automated axe check on every screen at 390×844 and at 200% text size.

## N. Persistence, sync and tooling (147–150)

147. [ Implement ] **Change · P1**: `saveToServer` PUTs the whole state (`state/persistence.ts:130`), so the last write wins and erases progress from another device. Design a merge (per-phrase memory by `lastReviewedAt`, a union of review logs) that follows the main app's sync field-merge classes.
148. [ Implement ] **Bug · P2**: Two open tabs overwrite each other's saved state. Listen for the `storage` event, or take a lock. Consider IndexedDB as history grows.
149. [ Implement ] **Add · P1**: Add tests beyond the reducer: Playwright E2E of the loop with fake speech (queue, search, library at 390×844), unit tests for `usePlaybackDriver`/`pauseMs`/`progressLabel`, and property tests for the machine's invariants. Also add ESLint (`react-hooks`, `jsx-a11y`) and a single `npm run check`.
150. [Implement  ] **Change · P1**: The whole prototype is untracked in git (`?? rapid-ui-prototype/`, and `src/.DS_Store` exists). Commit it without `node_modules`/`dist` so each review round is versioned. Before any of it reaches the main app, record the v2.0 decisions (Set/Phrase vocabulary, the loop, points) in `docs/` and run FSRS through `core-rs` WASM instead of the simplified `state/memory.ts`.

---

## After approval: how I'll execute

- Work in `design/design-v2.0/rapid-ui-prototype` only. The authored v1.1 design package and the main app are untouched unless an item says otherwise (item 150).
- Ticked P1 items go first, grouped by area. Each group is one coherent commit, and state, content and UI changes go in separate commits.
- Every new learner number goes through `state/selectors.ts`. Anything that can't be measured is not shown.
- I'll add a "Round 3" section to `ui-ux-review/README.md` covering what changed, with screenshots.

## Verification

- `npm test` (state, persistence and selectors, plus any new tests), `npm run lint`, `npm run build`.
- In the browser at 390×844 with Playwright MCP: run the loop end to end (rating disabled until *Your turn*, skip-pause, undo rating, the queue hides the target, transport visible without scrolling), and check that no control is under 44 px, no text is under 11 px, and no remote requests are made once fonts are local.
- Reload mid-queue, and use browser Back to close the player (item 32).
