// Renaming a set or album in the learner's account (plan 106).
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

export interface Renaming {
  kind: 'set' | 'album';
  id: string;
  title: string;
}

export function RenameSheet({ item, onClose, onRenamed }: { item: Renaming | null; onClose: () => void; onRenamed?: () => void }) {
  const c = useCopy();
  return (
    <Sheet open={item !== null} title={item?.kind === 'album' ? c.music.renameAlbum : c.createSet.renameTitle} onClose={onClose}>
      {item && <RenameForm key={item.id} item={item} onClose={onClose} onRenamed={onRenamed} />}
    </Sheet>
  );
}

function RenameForm({ item, onClose, onRenamed }: { item: Renaming; onClose: () => void; onRenamed?: () => void }) {
  const c = useCopy();
  const { toast } = useToast();
  const content = useContent();
  const [title, setTitle] = useState(item.title);
  const [busy, setBusy] = useState(false);
  const clean = tidy(title);
  const save = async () => {
    if (!clean || clean === item.title) return;
    setBusy(true);
    try {
      if (item.kind === 'set') await updateSet(item.id, { title: clean });
      else await updateAlbum(item.id, { title: clean });
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
      <Button variant="primary" label={c.common.save} disabled={busy || !clean || clean === item.title} onPress={() => void save()} />
    </View>
  );
}

const styles = StyleSheet.create({ form: { paddingHorizontal: 16, paddingTop: 12, gap: 10 } });
