// Names a new set (optionally holding phrases already), or renames one of the learner's sets (the
// web prototype's src/sheets/CreateSetSheet.tsx).
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useNav } from '@shared/nav/NavContext';
import { findSetView, ownSets, sameKey } from '@shared/state/catalog';
import { LIMITS, tidy } from '@shared/state/limits';
import { useCopy, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { CharCount, charsLeft } from '../ui/CharCount';
import { field } from '../ui/field';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, radius } from '../ui/theme';

export function CreateSetSheet({ request, onClose }: { request: { phraseIds: string[]; rename?: string } | null; onClose: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const { toast } = useToast();
  const { state, actions } = useStore();
  const renaming = request?.rename ? findSetView(state.learner, request.rename) : undefined;

  const submit = (title: string) => {
    const clean = title.trim();
    if (!request || !clean) return;
    if (renaming) {
      actions.renameSet(renaming.id, clean);
    } else {
      const id = actions.createSet(clean, request.phraseIds);
      toast(c.createSet.created(clean));
      nav.openSet(id);
    }
    onClose();
  };

  return (
    <Sheet open={request !== null} title={renaming ? c.createSet.renameTitle : c.createSet.title} onClose={onClose}>
      {request && (
        <SetNameForm
          key={request.rename ?? request.phraseIds.join()}
          initial={renaming?.title ?? ''}
          taken={ownSets(state.learner)
            .filter((s) => s.id !== renaming?.id)
            .map((s) => sameKey(s.title))}
          submitLabel={renaming ? c.common.save : c.createSet.create}
          onSubmit={submit}
        />
      )}
    </Sheet>
  );
}

/** `taken`: the other sets' names as keys; a same name is allowed, but said. */
function SetNameForm({ initial, taken, submitLabel, onSubmit }: { initial: string; taken: string[]; submitLabel: string; onSubmit: (title: string) => void }) {
  const c = useCopy();
  const [title, setTitle] = useState(initial);
  const key = sameKey(title);
  const isTaken = key !== '' && taken.includes(key);
  const disabled = !title.trim() || (initial !== '' && tidy(title) === initial);
  return (
    <View style={styles.form}>
      <View style={styles.label}>
        <Txt weight={600} nativeID="create-set-name">
          {c.createSet.name}
        </Txt>
        <TextInput
          value={title}
          onChangeText={setTitle}
          accessibilityLabel={c.createSet.name}
          accessibilityLabelledBy="create-set-name"
          accessibilityHint={charsLeft(c, title, LIMITS.title) || undefined}
          maxLength={LIMITS.title}
          autoComplete="off"
          autoFocus
          returnKeyType="done"
          // The keyboard's Done submits, as Enter does in the web's form.
          onSubmitEditing={() => !disabled && onSubmit(title)}
          style={field}
        />
        <CharCount value={title} max={LIMITS.title} />
      </View>
      {isTaken && (
        <Txt accessibilityLiveRegion="polite" style={styles.note}>
          {c.createSet.taken}
        </Txt>
      )}
      <Button variant="primary" label={submitLabel} disabled={disabled} onPress={() => onSubmit(title)} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  label: { gap: 4 },
  note: { borderRadius: radius.xl, backgroundColor: colors.surfaceContainerLow, padding: 12 },
});
