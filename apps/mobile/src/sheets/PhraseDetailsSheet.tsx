// A phrase's details (the web prototype's src/sheets/PhraseDetailsSheet.tsx): its picture, text,
// sounds and real status; Play, then the frequent actions as tiles; its notes; and, rarer, arranging
// the learner's own set and correcting or deleting their own phrase.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { languageLabel, languageName } from '@shared/copy';
import { updateSet } from '@shared/api/library';
import { findSet, getLanguage, getTopic } from '@shared/content';
import { writeNotes } from '@shared/generate/remote';
import { useNav } from '@shared/nav/NavContext';
import { findPhrase, findSetView, promptOf } from '@shared/state/catalog';
import { currentPhraseId, displayLearner, isLiked, phraseProgress } from '@shared/state/selectors';
import { useAccount } from '../state/account';
import { useContent } from '../state/content';
import { useCopy, useNow, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { PhraseNotesView } from '../ui/Notes';
import { PhraseImage } from '../ui/PhraseImage';
import { problemText } from '../ui/problems';
import { progressLabel } from '../ui/progressLabel';
import { Sheet, SheetAction, SheetActionGrid, SheetOption } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, radius } from '../ui/theme';

interface Props {
  details: { phraseId: string; ownSetId?: string } | null;
  onClose: () => void;
}

export function PhraseDetailsSheet({ details, onClose }: Props) {
  const { state } = useStore();
  const phrase = findPhrase(state.learner, details?.phraseId);
  const c = useCopy();
  // Named for its set; your own phrase has none, so the sheet says whose it is.
  const title = !phrase ? '' : phrase.own ? c.phrase.yours : (findSetView(state.learner, phrase.setId)?.title ?? '');
  return (
    <Sheet open={Boolean(phrase)} title={title} onClose={onClose}>
      {phrase && details && <PhraseDetails phraseId={phrase.id} ownSetId={details.ownSetId} onClose={onClose} />}
    </Sheet>
  );
}

