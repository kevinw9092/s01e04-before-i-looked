import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus, StatusCounts } from './types.js';

// Plan morning-digest § 1. The log is parsed at the edge (`parseLine`); everything after it
// works on typed runs. The only I/O is `readNight` reading one file.

type Run = { at: string; instant: number; job: string; status: RunStatus; owner: string | null; error: string | null };

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
// An instant with an explicit offset, so the time means the same thing on every machine.
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

export function isNight(s: string): boolean {
  return NIGHT.test(s);
}

function isStatus(v: unknown): v is RunStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

// One line → a Run, or null when it doesn't hold one. `owner` and `error` may be absent or null.
export function parseLine(line: string): Run | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { at, job, status, owner = null, error = null } = o;
  if (typeof at !== 'string' || !AT.test(at)) return null;
  const instant = Date.parse(at);
  if (Number.isNaN(instant)) return null;
  if (typeof job !== 'string' || job.trim() === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== null && typeof error !== 'string') return null;
  return { at, instant, job, status, owner, error };
}

function toRow(job: string, runs: Run[]): DigestRow {
  // Order by instant, not by string (offsets may differ); ties keep file order (sort is stable).
  const sorted = [...runs].sort((a, b) => a.instant - b.instant);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const lastWithError = sorted.findLast((r) => r.error !== null);
  return {
    job,
    owner: last.owner,
    runs: sorted.length,
    retries: sorted.filter((r) => r.status === 'retry').length,
    lastStatus: last.status,
    lastError: lastWithError?.error ?? null,
    firstAt: first.at,
    lastAt: last.at,
  };
}

// Pure: the text of one night's file → the night.
export function parseNight(night: string, text: string): Night {
  const byJob = new Map<string, Run[]>();
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const run = parseLine(line);
    if (!run) {
      badLines++;
      continue;
    }
    counts[run.status]++;
    const list = byJob.get(run.job);
    if (list) list.push(run);
    else byJob.set(run.job, [run]);
  }
  const rows = [...byJob.keys()]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((job) => toRow(job, byJob.get(job)!));
  return { night, rows, badLines, counts };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!isNight(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ENOENT') return null;
    throw e;
  }
  return parseNight(night, text);
};
