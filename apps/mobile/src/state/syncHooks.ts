// Shared between the account and progress sync (plan 106), so neither imports the other.

/** Runs before signing out: the last save of this learner's progress to their account. */
export const beforeSignOut: { run: () => Promise<void> } = { run: async () => {} };

/** How the last progress sync went, and for whom, for the account screen. */
export const lastSync: { userId: string | null; done: boolean; failed: boolean } = { userId: null, done: false, failed: false };