function PhraseDetails({ phraseId, ownSetId, onClose }: { phraseId: string; ownSetId?: string; onClose: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { toast } = useToast();
  const { state, actions } = useStore();
  const now = useNow(30_000);
  const content = useContent();
  const phrase = findPhrase(state.learner, phraseId);
  // Deleting your own phrase closes the sheet; while it slides away, the phrase is already gone.
  if (!phrase) return null;
  const liked = isLiked(state.learner, 'phrase', phrase.id);
  const progress = phraseProgress(displayLearner(state), phrase.id, now);
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  const isCurrent = currentPhraseId(state.player) === phrase.id;
  const ownSet = ownSetId ? findSetView(state.learner, ownSetId) : undefined;
  const served = findSet(phrase.setId);
  const accountSet = served?.owner === 'me' ? served : undefined;
  const topicId = findSetView(state.learner, phrase.setId)?.topicId;
  // A phrase the learner added from suggestions says where its text came from.
  const own = state.learner.ownPhrases[phrase.id];
  const origin = own?.origin;
  const status = [progressLabel(c, progress, now), progress.memory.heardCount > 0 && c.phrase.heard(progress.memory.heardCount), phrase.register && c.common.register[phrase.register]].filter(
    (item): item is string => Boolean(item),
  );

  return (
    <View style={styles.body}>
      <View>
        {/* The picture beside the phrase; at large text the words wrap under it. */}
        <View style={styles.head}>
          <PhraseImage icons={phrase.image} tone={(topicId && getTopic(topicId)?.tone) || 'secondary'} width={80} height={80} />
          <View style={styles.headText}>
            <Txt variant="displaySm" face="serif" italic weight={600} lang={phrase.targetLang}>
              {phrase.target}
            </Txt>
            <Txt color="secondary" lang={prompt.lang} style={styles.prompt}>
              {prompt.text}
            </Txt>
          </View>
        </View>
        {/* Its sounds at a glance: IPA for those who read it, the respelling for everyone. */}
        <Txt variant="label" color="onSurfaceVariant" style={styles.line}>
          <Txt variant="label" weight={600} color="onSurfaceVariant">
            {c.phrase.sounds}
          </Txt>{' '}
          <Txt variant="label" color="onSurfaceVariant" style={styles.mono}>
            {phrase.notes.pronunciation.ipa}
          </Txt>
          {' · '}
          <Txt variant="label" color="onSurfaceVariant" lang="en">
            {phrase.notes.pronunciation.respelling}
          </Txt>
        </Txt>
        <View style={[styles.line, styles.wrap]}>
          <Txt variant="label" accessibilityRole="image" accessibilityLabel={languageLabel(phrase.targetLang, c.locale)}>
            {getLanguage(phrase.targetLang).flag}
          </Txt>
          {/* The separator ends each item, so a wrapped line never starts with "·". */}
          {status.map((item, i) => (
            <Txt key={i} variant="label" color="onSurfaceVariant">
              {item}
              {i < status.length - 1 && ' ·'}
            </Txt>
          ))}
        </View>
        {origin && <Byline icon={origin === 'ai' ? 'auto_awesome' : 'library_music'} text={origin === 'ai' ? c.make.originAi : c.make.originBank} />}
        {phrase.notesBy === 'ai' && origin !== 'ai' && <Byline icon="auto_awesome" text={c.phrase.notesByAi} />}
        {phrase.tags.length > 0 && (
          <View style={[styles.line, styles.wrap]}>
            {phrase.tags.map((t) => (
              <View key={t} style={styles.tag}>
                <Txt variant="caption" weight={600} color="onSurfaceVariant">
                  {c.common.tag[t]}
                </Txt>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Play first, then the frequent actions as tiles; the notes follow at once. */}
      <View style={styles.actions}>
        <Button
          variant="primary"
          icon="play_arrow"
          iconFill
          label={c.common.play}
          onPress={() => {
            onClose();
            nav.playPhraseInSet(phrase.id);
          }}
        />
        <SheetActionGrid>
          <SheetAction
            icon="queue_play_next"
            label={c.phrase.playNext}
            disabled={isCurrent}
            onPress={() => {
              actions.enqueue([phrase.id], phrase.setId, 'next');
              toast(c.set.addedNext);
              onClose();
            }}
          />
          <SheetAction
            icon="queue_music"
            label={c.phrase.addToQueue}
            disabled={isCurrent}
            onPress={() => {
              actions.enqueue([phrase.id], phrase.setId, 'end');
              toast(c.set.addedEnd);
              onClose();
            }}
          />
          <SheetAction icon="favorite" pressed={liked} label={liked ? c.phrase.liked : c.phrase.like} onPress={() => actions.toggleLike('phrase', phrase.id)} />
          <SheetAction
            icon="playlist_add"
            label={c.phrase.addToSet}
            onPress={() => {
              onClose();
              nav.addToSet([phrase.id]);
            }}
          />
        </SheetActionGrid>
      </View>

      <PhraseNotesView phrase={phrase} />
      {phrase.notesBy === 'device' && <DeviceNotes phraseId={phrase.id} />}

      {/* Rarer: arranging your own set, and correcting or deleting your own phrase. */}
      {(ownSet || phrase.own) && (
        <View style={styles.rare}>
          {ownSet && ownSet.phraseIds.indexOf(phrase.id) > 0 && (
            <SheetOption icon="arrow_upward" label={c.phrase.moveUp} onPress={() => actions.moveInSet(ownSet.id, phrase.id, -1)} />
          )}
          {ownSet && ownSet.phraseIds.indexOf(phrase.id) < ownSet.phraseIds.length - 1 && (
            <SheetOption icon="arrow_downward" label={c.phrase.moveDown} onPress={() => actions.moveInSet(ownSet.id, phrase.id, 1)} />
          )}
          {ownSet && (
            <SheetOption
              icon="playlist_remove"
              label={c.phrase.removeFromSet}
              onPress={() => {
                const at = state.learner.ownSets[ownSet.id]?.phraseIds.indexOf(phrase.id);
                actions.removeFromSet(ownSet.id, phrase.id);
                toast(c.phrase.removedFromSet, { action: { label: c.common.undo, run: () => actions.addToSet(ownSet.id, [phrase.id], at) } });
                onClose();
              }}
            />
          )}
          {/* A phrase of a set in the learner's account (plan 106) leaves it there. */}
          {accountSet && accountSet.phraseIds.length > 1 && (
            <SheetOption
              icon="playlist_remove"
              label={c.phrase.removeFromSet}
              onPress={() => {
                onClose();
                updateSet(accountSet.id, { removePhraseIds: [phrase.id] }).then(
                  () => {
                    toast(c.phrase.removedFromSet);
                    void content.refresh();
                  },
                  (error: unknown) => toast(problemText(c, error)),
                );
              }}
            />
          )}
          {phrase.own && (
            <SheetOption
              icon="edit"
              label={c.phrase.edit}
              onPress={() => {
                onClose();
                nav.addPhrase({ editId: phrase.id });
              }}
            />
          )}
          {phrase.own && !isCurrent && (
            <SheetOption
              icon="delete"
              tone="danger"
              label={c.phrase.delete}
              onPress={() => {
                // Undo also puts it back in Up next, as far ahead of the playing phrase as it was.
                const { order, index } = state.player;
                const upNextAt = order.slice(index + 1).flatMap((id, i) => (id === phrase.id ? [i] : []));
                actions.deleteOwnPhrase(phrase.id);
                toast(c.phrase.deleted, {
                  action: {
                    label: c.common.undo,
                    run: () => {
                      actions.restoreOwnPhrase(phrase.id);
                      // In order, so each copy (a missed phrase can be queued twice) lands at its old place.
                      for (const at of upNextAt) actions.restoreUpNext([phrase.id], at);
                    },
                  },
                });
                onClose();
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

/** Where a phrase or its notes came from, as a small line with an icon. */
function Byline({ icon, text }: { icon: 'auto_awesome' | 'library_music' | 'smartphone'; text: string }) {
  return (
    <View style={[styles.line, styles.byline]}>
      <Icon name={icon} size="sm" color="onSurfaceVariant" />
      <Txt variant="label" color="onSurfaceVariant" style={styles.flex}>
        {text}
      </Txt>
    </View>
  );
}

/**
 * One of the learner's own phrases whose notes the device worked out (typed, and not in the phrase
 * bank): says so, and where the server has a writer, offers to ask it for its notes instead.
 */
function DeviceNotes({ phraseId }: { phraseId: string }) {
  const c = useCopy();
  const { state, actions } = useStore();
  const own = state.learner.ownPhrases[phraseId];
  const live = useAccount().status === 'signedIn';
  const [status, setStatus] = useState<'idle' | 'writing' | 'failed'>('idle');
  if (!own) return null;
  const write = () => {
    setStatus('writing');
    const asked = { target: own.target, native: own.native, targetLang: own.targetLang, nativeLang: own.nativeLang };
    writeNotes(asked).then(
      (written) => {
        actions.setOwnNotes(own.id, asked.target, written.notes, written.image);
        setStatus('idle');
      },
      () => setStatus('failed'),
    );
  };
  return (
    <View accessibilityLabel={c.phrase.notesTitle} style={styles.device}>
      <Byline icon="smartphone" text={c.phrase.notesByDevice(languageName(own.targetLang, c.locale))} />
      {status === 'failed' && (
        <Txt color="secondary" accessibilityLiveRegion="polite">
          {c.phrase.notesFailed}
        </Txt>
      )}
      {live && (
        <Button
          variant="tonal"
          icon={status === 'writing' ? 'hourglass_empty' : 'auto_awesome'}
          label={status === 'writing' ? c.phrase.writingNotes : c.phrase.writeNotes}
          disabled={status === 'writing'}
          onPress={write}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 },
  headText: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  prompt: { marginTop: 4 },
  line: { marginTop: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  mono: { fontFamily: 'monospace' },
  byline: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  flex: { flex: 1, minWidth: 0 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerHigh },
  actions: { gap: 8 },
  rare: { borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 8 },
  device: { alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
});
