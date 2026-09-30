// Naming and describing a set or album in the learner's account (plan 106); the description is
// shown beside it wherever others find it (Community, a shared link).
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { updateAlbum, updateSet } from '@shared/api/library';
import { LIMITS, tidy } from '@shared/state/limits';
import { useContent } from '../state/content';
import { useCopy } from '../state/store';
import { Button } from '../ui/Button';
import { CharCount } from '../ui/CharCount';
import { field } from '../ui/field';
import { problemText } from '../ui/problems';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';

export interface Renaming {
  kind: 'set' | 'album';
  id: string;
  title: string;
  description: string | null;
}

export function RenameSheet({ item, onClose, onRenamed }: { item: Renaming | null; onClose: () => void; onRenamed?: () => void }) {
  const c = useCopy();
  return (
    <Sheet open={item !== null} title={c.createSet.editTitle} onClose={onClose}>
      {item && <RenameForm key={item.id} item={item} onClose={onClose} onRenamed={onRenamed} />}
    </Sheet>
  );
}

function RenameForm({ item, onClose, onRenamed }: { item: Renaming; onClose: () => void; onRenamed?: () => void }) {
  const c = useCopy();
  const { toast } = useToast();
  const content = useContent();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? '');
  const [busy, setBusy] = useState(false);
  const clean = tidy(title);
  const cleanDescription = tidy(description);
  const change = {
    ...(clean !== item.title ? { title: clean } : {}),
    ...(cleanDescription !== (item.description ?? '') ? { description: cleanDescription || null } : {}),
  };
  const changed = Object.keys(change).length > 0;
  const save = async () => {
    if (!clean || !changed) return;
    setBusy(true);
    try {
      if (item.kind === 'set') await updateSet(item.id, change);
      else await updateAlbum(item.id, change);
      await content.refresh();
      onRenamed?.();
      toast(c.share.changed);
      onClose();
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.form}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        accessibilityLabel={c.createSet.name}
        maxLength={LIMITS.title}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void save()}
        style={field}
      />
      <CharCount value={title} max={LIMITS.title} />
      <Txt weight={600}>{c.createSet.description}</Txt>
      <TextInput
        value={description}
        onChangeText={setDescription}
        accessibilityLabel={c.createSet.description}
        maxLength={LIMITS.description}
        multiline
        style={[field, styles.description]}
      />
      <Txt variant="label" color="secondary">
        {c.createSet.descriptionHint}
      </Txt>
      <Button variant="primary" label={c.common.save} disabled={busy || !clean || !changed} onPress={() => void save()} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  description: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
});
