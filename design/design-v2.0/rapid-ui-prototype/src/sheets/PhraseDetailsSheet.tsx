import { languageLabel } from '../copy';
import { getLanguage } from '../content';
import { useNav } from '../nav/NavContext';
import { findPhrase, findSetView, promptOf } from '../state/catalog';
import { currentPhraseId, isLiked, phraseProgress } from '../state/selectors';
import { useCopy, useNow, useStore } from '../state/store';
import { PhraseNotesView } from '../ui/Notes';
import { progressLabel } from '../ui/progressLabel';
import { Sheet, SheetOption } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

interface Props {
  details: { phraseId: string; ownSetId?: string } | null;
  onClose: () => void;
}

export function PhraseDetailsSheet({ details, onClose }: Props) {
  const { state } = useStore();
  const phrase = findPhrase(state.learner, details?.phraseId);
  const title = phrase ? (findSetView(state.learner, phrase.setId)?.title ?? '') : '';
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
  const phrase = findPhrase(state.learner, phraseId);
  // Deleting your own phrase closes the sheet; while it slides away, the phrase is already gone.
  if (!phrase) return null;
  const liked = isLiked(state.learner, 'phrase', phrase.id);
  const progress = phraseProgress(state.learner, phrase.id, now);
  const prompt = promptOf(phrase, state.learner.profile.nativeLang);
  const isCurrent = currentPhraseId(state.player) === phrase.id;
  const ownSet = ownSetId ? findSetView(state.learner, ownSetId) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p lang={phrase.targetLang} className="font-serif italic text-display-sm font-semibold text-on-surface leading-snug">{phrase.target}</p>
        <p lang={prompt.lang} className="text-body text-secondary mt-1">{prompt.text}</p>
        <p className="text-label text-on-surface-variant mt-2 flex flex-wrap items-center gap-1.5">
          <span role="img" aria-label={languageLabel(phrase.targetLang, c.locale)}>{getLanguage(phrase.targetLang).flag}</span>
          {/* The separator ends each item, so a wrapped line never starts with "·". */}
          {[
            progressLabel(c, progress, now),
            progress.memory.heardCount > 0 && c.phrase.heard(progress.memory.heardCount),
            phrase.register && c.common.register[phrase.register],
            phrase.own && c.phrase.yours,
          ]
            .filter((item): item is string => Boolean(item))
            .map((item, i, items) => (
              <span key={i}>
                {item}
                {i < items.length - 1 && ' ·'}
              </span>
            ))}
        </p>
        {phrase.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mt-2">
            {phrase.tags.map((t) => (
              <li key={t} className="text-caption font-semibold px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant">
                {c.common.tag[t]}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <SheetOption
          icon="play_arrow"
          label={c.common.play}
          onClick={() => {
            onClose();
            nav.playPhraseInSet(phrase.id);
          }}
        />
        <SheetOption
          icon="queue_play_next"
          label={c.phrase.playNext}
          disabled={isCurrent}
          onClick={() => {
            actions.enqueue([phrase.id], phrase.setId, 'next');
            toast(c.set.addedNext);
            onClose();
          }}
        />
        <SheetOption
          icon="queue_music"
          label={c.phrase.addToQueue}
          disabled={isCurrent}
          onClick={() => {
            actions.enqueue([phrase.id], phrase.setId, 'end');
            toast(c.set.addedEnd);
            onClose();
          }}
        />
        <SheetOption icon="favorite" label={liked ? c.phrase.liked : c.phrase.like} onClick={() => actions.toggleLike('phrase', phrase.id)} />
        <SheetOption
          icon="playlist_add"
          label={c.phrase.addToSet}
          onClick={() => {
            onClose();
            nav.addToSet([phrase.id]);
          }}
        />
        {ownSet && ownSet.phraseIds.indexOf(phrase.id) > 0 && (
          <SheetOption icon="arrow_upward" label={c.phrase.moveUp} onClick={() => actions.moveInSet(ownSet.id, phrase.id, -1)} />
        )}
        {ownSet && ownSet.phraseIds.indexOf(phrase.id) < ownSet.phraseIds.length - 1 && (
          <SheetOption icon="arrow_downward" label={c.phrase.moveDown} onClick={() => actions.moveInSet(ownSet.id, phrase.id, 1)} />
        )}
        {ownSet && (
          <SheetOption
            icon="playlist_remove"
            label={c.phrase.removeFromSet}
            onClick={() => {
              const at = state.learner.ownSets[ownSet.id]?.phraseIds.indexOf(phrase.id);
              actions.removeFromSet(ownSet.id, phrase.id);
              toast(c.phrase.removedFromSet, { action: { label: c.common.undo, run: () => actions.addToSet(ownSet.id, [phrase.id], at) } });
              onClose();
            }}
          />
        )}
        {phrase.own && (
          <SheetOption
            icon="edit"
            label={c.phrase.edit}
            onClick={() => {
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
            onClick={() => {
              // Undo also puts it back in Up next, as far ahead of the playing phrase as it was.
              const { order, index } = state.player;
              const upNextAt = order.indexOf(phrase.id, index + 1) - (index + 1);
              actions.deleteOwnPhrase(phrase.id);
              toast(c.phrase.deleted, {
                action: {
                  label: c.common.undo,
                  run: () => {
                    actions.restoreOwnPhrase(phrase.id);
                    if (upNextAt >= 0) actions.restoreUpNext([phrase.id], upNextAt);
                  },
                },
              });
              onClose();
            }}
          />
        )}
      </div>

      <PhraseNotesView phrase={phrase} prefix="details-notes" />
    </div>
  );
}
