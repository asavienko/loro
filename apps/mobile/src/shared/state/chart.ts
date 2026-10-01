// The player as an explicit statechart. `transition` refuses any event the
// chart doesn't allow in the current status, so an illegal transition is a
// visible no-op rather than an accident of branching. `chartAsMermaid` renders
// the same table for the docs (ui-ux-review/README.md).
import type { Phase, PlayerStatus } from './types';

export type PlayerEventType =
  | 'LOAD'
  | 'PLAY'
  | 'PAUSE'
  | 'PHASE_DONE'
  | 'NEXT'
  | 'PREV'
  | 'JUMP'
  | 'RATE'
  | 'UNRATE'
  | 'TOGGLE_SHUFFLE'
  | 'REORDER_UP_NEXT'
  | 'REMOVE_FROM_QUEUE'
  | 'INSERT_IN_QUEUE'
  | 'ENQUEUE'
  | 'CLEAR_QUEUE'
  | 'RESTORE_UP_NEXT';

/** Events that change only learner data, settings or the device: allowed in every status. */
export const ALWAYS_ALLOWED = [
  'COMMIT',
  'SET_PREFS',
  'TOGGLE_LIKE',
  'RATE_PHRASES',
  'UNRATE_PHRASES',
  'OWN_UPLOADED',
  'CONTENT_CHANGED',
  'SET_PROFILE',
  'RESTORE',
  'MERGE_REMOTE',
  'RESET',
] as const;

const QUEUE_EDITS: PlayerEventType[] = ['TOGGLE_SHUFFLE', 'REORDER_UP_NEXT', 'REMOVE_FROM_QUEUE', 'INSERT_IN_QUEUE', 'ENQUEUE', 'CLEAR_QUEUE', 'RESTORE_UP_NEXT'];

/** Which player events each status accepts. */
export const PLAYER_CHART: Record<PlayerStatus, readonly PlayerEventType[]> = {
  idle: ['LOAD', 'ENQUEUE'],
  playing: ['LOAD', 'PAUSE', 'PHASE_DONE', 'NEXT', 'PREV', 'JUMP', 'RATE', 'UNRATE', ...QUEUE_EDITS],
  paused: ['LOAD', 'PLAY', 'NEXT', 'PREV', 'JUMP', 'RATE', 'UNRATE', ...QUEUE_EDITS],
};

/** Where each status goes on the events that change it. */
export const STATUS_EDGES: { from: PlayerStatus; event: string; to: PlayerStatus }[] = [
  { from: 'idle', event: 'LOAD', to: 'playing' },
  { from: 'idle', event: 'ENQUEUE', to: 'paused' },
  { from: 'playing', event: 'PAUSE', to: 'paused' },
  { from: 'playing', event: 'PHASE_DONE (end of queue, or audio failed)', to: 'paused' },
  { from: 'playing', event: 'NEXT (past the end of a one-pass queue)', to: 'paused' },
  { from: 'paused', event: 'PLAY', to: 'playing' },
  { from: 'paused', event: 'LOAD', to: 'playing' },
  { from: 'paused', event: 'JUMP (play now)', to: 'playing' },
];

/**
 * One phrase: prompt → the learner's turn → target → the learner's echo, `repeats`
 * times; then a short hold for a rating if there is none yet; then the next phrase.
 */
export const PHASE_EDGES: { from: Phase; on: string; to: Phase | 'next phrase' }[] = [
  { from: 'native', on: 'spoken', to: 'pause' },
  { from: 'pause', on: 'silence over', to: 'target' },
  { from: 'target', on: 'spoken', to: 'echo' },
  { from: 'echo', on: 'silence over, more repetitions', to: 'native' },
  { from: 'echo', on: 'silence over, last repetition, unrated', to: 'rate' },
  { from: 'echo', on: 'silence over, last repetition, rated', to: 'next phrase' },
  { from: 'rate', on: 'rated, or hold over', to: 'next phrase' },
];

export function canHandle(status: PlayerStatus, type: string): boolean {
  if ((ALWAYS_ALLOWED as readonly string[]).includes(type)) return true;
  return (PLAYER_CHART[status] as readonly string[]).includes(type);
}

export function chartAsMermaid(): string {
  const lines = ['stateDiagram-v2', '  [*] --> idle'];
  for (const e of STATUS_EDGES) lines.push(`  ${e.from} --> ${e.to}: ${e.event}`);
  lines.push('  state playing {');
  lines.push('    [*] --> native');
  for (const e of PHASE_EDGES) lines.push(`    ${e.from} --> ${e.to === 'next phrase' ? 'native' : e.to}: ${e.on}`);
  lines.push('  }');
  return lines.join('\n');
}
