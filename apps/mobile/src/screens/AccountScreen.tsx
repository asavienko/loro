// Signing in, and the account once signed in (plan 106). Sign-in is a code sent by email: no
// password to remember. Signed in, the learner sees who they are, the name shown on what they share,
// today's allowances and who makes things on this server, and can sign out. Progress on the device
// is never touched by any of it.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@shared/api/client';
import { deleteAccount, deleteEverything, setDisplayName } from '@shared/api/library';
import {
  finishProviderSignIn,
  providerSignInAvailable,
  requestCode,
  signInMethods,
  signOut as endSession,
  signInWithProvider,
  updateAccount,
  verifyCode,
} from '@shared/api/session';
import { remaining, useAccount } from '../state/account';
import { forgetAccountHere } from '../state/progressSync';
import { lastSync } from '../state/syncHooks';
import { useCopy } from '../state/store';
import { Button } from '../ui/Button';
import { field, placeholderColor } from '../ui/field';
import { Icon } from '../ui/Icon';
import { confirm } from '../ui/confirm';
import { problemText, resetTime } from '../ui/problems';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';
import { colors, radius } from '../ui/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AccountScreen() {
  const c = useCopy();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { toast } = useToast();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Back from a provider's sign-in page (the web): its ticket becomes a session.
  const returned = useLocalSearchParams<{ state?: string; ticket?: string; error?: string }>();
  const [returning, setReturning] = useState(Platform.OS === 'web' && Boolean(returned.ticket || returned.error));
  useEffect(() => {
    // On a phone the auth session hands the ticket to the sign-in itself; a copy of the redirect
    // that opens this screen is ignored.
    if (Platform.OS !== 'web' || (!returned.ticket && !returned.error)) return;
    const done = (text: string) => {
      toast(text);
      setReturning(false);
      router.replace('/');
    };
    if (returned.error) return done(c.account.errors.generic);
    finishProviderSignIn({ state: returned.state, ticket: returned.ticket }).then(
      () => done(c.account.welcome),
      (error: unknown) => done(problemText(c, error)),
    );
    // Only the parameters it came back with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returned.ticket, returned.error]);
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <Button variant="icon" icon="close" accessibilityLabel={c.common.close} onPress={close} />
        <Txt variant="title" face="serif" weight={600} accessibilityRole="header">
          {account.status === 'signedIn' ? c.account.title : c.account.signIn}
        </Txt>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        {returning ? <ActivityIndicator color={colors.primaryContainer} /> : account.status === 'signedIn' ? <SignedIn /> : <SignIn onDone={close} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The email-code sign-in; `embedded` (onboarding) leaves out its own Not now. */
type Provider = 'google' | 'apple';
// Apple first on Apple's devices, as its guidelines ask; the order is otherwise Google, Apple.
const PROVIDERS: Provider[] = Platform.OS === 'ios' ? ['apple', 'google'] : ['google', 'apple'];
const PROVIDER_NAMES: Record<Provider, string> = { google: 'Google', apple: 'Apple' };

export function SignIn({ onDone, embedded = false }: { onDone: () => void; embedded?: boolean }) {
  const c = useCopy();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [emailOffered, setEmailOffered] = useState(true);
  const [providers, setProviders] = useState<Provider[]>([]);
  const codeField = useRef<TextInput>(null);

  useEffect(() => {
    signInMethods()
      .then((methods) => {
        setEmailOffered(methods.email);
        if (!providerSignInAvailable()) return;
        setProviders(PROVIDERS.filter((provider) => methods[provider]));
      })
      .catch(() => {});
  }, []);

  const send = async () => {
    const clean = email.trim();
    if (!EMAIL.test(clean)) return setProblem(c.account.errors.badEmail);
    setBusy(true);
    setProblem(null);
    try {
      await requestCode(clean);
      setSent(clean);
      setCode('');
    } catch (error) {
      setProblem(problemText(c, error));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (!sent || !/^\d{6}$/.test(value)) return;
    setBusy(true);
    setProblem(null);
    try {
      await verifyCode(sent, value);
      toast(c.account.welcome, { tone: 'success' });
      onDone();
    } catch (error) {
      // A wrong or expired code is refused as unauthenticated or invalid.
      const refused = error instanceof ApiError && (error.status === 401 || error.status === 422);
      setProblem(refused ? c.account.errors.badCode : problemText(c, error));
      setBusy(false);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.badge}>
        <Icon name={sent ? 'mail' : 'account_circle'} size="3xl" color="primaryContainer" />
      </View>
      <Txt variant="displaySm" face="serif" weight={600} accessibilityRole="header">
        {sent ? c.account.codeTitle : c.account.signInTitle}
      </Txt>
      <Txt variant="row" color="secondary">
        {sent ? c.account.codeBody(sent) : c.account.signInBody}
      </Txt>
      {!emailOffered && (
        <Txt variant="body" color="error" accessibilityLiveRegion="polite">
          {c.account.errors.unavailable}
        </Txt>
      )}
      {sent ? (
        <>
          <Txt variant="label" weight={600} nativeID="code-label">
            {c.account.code}
          </Txt>
          <TextInput
            ref={codeField}
            autoFocus
            accessibilityLabelledBy="code-label"
            aria-label={c.account.code}
            value={code}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, '').slice(0, 6);
              setCode(digits);
              if (digits.length === 6) void verify(digits);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            editable={!busy}
            style={[field, styles.code]}
            placeholder="000000"
            placeholderTextColor={placeholderColor}
          />
          {problem && <Problem text={problem} />}
          <Button variant="primary" label={busy ? c.account.verifying : c.account.verify} disabled={busy || code.length !== 6} onPress={() => void verify()} />
          <View style={styles.row}>
            <Button variant="text" label={c.account.resend} disabled={busy} onPress={() => void send()} />
            <Button
              variant="text"
              label={c.account.changeEmail}
              disabled={busy}
              onPress={() => {
                setSent(null);
                setProblem(null);
              }}
            />
          </View>
        </>
      ) : (
        <>
          <Txt variant="label" weight={600} nativeID="email-label">
            {c.account.email}
          </Txt>
          <TextInput
            accessibilityLabelledBy="email-label"
            aria-label={c.account.email}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => void send()}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            returnKeyType="send"
            placeholder={c.account.emailPlaceholder}
            placeholderTextColor={placeholderColor}
            style={field}
          />
          {problem && <Problem text={problem} />}
          <Button variant="primary" icon="mail" label={busy ? c.account.sending : c.account.sendCode} disabled={busy || !email.trim() || !emailOffered} onPress={() => void send()} />
          {providers.map((provider) => (
            <Button
              key={provider}
              variant="tonal"
              label={c.account[provider]}
              disabled={busy}
              onPress={() => {
                setBusy(true);
                // In a browser the tab leaves for the provider's page and comes back to the account
                // screen with a ticket; on a phone the page opens over the app and the account comes back here.
                signInWithProvider(provider).then(
                  (account) => {
                    if (account === 'left') return;
                    setBusy(false);
                    if (!account) return;
                    toast(c.account.welcome, { tone: 'success' });
                    onDone();
                  },
                  (error: unknown) => {
                    // Refused: this address isn't one the server sends the provider back to.
                    setProblem(error instanceof ApiError && error.status === 422 ? c.account.errors.providerUnavailable(PROVIDER_NAMES[provider]) : problemText(c, error));
                    setBusy(false);
                  },
                );
              }}
            />
          ))}
          {!embedded && <Button variant="text" label={c.account.notNow} onPress={onDone} />}
        </>
      )}
      {busy && <ActivityIndicator color={colors.primaryContainer} />}
    </View>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <View style={styles.problem} accessibilityLiveRegion="assertive" accessibilityRole="alert">
      <Icon name="error" size="md" color="error" />
      <Txt variant="body" color="error" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

function SignedIn() {
  const c = useCopy();
  const { toast } = useToast();
  const { account, usage, refreshUsage, signOut } = useAccount();
  const [name, setName] = useState(account?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const saveName = async () => {
    const clean = name.trim();
    if (!clean || clean === account?.displayName) return;
    setSaving(true);
    try {
      const saved = await setDisplayName(clean);
      await updateAccount({ displayName: saved.displayName });
      toast(c.account.displayNameSaved);
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Icon name="account_circle" size="2xl" color="primaryContainer" />
        <Txt variant="row" weight={600} style={{ flex: 1 }}>
          {c.account.signedInAs(account?.email ?? '')}
        </Txt>
      </View>

      {(lastSync.done || lastSync.failed) && (
        <Txt variant="body" color="secondary">
          {lastSync.failed ? c.account.syncFailed : c.account.synced}
        </Txt>
      )}

      <Txt variant="label" weight={600} nativeID="name-label">
        {c.account.displayName}
      </Txt>
      <View style={styles.row}>
        <TextInput
          accessibilityLabelledBy="name-label"
          aria-label={c.account.displayName}
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => void saveName()}
          maxLength={40}
          style={[field, { flex: 1 }]}
          returnKeyType="done"
        />
        <Button variant="tonal" label={c.common.save} disabled={saving || !name.trim() || name.trim() === account?.displayName} onPress={() => void saveName()} />
      </View>
      <Txt variant="label" color="secondary">
        {c.account.displayNameHint}
      </Txt>

      {usage && (
        <View style={styles.section}>
          <Txt variant="title" face="serif" weight={600} accessibilityRole="header">
            {c.account.today}
          </Txt>
          {(['phrases', 'cover', 'song'] as const).map((kind) => (
            <Allowance key={kind} label={c.account.usage[kind](remaining(usage, kind) ?? 0, usage.daily[kind].limit)} used={usage.daily[kind].used} limit={usage.daily[kind].limit} />
          ))}
          <Txt variant="label" color="secondary">
            {c.account.resets(resetTime(c.locale, usage.resetsAt))}
          </Txt>
          <Txt variant="body" color="secondary">
            {c.account.kept(usage.kept.sets.used, usage.kept.albums.used)}
          </Txt>
        </View>
      )}

      {usage && (
        <View style={styles.section}>
          <Txt variant="title" face="serif" weight={600} accessibilityRole="header">
            {c.account.writers}
          </Txt>
          {(['phrases', 'cover', 'lyrics', 'music'] as const).map((kind) => (
            <View key={kind} style={styles.writer}>
              <Txt variant="body" weight={600} style={styles.writerKind}>
                {c.account.writerKind[kind]}
              </Txt>
              <Txt variant="body" color="secondary" style={{ flex: 1 }}>
                {c.account.writer[usage.writers[kind]]}
              </Txt>
            </View>
          ))}
        </View>
      )}

      <Button
        variant="tonal"
        icon="logout"
        label={c.account.signOut}
        onPress={() => {
          void signOut().then(() => toast(c.account.signedOut));
        }}
      />
      <Button
        variant="text"
        icon="delete"
        color="error"
        label={c.account.deleteData}
        onPress={() => {
          void (async () => {
            if (!(await confirm(c.account.deleteDataConfirm, c.share.delete, c.common.cancel))) return;
            try {
              await deleteEverything();
              // Not the account's sign-out, which saves progress first and would put it back.
              await endSession();
              toast(c.account.deletedData);
            } catch (error) {
              toast(problemText(c, error));
            }
          })();
        }}
      />
      <Button
        variant="text"
        icon="block"
        color="error"
        label={c.account.deleteAccount}
        onPress={() => {
          void (async () => {
            if (!account || !(await confirm(c.account.deleteAccountConfirm, c.account.deleteAccountYes, c.common.cancel))) return;
            try {
              await deleteAccount();
              await forgetAccountHere(account.userId);
              await endSession();
              toast(c.account.deletedAccount);
            } catch (error) {
              toast(problemText(c, error));
            }
          })();
        }}
      />
    </View>
  );
}

/** A bar of what's used; the numbers beside it are the real counts from the API. */
function Allowance({ label, used, limit }: { label: string; used: number; limit: number }) {
  const share = limit > 0 ? Math.min(1, used / limit) : 1;
  return (
    <View style={styles.allowance}>
      <Txt variant="body">{label}</Txt>
      <View style={styles.track} accessible={false}>
        <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 4 },
  body: { paddingHorizontal: 24, paddingTop: 12, width: '100%', maxWidth: 520, alignSelf: 'center' },
  stack: { gap: 14 },
  badge: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  code: { fontSize: 28, letterSpacing: 10, textAlign: 'center', fontFamily: 'sans-600', minHeight: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  problem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.xl, backgroundColor: colors.errorContainer },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius['2xl'], backgroundColor: colors.surfaceContainerLow },
  section: { gap: 10, paddingTop: 8 },
  allowance: { gap: 6 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainerHigh, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.tertiaryContainer },
  writer: { flexDirection: 'row', gap: 12 },
  writerKind: { width: 72 },
});
