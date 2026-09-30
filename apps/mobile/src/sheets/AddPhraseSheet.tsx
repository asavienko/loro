// The learner's own phrase (the web prototype's src/sheets/AddPhraseSheet.tsx): both languages,
// played with the device voice like any other. With `editId` it corrects an existing phrase and
// keeps its history.
import { usePathname } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { languageName } from '@shared/copy';
import type { LanguageCode } from '@shared/content';
import { writeNotes } from '@shared/generate/remote';
import { useNav } from '@shared/nav/NavContext';
import { bankMatch, findSamePhrase, promptOf } from '@shared/state/catalog';
import { LIMITS, sayable, tidy } from '@shared/state/limits';
import { useAccount } from '../state/account';
import { useCopy, useStore } from '../state/store';
import { Button } from '../ui/Button';
import { CharCount, charsLeft } from '../ui/CharCount';
import { field } from '../ui/field';
import { fontFamily } from '../ui/fonts';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, radius } from '../ui/theme';

export function AddPhraseSheet({ request, onClose }: { request: { editId?: string; target?: string } | null; onClose: () => void }) {
  const c = useCopy();
  const { state } = useStore();
  const editing = request?.editId ? state.learner.ownPhrases[request.editId] : undefined;
  return (
    <Sheet open={request !== null} title={editing ? c.addPhrase.editTitle : c.addPhrase.title} onClose={onClose}>
      {request && (
        <PhraseForm
          key={request.editId ?? 'new'}
          editId={editing?.id}
          initialTarget={editing?.target ?? request.target ?? ''}
          initialNative={editing?.native ?? ''}
          targetLang={editing?.targetLang ?? state.learner.profile.targetLang}
          nativeLang={editing?.nativeLang ?? state.learner.profile.nativeLang}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

interface FormProps {
  editId?: string;
  initialTarget: string;
  initialNative: string;
  targetLang: LanguageCode;
  nativeLang: LanguageCode;
  onDone: () => void;
}

function PhraseForm({ editId, initialTarget, initialNative, targetLang, nativeLang, onDone }: FormProps) {
  const c = useCopy();
  const nav = useNav();
  const pathname = usePathname();
  const { toast } = useToast();
  const { state, actions } = useStore();
  const account = useAccount();
  const [target, setTarget] = useState(initialTarget);
  const [native, setNative] = useState(initialNative);
  const nativeRef = useRef<TextInput>(null);
  // Saying the same thing twice is allowed, but the learner should know.
  const same = findSamePhrase(state.learner, target, editId);

  // An edit that changes nothing (spacing aside) has nothing to save.
  const unchanged = Boolean(editId) && tidy(target) === tidy(initialTarget) && tidy(native) === tidy(initialNative);
  // A phrase needs something to say aloud: a letter or a digit.
  const ready = sayable(target) && Boolean(native.trim()) && !unchanged;

  const submit = () => {
    if (!ready) return;
    if (editId) {
      actions.editOwnPhrase(editId, target, native);
      toast(c.addPhrase.edited);
    } else {
      const id = actions.addOwnPhrase(target, native);
      // Its notes: the bank's when the bank has it, otherwise the server's, asked for quietly now.
      if (!bankMatch(targetLang, target) && account.status === 'signedIn') {
        const asked = { target: tidy(target), native: tidy(native), targetLang, nativeLang };
        writeNotes(asked).then(
          (written) => actions.setOwnNotes(id, asked.target, written.notes, written.image),
          () => {},
        );
      }
      // The next step is hearing it.
      toast(c.addPhrase.added, { action: { label: c.common.play, run: () => nav.playPhraseInSet(id) } });
      // Added from the Library: show it there, under Mine.
      if (pathname.startsWith('/library')) {
        onDone();
        nav.go({ name: 'library', view: 'mine' });
        return;
      }
    }
    onDone();
  };

  const targetName = c.addPhrase.target(languageName(targetLang, c.locale));
  const nativeName = c.addPhrase.native(languageName(nativeLang, c.locale));
  const nativeSame = same ? promptOf(same, nativeLang) : null;
  return (
    <View style={styles.form}>
      <View style={styles.label}>
        <Txt weight={600} nativeID="add-phrase-target">
          {targetName}
        </Txt>
        <TextInput
          {...({ lang: targetLang } as object)}
          value={target}
          onChangeText={setTarget}
          accessibilityLabel={targetName}
          accessibilityLabelledBy="add-phrase-target"
          accessibilityHint={charsLeft(c, target, LIMITS.phrase) || undefined}
          maxLength={LIMITS.phrase}
          // The keyboard's autocorrect speaks the device language and would "fix" the phrase.
          autoCorrect={false}
          spellCheck={false}
          autoCapitalize="sentences"
          autoComplete="off"
          autoFocus={!editId}
          // Next goes on to the translation while it is still empty; otherwise it submits.
          returnKeyType={native.trim() ? 'done' : 'next'}
          submitBehavior={native.trim() ? 'blurAndSubmit' : 'submit'}
          onSubmitEditing={() => (native.trim() ? submit() : nativeRef.current?.focus())}
          style={[field, { fontFamily: fontFamily('serif', 400, true, target || null, targetLang) }]}
        />
        <CharCount value={target} max={LIMITS.phrase} />
      </View>
      <View style={styles.label}>
        <Txt weight={600} nativeID="add-phrase-native">
          {nativeName}
        </Txt>
        <TextInput
          ref={nativeRef}
          {...({ lang: nativeLang } as object)}
          value={native}
          onChangeText={setNative}
          accessibilityLabel={nativeName}
          accessibilityLabelledBy="add-phrase-native"
          accessibilityHint={charsLeft(c, native, LIMITS.phrase) || undefined}
          maxLength={LIMITS.phrase}
          autoComplete="off"
          returnKeyType="done"
          onSubmitEditing={submit}
          style={[field, { fontFamily: fontFamily('sans', 400, false, native || null, nativeLang) }]}
        />
        <CharCount value={native} max={LIMITS.phrase} />
      </View>
      {same && nativeSame && (
        <View accessible accessibilityLiveRegion="polite" style={styles.note}>
          <Txt>
            {c.addPhrase.duplicate}{' '}
            <Txt face="serif" italic weight={600} lang={same.targetLang}>
              {same.target}
            </Txt>
          </Txt>
          <Txt variant="label" color="secondary" lang={nativeSame.lang}>
            {nativeSame.text}
          </Txt>
        </View>
      )}
      <Txt variant="label" color="secondary">
        {c.addPhrase.hint}
      </Txt>
      <Button variant="primary" label={editId ? c.common.save : c.addPhrase.add} disabled={!ready} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  label: { gap: 4 },
  note: { borderRadius: radius.xl, backgroundColor: colors.surfaceContainerLow, padding: 12 },
});
