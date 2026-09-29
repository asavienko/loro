// Reporting someone else's shared set or album (plan 106): once per learner, with why. Enough
// reports take it out of Community.
import { reportItem } from '@shared/api/library';
import { useAccount } from '../state/account';
import { useCopy } from '../state/store';
import { useNav } from '@shared/nav/NavContext';
import { problemText } from '../ui/problems';
import { Sheet, SheetOption } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

const REASONS = ['offensive', 'wrong', 'spam', 'other'] as const;

export function ReportSheet({ item, onClose }: { item: { kind: 'set' | 'album'; id: string } | null; onClose: () => void }) {
  const c = useCopy();
  const nav = useNav();
  const account = useAccount();
  const { toast } = useToast();
  const report = async (reason: (typeof REASONS)[number]) => {
    if (!item) return;
    onClose();
    if (account.status !== 'signedIn') return nav.openAccount();
    try {
      await reportItem(item.kind, item.id, reason);
      toast(c.share.reported);
    } catch (error) {
      toast(problemText(c, error));
    }
  };
  return (
    <Sheet open={item !== null} title={c.share.report} onClose={onClose}>
      {REASONS.map((reason) => (
        <SheetOption key={reason} icon="info" label={c.share.reason[reason]} onPress={() => void report(reason)} />
      ))}
    </Sheet>
  );
}
