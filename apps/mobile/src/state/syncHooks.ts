// Shared between the account and progress sync (plan 106), so neither imports the other.

/** Runs before signing out: the last save of this learner's progress to their account. */
export const beforeSignOut: { run: () => Promise<void> } = { run: async () => {} };

/** How the last progress sync went, for the account screen. */
export const lastSync: { done: boolean; failed: boolean } = { done: false, failed: false };
