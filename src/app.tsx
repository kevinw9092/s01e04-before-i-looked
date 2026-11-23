import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestPage, NoDigest } from './views/digest.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const name = c.req.param('night');
    const night = readNight(config.runsDir, name);
    const title = `digest · ${name}`;
    if (!night) {
      return c.html(
        <Layout title={title} lane={lane()}>
          <NoDigest night={name} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={title} lane={lane()}>
        <DigestPage night={night} />
      </Layout>,
    );
  });

  // Same reader, same rows, same order as the page (ADR 0001).
  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const found = readNight(config.runsDir, night);
    if (!found) return c.json({ error: `no run log for ${night}` }, 404);
    return c.json(found);
  });

  return app;
}
