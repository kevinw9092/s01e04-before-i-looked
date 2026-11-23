// Plan morning-digest § 1. The contract between the run log reader and everything that shows
// it (page, JSON route, board link). Implementation: `readNight` in `src/digest/reader.ts`,
// typed as `ReadNight` below:
//
//   import { readNight } from './digest/reader.js';
//   const night = readNight(config.runsDir, '2026-10-28'); // Night | null

/** One line of `runs/<night>.jsonl` is one run of one job, with one of these statuses. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One row per job for the night. Strings are kept exactly as the log wrote them. */
export type DigestRow = {
  job: string;
  /** Owner on the job's latest line. `null` is kept; the views show it as `—`. */
  owner: string | null;
  /** Number of (good) lines for this job. */
  runs: number;
  /** Number of `retry` lines for this job. */
  retries: number;
  /** Status of the job's latest line. */
  lastStatus: RunStatus;
  /**
   * The most recent error seen for this job: the `error` of the latest line that has one, even
   * if a later line succeeded (a job that retried and then went `ok` still shows why it
   * retried). `null` when no line of the job carried an error.
   */
  lastError: string | null;
  /** Earliest `at` for the job, as written in the log (offset kept, never converted to UTC). */
  firstAt: string;
  /** Latest `at` for the job, as written in the log (offset kept, never converted to UTC). */
  lastAt: string;
};

/**
 * Lines per status over the whole night, counting good lines only (a job with 3 retries and an
 * ok adds 3 to `retry` and 1 to `ok`). Bad lines are in `Night.badLines`, not here.
 */
export type StatusCounts = Record<RunStatus, number>;

/** A night whose file exists. An empty file is a Night with no rows ("nothing ran"). */
export type Night = {
  /** `YYYY-MM-DD`, the file name without `.jsonl`. */
  night: string;
  /** One row per job, sorted by job. */
  rows: DigestRow[];
  /**
   * Lines that didn't parse: bad JSON, or a missing/invalid `at`, `job` or `status`, or an
   * `owner`/`error` of the wrong type. Counted, never thrown. Blank lines are not counted.
   */
  badLines: number;
  counts: StatusCounts;
};

/**
 * Reads `<runsDir>/<night>.jsonl`. Returns `null` when there is no such file (the page 404s),
 * including when `night` isn't a `YYYY-MM-DD` name. Never throws on file content.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
