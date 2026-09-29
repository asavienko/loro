// Who can see a set or album, and its link (plan 106). The owner chooses: only them, anyone with the
// link, or everyone (listed in Community). Anything not private can be shared: the system share
// sheet on a phone, the clipboard in a browser without one.
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { updateAlbum, updateSet } from '@shared/api/library';
import type { Visibility } from '@shared/content';
import type { Shareable } from '@shared/nav/NavContext';
import { useContent } from '../state/content';
import { useCopy } from '../state/store';
import { Button } from '../ui/Button';
import { Sheet, SheetOption, SheetSection } from '../ui/Sheet';
import { problemText } from '../ui/problems';
import { useToast } from '../ui/Toast';
import { Txt } from '../ui/Txt';


/** The link that opens a shared item: the web origin in a browser, the app's scheme on a phone. */
export function shareUrl(code: string): string {
  return Linking.createURL(`/shared/${code}`);
}

export async function shareItem(c: ReturnType<typeof useCopy>, title: string, code: string, toast: (text: string) => void): Promise<void> {
  const url = shareUrl(code);
  const message = c.share.shareMessage(title, url);
  if (Platform.OS === 'web') {
    const web = globalThis.navigator as Navigator | undefined;
    if (web?.share) {
      await web.share({ title, text: message, url }).catch(() => {});
      return;
    }
    await web?.clipboard?.writeText(url).then(
      () => toast(c.share.copied),
      () => {},
    );
    return;
  }
  await Share.share({ message, url, title }).catch(() => {});
}

export function ShareSheet({ item, onClose, onChanged }: { item: Shareable | null; onClose: () => void; onChanged?: () => void }) {
  const c = useCopy();
  const { toast } = useToast();
  const content = useContent();
  const [visibility, setVisibility] = useState<Visibility | null>(null);
  const [busy, setBusy] = useState(false);
  const current = visibility ?? item?.visibility ?? 'private';

  const choose = async (next: Visibility) => {
    if (!item || next === current) return;
    setBusy(true);
    try {
      if (item.kind === 'set') await updateSet(item.id, { visibility: next });
      else await updateAlbum(item.id, { visibility: next });
      setVisibility(next);
      await content.refresh();
      onChanged?.();
      toast(c.share.changed);
    } catch (error) {
      toast(problemText(c, error));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setVisibility(null);
    onClose();
  };

  return (
    <Sheet open={item !== null} title={c.share.share} onClose={close}>
      {item?.owner === 'me' && (
        <SheetSection title={c.share.visibility}>
          <View accessibilityRole="radiogroup" accessibilityLabel={c.share.visibility}>
            <SheetOption icon="lock" label={c.share.private} detail={c.share.privateDetail} selected={current === 'private'} disabled={busy} onPress={() => void choose('private')} />
            <SheetOption icon="link" label={c.share.link} detail={c.share.linkDetail} selected={current === 'link'} disabled={busy} onPress={() => void choose('link')} />
            <SheetOption icon="public" label={c.share.public} detail={c.share.publicDetail} selected={current === 'public'} disabled={busy} onPress={() => void choose('public')} />
          </View>
        </SheetSection>
      )}
      {item && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
          {current === 'private' && item.owner === 'me' ? (
            <Txt variant="body" color="secondary">
              {c.share.makeShareable}
            </Txt>
          ) : (
            item.shareCode && <Button variant="primary" icon="share" label={c.share.share} onPress={() => void shareItem(c, item.title, item.shareCode!, (text) => toast(text))} />
          )}
        </View>
      )}
    </Sheet>
  );
}
