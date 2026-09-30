// The queue follows the installed content (plan 108): a phrase deleted from the learner's account,
// here or on another device, leaves the queue when the course is downloaded again.
import { useEffect } from 'react';
import { onContentChange } from '@shared/content';
import { useStore } from './store';

export function useQueueFollowsContent(): void {
  const { actions } = useStore();
  useEffect(() => onContentChange(() => actions.contentChanged()), [actions]);
}
