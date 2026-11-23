import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' });

describe('GET /digest/:night', () => {
  it('renders the night with marked rows', async () => {
    const res = await app.request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('⚠ fail');
    expect(html).toContain('⚠ retries');
  });

  it('404s for a missing night', async () => {
    expect((await app.request('/digest/2020-01-01')).status).toBe(404);
  });
});
