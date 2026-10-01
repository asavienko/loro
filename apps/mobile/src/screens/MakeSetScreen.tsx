// "Make a set" (plan 103; the web prototype's src/screens/MakeSetScreen.tsx): the learner says what
// they want to talk about (a topic, a few keywords or a text), gets a deck of suggested phrases, and
// decides one card at a time: swipe right (or Add, or →) to add it, left (or Skip, or ←) to skip it.
// What they added becomes a set of their own, or joins the set they came from. Nothing is added
// without a decision, and a card says where its phrase came from, AI included.
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createSet, generateCover, updateSet } from '@shared/api/library';
import { Playback, speak } from '@shared/audio/speech';
import { languageName } from '@shared/copy';
import { BANK_THEMES } from '@shared/content';
import { added, currentCard, deal, dealt, decide, edit, lastDecision, newDeck, nextCard, unadd, undo } from '@shared/generate/deck';
import { newPhrasesOf } from '@shared/generate/publish';
import { defaultTitle, MakeRequest, MakeSession } from '@shared/generate/session';
import { suggest } from '@shared/generate/suggest';
import { INPUT_LIMITS, SUGGEST_MODES, SuggestMode, SuggestRequest, Suggestion } from '@shared/generate/types';
import { useLatest } from '@shared/lib/useLatest';
import { useNav } from '@shared/nav/NavContext';
import { findPhrase, findSetView, ownSets, sameKey } from '@shared/state/catalog';
import { clip, LIMITS, tidy } from '@shared/state/limits';
import { useCloseMake, useShell } from '../nav/Shell';
import { useAccount } from '../state/account';
import { useContent } from '../state/content';
import { useCopy, useStore } from '../state/store';
import { Banner } from '../ui/Banner';
import { Button, Chip } from '../ui/Button';
import { CharCount, charsLeft } from '../ui/CharCount';
import { field, placeholderColor } from '../ui/field';
import { fontFamily } from '../ui/fonts';
import { Icon, IconName } from '../ui/Icon';
import { PhraseImage } from '../ui/PhraseImage';
import { problemText } from '../ui/problems';
import { PullDownWindow, PullHandle } from '../ui/PullDown';
import { SwipeDeck, SwipeDeckHandle, SwipeTravel } from '../ui/SwipeDeck';
import { ToastOffsetContext, useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, ColorName, radius, shadow, TARGET, type } from '../ui/theme';

const SOURCE_ICONS: Record<Suggestion['source'], IconName> = { course: 'menu_book', mine: 'person', bank: 'library_music', ai: 'auto_awesome' };

/** A card takes most of a tall phone, as a card to decide should; large text grows it further. */
function useCardHeight() {
  const { height } = useWindowDimensions();
  return { card: Math.min(384, height * 0.52), image: Math.min(144, height * 0.18) };
}

/** The route: `input` starts from a topic (and suggests at once), `setId` fills one of the learner's sets, `resume` reopens a flow closed with phrases unsaved. */
export function MakeSetScreen() {
  const params = useLocalSearchParams<{ input?: string; setId?: string; resume?: string }>();
  const { makeSessionRef } = useShell();
  // Read once, as the flow opens: the closed flow the shell kept is the starting state, not a value to follow.
  // eslint-disable-next-line react-hooks/refs
  const [request] = useState<MakeRequest>(() => ({
    input: params.input,
    setId: params.setId,
    resume: params.resume === '1' ? (makeSessionRef.current ?? undefined) : undefined,
  }));
  return <MakeSet request={request} />;
}

