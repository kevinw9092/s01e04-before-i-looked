import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseNight, readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28')!;

  it('has 5 jobs, sorted, and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
  });

  it('builds one row per job', () => {
    const fixtures = night.rows.find((r) => r.job === 'fixtures/refresh');
    expect(fixtures).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const sync = night.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held' });
    expect(sync?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync?.lastAt).toBe('2026-10-29T05:00:04+01:00');
    expect(night.rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(night.rows.find((r) => r.job === 'digest/render')).toMatchObject({ owner: null, lastError: null });
  });

  it('counts lines by status', () => {
    expect(night.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });
});

describe('readNight on a temp runs dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null for a night with no file, and for a name that is not a night', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
    expect(readNight(dir, '../runs/2026-10-28')).toBeNull();
  });

  it('reads an empty file as a night with nothing in it', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({
      night: '2026-01-02',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('keeps a row whose owner is null', () => {
    writeFileSync(join(dir, '2026-01-03.jsonl'), '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":null}\n');
    const night = readNight(dir, '2026-01-03');
    expect(night?.rows).toHaveLength(1);
    expect(night?.rows[0]?.owner).toBeNull();
  });
});

describe('parseNight', () => {
  it('counts bad lines (bad JSON, missing or invalid fields) and keeps going', () => {
    const text = [
      'not json',
      '[]',
      '{"job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-01T01:00:00","job":"a","status":"ok","owner":"x"}',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"done","owner":"x"}',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":7}',
      '',
      '{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
    ].join('\r\n');
    const night = parseNight('2026-01-01', text);
    expect(night.badLines).toBe(6);
    expect(night.rows).toHaveLength(1);
  });

  it('orders by instant across offsets and keeps the time as written', () => {
    const text = [
      '{"at":"2026-01-01T01:30:00+01:00","job":"a","status":"fail","owner":"x","error":"boom"}',
      '{"at":"2026-01-01T00:45:00Z","job":"a","status":"ok","owner":"y"}',
      '{"at":"2026-01-01T03:00:00+03:00","job":"a","status":"retry","owner":"z","error":"early"}',
    ].join('\n');
    const [row] = parseNight('2026-01-01', text).rows;
    // instants: 00:30Z (fail), 00:45Z (ok), 00:00Z (retry)
    expect(row).toEqual({
      job: 'a',
      owner: 'y',
      runs: 3,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'boom',
      firstAt: '2026-01-01T03:00:00+03:00',
      lastAt: '2026-01-01T00:45:00Z',
    });
  });
});
