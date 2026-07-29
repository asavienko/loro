# Personas and jobs-to-be-done

Derived from the four goals the onboarding actually asks about (`Loro.dc.html:2073–2078`) — _a trip
coming up · real conversations · moving abroad · just curious._ Those four answers are the only
segmentation the product needs, so the personas map 1:1 onto them.

---

## 1. Mara — "A trip coming up" 🧳 · **the primary persona**

**35, product designer, London. Twelve days from landing in Madrid.**

She has done three weeks of a gamified app twice before and quit both times, once at day 19 and once
at day 6. She doesn't want to learn Spanish. She wants to not be the person who points at the menu.

**Jobs**

- Not embarrass myself ordering, checking in, or getting a taxi.
- Know what to say _before_ the moment, not look it up during it.
- Feel measurably ready as the date approaches.
- Have something to fall back on when I panic, with no signal, in a taxi rank.

**How Loro serves her**

- Onboarding seeds a real stream from starter packs — she is never staring at an empty app
  (`Loro.dc.html:180–196`).
- The whole app reorganises around her arrival date: countdown home, daily themed drops that
  escalate from survival basics to "sound local", a lock screen widget carrying readiness all day.
  See [trip-arc.md](trip-arc.md).
- On landing the app **flips**: countdown becomes an offline survival deck reordered by immediate
  need, and Capture moves to the front so she can bank what she hears (`Loro.dc.html:2012–2031`).
- Afterwards, the souvenir screen hands the trip set to long-term spaced review — closing the arc
  into everyday learning.

**Fails her if:** anything requires a network abroad; the countdown reads as guilt rather than
urgency; the survival deck isn't ordered by what she needs _right now_.

**Success looks like:** she used 47 phrases for real and captured 9 new ones (`Loro.dc.html:2044`) —
and she opens the app again three weeks later.

---

## 2. Diego — "Real conversations" 💬

**28, engineer, Berlin. Partner is Colombian; her family visits twice a year.**

He can read Spanish adequately and understands maybe half of what's said at the dinner table. His
problem is production under social pressure: the sentence assembles in his head about four seconds
too late.

**Jobs**

- Make the phrases I already _know_ come out without thinking.
- Stop translating in my head mid-sentence.
- Handle small talk and the "so what do you do?" round without freezing.
- Sound less like a textbook.

**How Loro serves him**

- **Loop B, the Daily Refrain** is built for exactly this: five phrases, rotating manner each rep
  (Echo → Chorus → Speed → Cloze → Call → Cold), and what moves on screen is _effort dropping_ —
  latency falling, the card visibly warming, then locking in (`Loro.dc.html:1404–1538`).
- The roleplay scene coaches him toward how locals actually say it, not just what's correct
  (`Loro.dc.html:2917` — _"Perfecto — short, and exactly how locals order."_).
- The prosody lab strips its cues as he improves: text → meaning → cold. The removal of help _is_
  the reward (`Loro.dc.html:1254–1258`).

**Fails him if:** the app treats recognition as mastery. His whole problem is that he recognises
everything and produces nothing.

---

## 3. Ana — "Moving abroad" 🌍

**41, relocating to Valencia with two kids in four months.**

The widest surface area of any persona: school forms, landlords, pharmacies, neighbours, plumbers.
She needs volume and she needs it organised.

**Jobs**

- Cover many scenarios fast, in the order life will hit me with them.
- Retain hundreds of phrases over months, not days.
- Import the vocabulary my actual life generates — the school letter, the rental contract.
- Track which whole _areas_ are weak.

**How Loro serves her**

- **Loop A** is her loop: spaced repetition over a growing library, with the forgetting-curve view
  making the long game legible (`Loro.dc.html:960–1043`).
- Import mode: paste a list, a menu, an itinerary, or `Spanish — English` pairs
  (`Loro.dc.html:278–299`), and Capture (photograph a sign or letter) once she's in country.
- Scenario building — "Hotel check-in", "Getting un-lost" — assembles a coherent set in one tap.
- The progress screen's "What's tricky in your stream" rolls her tags up so she can drill a whole
  weakness, not a single card (`Loro.dc.html:1842–1857`).

**Fails her if:** the library gets unmanageable past ~300 phrases, or review load spikes and she
falls behind permanently.

---

## 4. Sam — "Just curious" 🪶

**22, student, no deadline, no plan.** Will churn unless the first session is delightful and every
subsequent one is under five minutes.

**Jobs**

- Enjoy this. Be a bit better than yesterday.
- Never feel behind.
- Have something to show for it.

**How Loro serves him**

- **Loop C, the Roguelike Run**: a short bounded run, procedural variety from the draw, and
  permanent meta-progression on the five-rung ladder — the roguelike skeleton _minus the cruelty_
  (`Loro.dc.html:1548–1550`). Nothing is ever lost.
- The Phrasebook collection screen is the payoff surface: every phrase, its rung, the distribution
  that _is_ his real ability (`Loro.dc.html:1704–1773`).
- 5-minute daily setting from onboarding keeps the ask small.

**Fails him if:** a missed day visibly punishes him, or the app's honesty about weak areas reads as
failure. His loop is explicitly designed so surprise reads as fun while the targeting quietly does
the pedagogy.

---

## Coverage matrix

Which loop is each persona's default, and which they can switch to:

|                       | Stream | Refrain (B) | SRS + labs (A) | Run (C) | Trip arc |
| --------------------- | :----: | :---------: | :------------: | :-----: | :------: |
| Mara — trip           |   ●●   |      ●      |       ○        |    ○    | **●●●**  |
| Diego — conversations |   ●    |   **●●●**   |       ●●       |    ○    |    –     |
| Ana — moving          |   ●●   |      ●      |    **●●●**     |    ○    |    ●●    |
| Sam — curious         |   ●    |     ●●      |       ○        | **●●●** |    –     |

●●● default · ●● frequently used · ● occasional · ○ available, unlikely

**Design consequence:** every persona uses the **stream** and every persona's phrases live in **one
shared, tagged store**. The loop is a lens over that store, never a silo. This is why
[ADR-0006](../architecture/adr/0006-pluggable-practice-engines.md) exists.

## Explicit non-personas

- **Children.** No parental controls, no COPPA compliance, no age-appropriate content review. 16+
  only.
- **Classroom / institutional learners.** No teacher dashboards, assignments, or grading.
- **Absolute-beginner-to-C1 completionists.** Loro has no exam track and no CEFR curriculum.
- **Learners of languages other than Spanish** — in v1. The architecture is
  multi-target-language-ready ([content-model.md](content-model.md)) but only `es-ES` ships.