function MakeSet({ request }: { request: MakeRequest }) {
  const c = useCopy();
  const nav = useNav();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { makeSessionRef } = useShell();
  const closeMake = useCloseMake();
  const { toast, announce } = useToast();
  const { state } = useStore();
  const { learner } = state;
  const { nativeLang, targetLang } = learner.profile;
  const account = useAccount();
  const signedIn = account.status === 'signedIn';

  const [session, setSession] = useState<MakeSession>(
    () =>
      request.resume ?? {
        setId: request.setId ?? null,
        mode: 'topic',
        texts: { topic: clip(tidy(request.input ?? ''), INPUT_LIMITS.topic), keywords: '', text: '' },
        asked: null,
        deck: null,
        writer: 'bank',
        exhausted: false,
        step: 'ask',
        title: '',
        nothingFor: null,
      },
  );
  // The shell reads the flow as it stands when it closes, to offer it back.
  const saved = useRef(false);
  useEffect(() => {
    if (!saved.current) makeSessionRef.current = session;
  }, [session, makeSessionRef]);
  // However it closes (Close, the back button), phrases added but not saved are one tap from coming back.
  const closeLatest = useLatest(closeMake);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        if (!saved.current) closeLatest.current();
      }),
    [navigation, closeLatest],
  );
  const update = (patch: Partial<MakeSession>) => setSession((s) => ({ ...s, ...patch }));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const into = session.setId ? findSetView(learner, session.setId) : undefined;

  // Which way the last card left, or where a card taken back comes from.
  const [travel, setTravel] = useState<SwipeTravel>({ direction: 1, returning: false });

  // One request at a time: a newer one (or closing) cancels the one in flight, so a late answer
  // never replaces a newer deck.
  const [pending, setPending] = useState<AbortController | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  const ask = async (asked: SuggestRequest, more: boolean) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const inSet = (into?.phraseIds ?? []).map((id) => findPhrase(learner, id)?.target ?? '').filter(Boolean);
    const seen = session.deck ? dealt(session.deck) : { keys: new Set<string>(), texts: [] };
    setPending(controller);
    try {
      const result = await suggest(learner, asked, {
        exclude: new Set([...seen.keys, ...inSet.map(sameKey)]),
        avoid: [...inSet, ...seen.texts],
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setTravel({ direction: 1, returning: false });
      setSession((s) => {
        const deck = s.deck ? deal(s.deck, result.suggestions) : result.suggestions.length > 0 ? newDeck(result.suggestions) : null;
        if (!deck || deck === s.deck) return more ? { ...s, exhausted: true } : { ...s, nothingFor: asked.input };
        return {
          ...s,
          deck,
          asked,
          writer: result.writer,
          exhausted: false,
          nothingFor: null,
          step: 'deck',
          title: s.title || defaultTitle(c, asked),
        };
      });
      void account.refreshUsage();
    } catch (error) {
      // Cancelled (replaced by a newer request, or the flow closed) says nothing; a failure says what.
      if (!controller.signal.aborted) toast(problemText(c, error));
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      setPending((p) => (p === controller ? null : p));
    }
  };

  const askFor = (mode: SuggestMode, input: string) => {
    if (tidy(input).length < 2) return;
    void ask({ mode, input: tidy(input), targetLang, nativeLang }, false);
  };

  // Opened from a search ("Suggest phrases about …"): the learner has said what they want. Asking
  // needs an account, so a learner who isn't signed in yet is asked for once they are.
  const askLatest = useLatest(askFor);
  const startWith = request.resume ? undefined : request.input;
  useEffect(() => {
    if (!startWith || !signedIn) return;
    askLatest.current('topic', startWith);
    return () => inFlight.current?.abort();
  }, [startWith, signedIn, askLatest]);

  const keptCount = session.deck ? added(session.deck).length : 0;

  const [saving, setSaving] = useState(false);
  const content = useContent();
  // The set being filled is one of the learner's, in their account (plan 108).
  const intoServer = into?.content?.owner === 'me' ? into.content : undefined;

  /** Saves to the learner's account (plan 106), drawing a cover when asked. */
  const saveToAccount = async (title: string, withCover: boolean) => {
    const deck = session.deck;
    if (!deck || saving) return;
    const phrases = newPhrasesOf(learner, added(deck));
    if (phrases.length === 0) return;
    setSaving(true);
    try {
      let id: string;
      if (intoServer) {
        id = (await updateSet(intoServer.id, { addPhrases: phrases })).set.id;
        toast(c.make.addedInto(phrases.length, intoServer.title));
      } else {
        const clean = tidy(title);
        if (!clean) return;
        const made = await createSet({ title: clean, targetLang, nativeLang, visibility: 'private', phrases });
        id = made.set.id;
        toast(c.create.savedToAccount, { tone: 'success' });
        if (withCover) {
          // Drawn in the background (plan 111): the set opens now and its cover lands when it is ready.
          void generateCover({ kind: 'set', title: clean, attachTo: id }).then(
            () => content.refresh(),
            (error: unknown) => toast(problemText(c, error)),
          );
        }
      }
      await content.refresh();
      void account.refreshUsage();
      saved.current = true;
      makeSessionRef.current = null;
      if (intoServer) close();
      else nav.openSet(id);
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ToastOffsetContext.Provider value={16}>
      <PullDownWindow onClose={close} style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <PullHandle style={styles.headerLine}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel={c.common.close} onPress={close} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <Icon name="close" size="lg" />
            </Pressable>
            <Txt variant="title" face="serif" weight={600} align="center" numberOfLines={1} accessibilityRole="header" style={styles.flex}>
              {into ? c.make.into(into.title) : c.make.title}
            </Txt>
            {session.step === 'deck' && keptCount > 0 ? <Button variant="text" label={c.make.done} onPress={() => update({ step: 'save' })} /> : <View style={styles.spacer} />}
          </View>
        </PullHandle>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!signedIn && (
            <Banner icon="account_circle" action={<Button variant="primarySm" label={c.account.signIn} onPress={nav.openAccount} />} style={styles.signIn}>
              <Txt variant="row">{c.account.needed}</Txt>
            </Banner>
          )}
          {signedIn && session.step === 'ask' && (
            <AskStep
              session={session}
              writer={account.usage?.writers.phrases ?? null}
              pending={pending}
              onChange={update}
              onAsk={askFor}
              onBackToDeck={keptCount > 0 ? () => update({ step: 'deck' }) : undefined}
            />
          )}
          {signedIn && session.step === 'deck' && session.deck && (
            <DeckStep
              session={session}
              travel={travel}
              pending={pending !== null}
              onDecide={(add) => {
                const card = session.deck && currentCard(session.deck);
                if (!card) return;
                setTravel({ direction: add ? 1 : -1, returning: false });
                setSession((s) => ({ ...s, deck: s.deck && decide(s.deck, add) }));
                announce(add ? c.make.announceAdded(card.target) : c.make.announceSkipped(card.target));
              }}
              onUndo={() => {
                const last = session.deck && lastDecision(session.deck);
                if (!last) return;
                setTravel({ direction: last.added ? 1 : -1, returning: true });
                setSession((s) => ({ ...s, deck: s.deck && undo(s.deck) }));
                announce(c.make.undoLabel(last.card.target));
              }}
              onEdit={(key, target, native) => setSession((s) => ({ ...s, deck: s.deck && edit(s.deck, key, target, native) }))}
              onMore={() => session.asked && void ask(session.asked, true)}
              onAnother={() => update({ step: 'ask', nothingFor: null })}
              onSave={() => update({ step: 'save' })}
            />
          )}
          {signedIn && session.step === 'save' && session.deck && (
            <SaveStep
              session={session}
              into={into?.title}
              onTitle={(title) => update({ title })}
              onRemove={(key) => setSession((s) => ({ ...s, deck: s.deck && unadd(s.deck, key) }))}
              onBack={() => update({ step: 'deck' })}
              onSave={(title, withCover) => void saveToAccount(title, withCover)}
              saving={saving}
            />
          )}
        </ScrollView>
      </PullDownWindow>
    </ToastOffsetContext.Provider>
  );
}

