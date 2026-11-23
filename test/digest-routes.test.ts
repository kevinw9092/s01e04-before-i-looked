import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Fixture nights live in a temp dir; runs/ is read-only and never touched here.
let runsDir: string;

const config = () => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

const LINES_01 = [
  '{"at":"2026-01-01T23:00:00+01:00","job":"notes/backup","status":"ok","owner":null}',
  '{"at":"2026-01-01T23:10:00+01:00","job":"digest/render","status":"retry","owner":"kevin","error":"render timeout"}',
  '{"at":"2026-01-01T23:20:00+01:00","job":"digest/render","status":"ok","owner":"kevin"}',
].join('\n');

const LINES_03 = [
  '{"at":"2026-01-03T23:00:00+01:00","job":"lane/sync","status":"ok","owner":"kevin"}',
  '{"at":"2026-10-28T23:00',
].join('\n');

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(runsDir, '2026-01-01.jsonl'), LINES_01 + '\n');
  writeFileSync(join(runsDir, '2026-01-02.jsonl'), '');
  writeFileSync(join(runsDir, '2026-01-03.jsonl'), LINES_03 + '\n');
  process.env.LANE_MARKER = 'TEST-MARKER';
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night (HTML)', () => {
  it('returns 200 with one row per job, the lane banner, and owner null as an em dash', async () => {
    const res = await createApp(config()).request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('notes/backup');
    expect(html).toContain('digest/render');
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('—');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config()).request('/digest/2026-02-14');
    expect(res.status).toBe(404);
  });

  it('shows "nothing ran" for an empty night', async () => {
    const res = await createApp(config()).request('/digest/2026-01-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('still renders the valid job on a night with a bad line', async () => {
    const res = await createApp(config()).request('/digest/2026-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('returns 200 with night, rows, badLines and counts, rows sorted by job', async () => {
    const res = await createApp(config()).request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      night: string;
      rows: Array<Record<string, unknown>>;
      badLines: number;
      counts: Record<string, number>;
    };
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(0);
    expect(body.counts).toEqual({ ok: 2, retry: 1, fail: 0 });
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'notes/backup']);
    expect(Object.keys(body.rows[0]!).sort()).toEqual(
      ['firstAt', 'job', 'lastAt', 'lastError', 'lastStatus', 'owner', 'retries', 'runs'].sort(),
    );
  });

  it('keeps owner null in JSON and reports the retry as a row field', async () => {
    const res = await createApp(config()).request('/api/digest/2026-01-01');
    const body = (await res.json()) as { rows: Array<Record<string, unknown>> };
    const backup = body.rows.find((r) => r.job === 'notes/backup');
    const render = body.rows.find((r) => r.job === 'digest/render');
    expect(backup).toMatchObject({ owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null });
    expect(render).toMatchObject({
      owner: 'kevin',
      runs: 2,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'render timeout',
      firstAt: '2026-01-01T23:10:00+01:00',
      lastAt: '2026-01-01T23:20:00+01:00',
    });
  });

  it('returns 404 with an error body for a night with no file', async () => {
    const res = await createApp(config()).request('/api/digest/2026-02-14');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: unknown };
    expect(typeof body.error).toBe('string');
  });

  it('returns 200 with no rows for the empty night', async () => {
    const res = await createApp(config()).request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: unknown[]; badLines: number };
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('returns 200 and counts the bad line on a night with one', async () => {
    const res = await createApp(config()).request('/api/digest/2026-01-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: Array<{ job: string }>; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync']);
  });
});

describe('page and JSON agree', () => {
  it('lists the jobs in the HTML in the same order as the JSON rows', async () => {
    const app = createApp(config());
    const html = await (await app.request('/digest/2026-01-01')).text();
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as {
      rows: Array<{ job: string }>;
    };
    const positions = body.rows.map((r) => html.indexOf(r.job));
    positions.forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
