// The review log as it is stored: rows of numbers and short codes, with the
// repeated strings (memory keys, set ids, devices, local days) in tables. The same entries
// as plain objects are about three times larger, and localStorage holds about
// 5 MB, so this is what lets years of history fit. Only storage uses it: the
// state in memory and the sync format keep plain entries.
import type { Grade, LogEntry } from './types';

export const LOG_FORMAT = 'rows-1';

// A heard or rated row ends with its local day's index, when it has one (older entries don't).
type Row =
  | ['h', string, number, number, number, number, number | null, number | null, number?]
  | ['r', string, number, number, number, number, 0 | 1 | 2, number?]
  | ['c', string, number, number, number];

export interface CompactLog {
  format: typeof LOG_FORMAT;
  keys: string[];
  sets: (string | null)[];
  devices: string[];
  /** Absent in logs stored before entries had a day. */
  days?: string[];
  rows: Row[];
}

const GRADES: Grade[] = ['missed', 'hard', 'easy'];

export function encodeLog(log: LogEntry[]): CompactLog {
  const tables = { keys: new Map<string, number>(), sets: new Map<string | null, number>(), devices: new Map<string, number>(), days: new Map<string, number>() };
  const index = <T>(map: Map<T, number>, value: T) => {
    let i = map.get(value);
    if (i === undefined) map.set(value, (i = map.size));
    return i;
  };
  const rows: Row[] = log.map((e) => {
    const device = index(tables.devices, e.device);
    if (e.kind === 'carryover') return ['c', e.id, e.at, device, e.points];
    const key = index(tables.keys, e.key);
    const set = index(tables.sets, e.setId);
    const day: [] | [number] = e.day === undefined ? [] : [index(tables.days, e.day)];
    if (e.kind === 'heard') return ['h', e.id, e.at, device, key, set, e.targetMs, e.nativeMs, ...day];
    return ['r', e.id, e.at, device, key, set, GRADES.indexOf(e.grade) as 0 | 1 | 2, ...day];
  });
  return {
    format: LOG_FORMAT,
    keys: [...tables.keys.keys()],
    sets: [...tables.sets.keys()],
    devices: [...tables.devices.keys()],
    days: [...tables.days.keys()],
    rows,
  };
}

const isCompact = (value: unknown): value is CompactLog =>
  typeof value === 'object' && value !== null && (value as { format?: unknown }).format === LOG_FORMAT;

/**
 * Stored log → plain entries, unvalidated (persistence sanitises them). A
 * plain array passes through, so older saves still load.
 */
export function decodeLog(value: unknown): unknown {
  if (!isCompact(value) || !Array.isArray(value.rows)) return value;
  const { keys = [], sets = [], devices = [], days = [] } = value;
  return (value.rows as unknown[]).flatMap((row): Record<string, unknown>[] => {
    if (!Array.isArray(row)) return [];
    const [code, id, at, device] = row;
    const base = { id, at, device: devices[device as number] };
    if (code === 'c') return [{ ...base, kind: 'carryover', points: row[4] }];
    const key = keys[row[4] as number];
    const withKey = { ...base, key, phraseId: typeof key === 'string' ? key.slice(key.indexOf(':') + 1) : undefined, setId: sets[row[5] as number] ?? null };
    const dayAt = (i: number) => (typeof row[i] === 'number' && typeof days[row[i] as number] === 'string' ? { day: days[row[i] as number] } : {});
    if (code === 'h') return [{ ...withKey, kind: 'heard', targetMs: row[6], nativeMs: row[7], ...dayAt(8) }];
    if (code === 'r') return [{ ...withKey, kind: 'rated', grade: GRADES[row[6] as number], ...dayAt(7) }];
    return [];
  });
}
