// What PostHog knows of the person (ADR-0011): who they are in the app and how far they are, so the
// persons list can be searched by name or course and a replay read next to the learner's real
// figures. Every number is the one the screens show, from the same selectors, never a count made up
// here. Pure, so it is tested here; src/analytics/posthog.ts sends what this returns.
import { localDay } from '../state/clock';
import { learnerStats, points } from '../state/selectors';
import type { LearnerState } from '../state/types';
import type { AnalyticsProperties } from './events';

/** A signed-in account as the person's properties; null fields are sent, so a removed name clears. */
export interface AccountLike {
  userId: string;
  email: string | null;
  provider: string;
  displayName: string | null;
}

export function accountProperties(account: AccountLike): AnalyticsProperties {
  return { user_id: account.userId, email: account.email, provider: account.provider, display_name: account.displayName };
}

/**
 * The learner's name, course and figures as person properties: what they're learning and in which
 * language, points, how many phrases are started, rated, learned and due, the mean recall of the
 * rated ones, how many days they have practised and when, and what they made or liked.
 */
export function learnerProperties(learner: LearnerState, now: number): AnalyticsProperties {
  const stats = learnerStats(learner, now);
  const days = new Set<string>();
  for (const entry of learner.log) {
    if (entry.kind === 'carryover') continue;
    days.add(entry.day ?? localDay(entry.at));
  }
  const sorted = [...days].sort();
  return {
    name: learner.profile.name || null,
    course: learner.profile.targetLang,
    ui_lang: learner.profile.nativeLang,
    onboarded: learner.profile.onboarded,
    points: points(learner),
    phrases_started: stats.started,
    phrases_rated: stats.rated,
    phrases_learned: stats.learned,
    phrases_due: stats.due,
    average_recall: stats.averageRecall,
    active_days: days.size,
    first_active_day: sorted[0] ?? null,
    last_active_day: sorted[sorted.length - 1] ?? null,
    own_sets: Object.keys(learner.ownSets).length,
    own_phrases: Object.keys(learner.ownPhrases).length,
    likes: Object.values(learner.likes).filter((like) => like.liked).length,
  };
}