// ---------- asking ----------

function AskStep({
  session,
  writer,
  pending,
  onChange,
  onAsk,
  onBackToDeck,
}: {
  session: MakeSession;
  /** Who writes suggestions on this server, once the day's usage is known. */
  writer: 'ai' | 'bank' | null;
  pending: AbortController | null;
  onChange: (patch: Partial<MakeSession>) => void;
  onAsk: (mode: SuggestMode, input: string) => void;
  onBackToDeck?: () => void;
}) {
  const c = useCopy();
  const nav = useNav();
  const { state } = useStore();
  const locale = c.locale.slice(0, 2) as 'en' | 'bg' | 'ru';
  const { mode, texts } = session;
  const text = texts[mode];
  const setText = (value: string) => onChange({ texts: { ...texts, [mode]: value }, nothingFor: null });
  const input = useRef<TextInput>(null);
  const hint = mode === 'text' ? c.make.hintText(languageName(state.learner.profile.targetLang, c.locale)) : mode === 'keywords' ? c.make.hintKeywords : c.make.hintTopic;
  const ready = tidy(text).length >= 2 && !pending;
  const submit = () => ready && onAsk(mode, text);

  return (
    <View style={styles.step}>
      <Txt color="secondary">{c.make.intro}</Txt>
      <View accessibilityRole="radiogroup" accessibilityLabel={c.make.modesLabel} style={styles.modes}>
        {SUGGEST_MODES.map((m) => {
          const on = mode === m;
          return (
            <Pressable
              key={m}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              onPress={() => {
                onChange({ mode: m, nothingFor: null });
                requestAnimationFrame(() => input.current?.focus());
              }}
              style={[styles.mode, on && styles.modeOn]}
            >
              <Txt weight={on ? 700 : 500} color={on ? 'onSurface' : 'secondary'} align="center">
                {c.make.modes[m]}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.label}>
        <Txt weight={600} nativeID="make-field">
          {c.make.field[mode]}
        </Txt>
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          accessibilityLabel={c.make.field[mode]}
          accessibilityLabelledBy="make-field"
          accessibilityHint={[hint, charsLeft(c, text, INPUT_LIMITS[mode])].filter(Boolean).join('. ')}
          maxLength={INPUT_LIMITS[mode]}
          placeholder={c.make.placeholder[mode]}
          placeholderTextColor={placeholderColor}
          autoComplete="off"
          editable={pending === null}
          multiline={mode === 'text'}
          numberOfLines={mode === 'text' ? 6 : 1}
          returnKeyType={mode === 'text' ? 'default' : 'go'}
          onSubmitEditing={mode === 'text' ? undefined : submit}
          style={[field, mode === 'text' && styles.textArea]}
        />
        <View style={styles.hintRow}>
          <Txt variant="label" color="secondary" style={styles.flex}>
            {hint}
          </Txt>
          <CharCount value={text} max={INPUT_LIMITS[mode]} />
        </View>
      </View>

      {session.nothingFor !== null && (
        <View accessibilityLiveRegion="polite" style={styles.nothing}>
          <Txt weight={600}>{c.make.none(session.nothingFor)}</Txt>
          <Txt color="secondary">{c.make.noneHint}</Txt>
          <Button variant="tonal" icon="add" label={c.make.writeOwn} onPress={() => nav.addPhrase()} />
        </View>
      )}

      <Button variant="primary" icon={pending ? 'hourglass_empty' : 'auto_awesome'} label={pending ? c.make.writing : c.make.suggest} disabled={!ready} onPress={submit} />
      {pending && <Button variant="text" label={c.common.cancel} onPress={() => pending.abort()} style={styles.center} />}

      {mode === 'topic' && (
        <View style={styles.topics}>
          <Txt variant="label" weight={600} color="secondary" accessibilityRole="header">
            {c.make.tryTopics}
          </Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chipRow}>
            {BANK_THEMES.map((theme) => (
              <Chip
                key={theme.id}
                toggle={false}
                label={theme.title[locale]}
                disabled={pending !== null}
                onPress={() => {
                  onChange({ texts: { ...texts, topic: theme.title[locale] }, nothingFor: null });
                  onAsk('topic', theme.title[locale]);
                }}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {writer !== null && (
        <View style={styles.byline}>
          <Icon name={writer === 'ai' ? 'auto_awesome' : 'library_music'} size="sm" color="secondary" />
          <Txt variant="label" color="secondary" style={styles.flex}>
            {writer === 'ai' ? c.make.byAi : c.make.byBank}
          </Txt>
        </View>
      )}

      {onBackToDeck && <Button variant="text" icon="arrow_back" label={c.make.backToDeck} onPress={onBackToDeck} style={styles.start} />}
    </View>
  );
}

// ---------- deciding ----------

function DeckStep({
  session,
  travel,
  pending,
  onDecide,
  onUndo,
  onEdit,
  onMore,
  onAnother,
  onSave,
}: {
  session: MakeSession;
  travel: SwipeTravel;
  pending: boolean;
  onDecide: (add: boolean) => void;
  onUndo: () => void;
  onEdit: (key: string, target: string, native: string) => void;
  onMore: () => void;
  onAnother: () => void;
  onSave: () => void;
}) {
  const c = useCopy();
  const deck = session.deck!;
  const card = currentCard(deck);
  const next = nextCard(deck);
  const last = lastDecision(deck);
  const count = added(deck).length;
  const total = deck.cards.length;
  const position = Math.min(deck.decisions.length + 1, total);
  const [editing, setEditing] = useState<string | null>(null);
  const isEditing = editing !== null && editing === card?.key;
  const deckRef = useRef<SwipeDeckHandle>(null);
  // Buttons and keys throw the card the way a swipe does; the decision lands as it leaves.
  const throwCard = (add: boolean) => deckRef.current?.throwCard(add ? 1 : -1);

  // On the web: → adds, ← skips, Ctrl/⌘-Z takes the last decision back; not while typing a correction.
  const keys = useLatest({ card, last, isEditing, throwCard, onUndo });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      const { card: top, last: previous, isEditing: correcting, throwCard: decideTop, onUndo: undoLast } = keys.current;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select') || correcting) return;
      if (event.key === 'ArrowRight' && top) {
        event.preventDefault();
        decideTop(true);
      } else if (event.key === 'ArrowLeft' && top) {
        event.preventDefault();
        decideTop(false);
      } else if ((event.key === 'z' || event.key === 'Z') && (event.metaKey || event.ctrlKey) && previous) {
        event.preventDefault();
        undoLast();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys]);

  return (
    <View style={styles.step}>
      <View style={styles.progress}>
        <Txt variant="label" weight={600} color="secondary" style={styles.tabular}>
          {c.make.progress(position, total)}
        </Txt>
        <Txt variant="label" weight={600} color="secondary" style={styles.tabular}>
          {c.make.addedCount(count)}
        </Txt>
      </View>

      {card ? (
        <>
          <SwipeDeck
            ref={deckRef}
            top={{
              key: card.key,
              node: isEditing ? (
                <EditFace
                  card={card}
                  onDone={(text) => {
                    if (text) onEdit(card.key, text.target, text.native);
                    setEditing(null);
                  }}
                />
              ) : (
                <CardFace card={card} position={position} total={total} onEdit={() => setEditing(card.key)} />
              ),
            }}
            under={next ? { key: next.key, node: <CardFace card={next} position={position + 1} total={total} /> } : null}
            travel={travel}
            stamps={{ yes: c.make.add, no: c.make.skip }}
            onSwipe={(direction) => onDecide(direction === 1)}
            disabled={isEditing}
          />
          <View style={styles.decisions}>
            <DecisionButton icon="close" label={c.make.skip} name={c.make.skipLabel(card.target)} tone="skip" onPress={() => throwCard(false)} disabled={isEditing} />
            <DecisionButton icon="undo" label={c.common.undo} name={last ? c.make.undoLabel(last.card.target) : c.common.undo} tone="undo" onPress={onUndo} disabled={!last || isEditing} />
            <DecisionButton icon="check" label={c.make.add} name={c.make.addLabel(card.target)} tone="add" onPress={() => throwCard(true)} disabled={isEditing} />
          </View>
          <Txt variant="label" color="secondary" align="center">
            {Platform.OS === 'web' ? `${c.make.swipeHint} ${c.make.keysHint}` : c.make.swipeHint}
          </Txt>
        </>
      ) : (
        <View style={styles.end}>
          <Icon name="task_alt" size="3xl" color="tertiaryContainer" />
          <Txt variant="heading" face="serif" weight={600} align="center" accessibilityRole="header">
            {c.make.endTitle(total)}
          </Txt>
          <Txt color="secondary" align="center">
            {c.make.endAdded(count)}
          </Txt>
          {count > 0 && <Button variant="primary" label={c.make.review(count)} onPress={onSave} style={styles.stretch} />}
          {session.exhausted ? (
            <Txt color="secondary" align="center" accessibilityLiveRegion="polite">
              {c.make.noMore}
            </Txt>
          ) : (
            <Button variant="tonal" icon={pending ? 'hourglass_empty' : 'auto_awesome'} label={pending ? c.make.writing : c.make.more} disabled={pending} onPress={onMore} style={styles.stretch} />
          )}
          <View style={styles.endLinks}>
            {last && <Button variant="text" icon="undo" label={c.common.undo} onPress={onUndo} />}
            <Button variant="text" label={c.make.another} onPress={onAnother} />
          </View>
        </View>
      )}
    </View>
  );
}

const DECISION_TONE: Record<'add' | 'skip' | 'undo', { size: number; bg: string; ink: ColorName; icon: number; extra: object }> = {
  add: { size: 64, bg: colors.primaryContainer, ink: 'onPrimary', icon: 34, extra: shadow.float },
  skip: { size: 64, bg: colors.surfaceContainerLowest, ink: 'onSurface', icon: 34, extra: shadow.cover },
  undo: { size: 48, bg: colors.surfaceContainerLow, ink: 'secondary', icon: 20, extra: { marginTop: 8 } },
};

/** A round decision button with its word under it; its name carries the phrase it decides. */
function DecisionButton({ icon, label, name, tone, onPress, disabled }: { icon: IconName; label: string; name: string; tone: keyof typeof DECISION_TONE; onPress: () => void; disabled?: boolean }) {
  const look = DECISION_TONE[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.decision, disabled && styles.disabled, pressed && { transform: [{ scale: 0.95 }] }]}
    >
      <View style={[styles.decisionDisc, { width: look.size, height: look.size, backgroundColor: look.bg }, look.extra]}>
        <Icon name={icon} size={look.icon} color={look.ink} />
      </View>
      <Txt variant="label" weight={600}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** A suggestion's face: where it came from, the phrase, its meaning, and Listen and Correct. */
function CardFace({ card, position, total, onEdit }: { card: Suggestion; position: number; total: number; onEdit?: () => void }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const { width } = useWindowDimensions();
  const size = useCardHeight();
  const { nativeLang, targetLang } = state.learner.profile;
  const playback = useRef<Playback | null>(null);
  useEffect(() => () => playback.current?.cancel(), []);
  const source = card.source === 'course' ? c.make.source.course(card.setTitle ?? '') : c.make.source[card.source];

  // The server's clip of the suggestion as written: a corrected card has none.
  const clipUrl = card.audio?.[targetLang];
  const listen = () => {
    // One voice at a time: the loop pauses while a suggestion is heard.
    if (state.player.status === 'playing') actions.pause();
    playback.current?.cancel();
    // At the learner's speed, as the player would say it.
    playback.current = speak(clipUrl, state.prefs.speed);
  };

  return (
    <View accessibilityLabel={c.make.cardLabel(position, total)} style={{ minHeight: size.card }}>
      {/* The picture across the top, as a card to swipe has; the stamps show over it. */}
      {card.image ? (
        <PhraseImage icons={card.image} tone={card.tone} width={Math.min(512, width) - 32} height={size.image} rounded={0} style={styles.cardImage} />
      ) : (
        <View style={styles.noImage} />
      )}
      <View style={styles.cardBody}>
        <View style={[styles.source, card.source === 'ai' ? styles.sourceAi : styles.sourcePlain]}>
          <Icon name={SOURCE_ICONS[card.source]} size="xs" color={card.source === 'ai' ? 'onPrimaryFixed' : 'onSurfaceVariant'} />
          <Txt variant="label" weight={600} color={card.source === 'ai' ? 'onPrimaryFixed' : 'onSurfaceVariant'} lang={card.source === 'course' ? targetLang : undefined} style={styles.flexShrink}>
            {source}
          </Txt>
        </View>
        <View style={styles.cardText}>
          <Txt variant="displaySm" face="serif" italic weight={500} lang={targetLang}>
            {card.target}
          </Txt>
          <Txt variant="row" color="secondary" lang={nativeLang}>
            {card.native}
          </Txt>
        </View>
        {onEdit && (
          <View style={styles.cardActions}>
            {clipUrl && (
              <Pressable accessibilityRole="button" accessibilityLabel={c.make.listen(card.target)} onPress={listen} style={({ pressed }) => [styles.listen, pressed && styles.pressed]}>
                <Icon name="volume_up" />
              </Pressable>
            )}
            <Button variant="text" icon="edit" label={c.make.edit} accessibilityLabel={c.make.editLabel(card.target)} onPress={onEdit} />
          </View>
        )}
      </View>
    </View>
  );
}

/** Correcting a card before adding it: both languages, stored as the phrase form stores them. */
function EditFace({ card, onDone }: { card: Suggestion; onDone: (text: { target: string; native: string } | null) => void }) {
  const c = useCopy();
  const { state } = useStore();
  const size = useCardHeight();
  const { nativeLang, targetLang } = state.learner.profile;
  const [target, setTarget] = useState(card.target);
  const [native, setNative] = useState(card.native);
  const ready = Boolean(target.trim() && native.trim());
  const targetName = c.addPhrase.target(languageName(targetLang, c.locale));
  const nativeName = c.addPhrase.native(languageName(nativeLang, c.locale));
  return (
    <View style={[styles.edit, { minHeight: size.card }]}>
      <View style={styles.label}>
        <Txt weight={600}>{targetName}</Txt>
        <TextInput
          {...({ lang: targetLang } as object)}
          value={target}
          onChangeText={setTarget}
          accessibilityLabel={targetName}
          maxLength={LIMITS.phrase}
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          autoFocus
          style={[field, { fontFamily: fontFamily('serif', 400, true, target || null, targetLang) }]}
        />
      </View>
      <View style={styles.label}>
        <Txt weight={600}>{nativeName}</Txt>
        <TextInput
          {...({ lang: nativeLang } as object)}
          value={native}
          onChangeText={setNative}
          accessibilityLabel={nativeName}
          maxLength={LIMITS.phrase}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={() => ready && onDone({ target, native })}
          style={[field, { fontFamily: fontFamily('sans', 400, false, native || null, nativeLang) }]}
        />
      </View>
      <View style={styles.editActions}>
        <Button variant="text" label={c.common.cancel} onPress={() => onDone(null)} />
        <Button variant="tonal" label={c.common.save} disabled={!ready} onPress={() => onDone({ target, native })} />
      </View>
    </View>
  );
}

// ---------- saving ----------

function SaveStep({
  session,
  into,
  onTitle,
  onRemove,
  onBack,
  onSave,
  saving,
}: {
  session: MakeSession;
  /** The learner's set being filled, by name; otherwise a new set is named here. */
  into?: string;
  onTitle: (title: string) => void;
  onRemove: (key: string) => void;
  onBack: () => void;
  onSave: (title: string, withCover: boolean) => void;
  saving: boolean;
}) {
  const [withCover, setWithCover] = useState(true);
  const c = useCopy();
  const { state } = useStore();
  const { nativeLang, targetLang } = state.learner.profile;
  const kept = added(session.deck!);
  const key = sameKey(session.title);
  // A same name is allowed, but said (as when naming a set by hand).
  const taken = !into && key !== '' && ownSets(state.learner).some((s) => sameKey(s.title) === key);
  const ready = kept.length > 0 && (Boolean(into) || tidy(session.title) !== '');

  return (
    <View style={styles.step}>
      <Txt variant="heading" face="serif" weight={600} accessibilityRole="header">
        {into ? c.make.into(into) : c.make.saveTitle}
      </Txt>
      {!into && (
        <View style={styles.label}>
          <Txt weight={600}>{c.createSet.name}</Txt>
          <TextInput
            value={session.title}
            onChangeText={onTitle}
            accessibilityLabel={c.createSet.name}
            accessibilityHint={charsLeft(c, session.title, LIMITS.title) || undefined}
            maxLength={LIMITS.title}
            autoComplete="off"
            returnKeyType="done"
            onSubmitEditing={() => ready && onSave(session.title, withCover)}
            style={field}
          />
          <CharCount value={session.title} max={LIMITS.title} />
        </View>
      )}
      {taken && (
        <Txt accessibilityLiveRegion="polite" style={styles.taken}>
          {c.createSet.taken}
        </Txt>
      )}

      <View>
        <Txt variant="label" weight={600} color="secondary" accessibilityRole="header" style={styles.keptHeading}>
          {c.make.keptHeading(kept.length)}
        </Txt>
        <View style={styles.kept}>
          {kept.map((card) => (
            <View key={card.key} style={styles.keptRow}>
              <View style={styles.flex}>
                <Txt variant="row" face="serif" italic lang={targetLang}>
                  {card.target}
                </Txt>
                <Txt variant="label" color="secondary" lang={nativeLang}>
                  {card.native}
                </Txt>
              </View>
              {card.source === 'ai' && (
                <View accessible accessibilityLabel={c.make.source.ai}>
                  <Icon name="auto_awesome" size="sm" color="primaryContainer" />
                </View>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel={c.make.remove(card.target)} onPress={() => onRemove(card.key)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <Icon name="close" size="md" color="secondary" />
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      {!into && (
        <View style={styles.coverRow}>
          <Txt weight={600} style={styles.flex} nativeID="with-cover">
            {c.create.withCover}
          </Txt>
          <Switch value={withCover} onValueChange={setWithCover} accessibilityLabelledBy="with-cover" aria-label={c.create.withCover} />
        </View>
      )}
      <Button
        variant="primary"
        icon="account_circle"
        label={saving ? c.create.saving : into ? c.make.addInto(kept.length, into) : c.create.saveToAccount}
        disabled={!ready || saving}
        onPress={() => onSave(session.title, withCover)}
      />
      <Button variant="text" icon="arrow_back" label={c.make.backToDeck} onPress={onBack} style={styles.center} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1 },
  headerLine: { borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerHigh },
  header: { height: 56, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', maxWidth: 512, alignSelf: 'center' },
  iconButton: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: TARGET },
  pressed: { backgroundColor: colors.surfaceContainer },
  content: { width: '100%', maxWidth: 512, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 16, overflow: 'hidden' },
  step: { gap: 16 },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TARGET },
  modes: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.full, backgroundColor: colors.surfaceContainerLow },
  mode: { flex: 1, minHeight: TARGET, paddingHorizontal: 4, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: colors.surfaceContainerLowest, ...shadow.card },
  label: { gap: 4 },
  textArea: { minHeight: 6 * type.field.lineHeight + 24, paddingVertical: 12, textAlignVertical: 'top' },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  nothing: { borderRadius: radius['2xl'], backgroundColor: colors.surfaceContainerLow, padding: 16, alignItems: 'flex-start', gap: 8 },
  center: { alignSelf: 'center', marginTop: -8 },
  start: { alignSelf: 'flex-start', marginLeft: -12 },
  topics: { gap: 4 },
  bleed: { marginHorizontal: -16 },
  chipRow: { paddingHorizontal: 16, gap: 8 },
  byline: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  progress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  tabular: { fontVariant: ['tabular-nums'] },
  signIn: { borderRadius: radius.xl, backgroundColor: colors.surfaceContainerLow },
  decisions: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 20, paddingTop: 8 },
  decision: { minWidth: 64, alignItems: 'center', gap: 4, borderRadius: radius['2xl'] },
  decisionDisc: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  end: { borderRadius: radius['3xl'], backgroundColor: colors.surfaceContainerLow, padding: 24, alignItems: 'center', gap: 12 },
  stretch: { alignSelf: 'stretch' },
  endLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 8 },
  cardImage: { width: '100%', borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'] },
  noImage: { height: 56 },
  cardBody: { flex: 1, padding: 20, paddingTop: 16, gap: 16 },
  source: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  sourceAi: { backgroundColor: colors.primaryFixed },
  sourcePlain: { backgroundColor: colors.surfaceContainer },
  cardText: { flex: 1, justifyContent: 'center', gap: 8 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginHorizontal: -4 },
  listen: { width: TARGET, height: TARGET, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerLow },
  edit: { padding: 20, gap: 12 },
  editActions: { marginTop: 'auto', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  taken: { borderRadius: radius.xl, backgroundColor: colors.surfaceContainerLow, padding: 12 },
  keptHeading: { minHeight: TARGET, textAlignVertical: 'center', paddingTop: 12 },
  kept: { marginHorizontal: -8 },
  keptRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
});
