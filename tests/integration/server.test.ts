import { describe, it, expect } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp, type McpServerDeps } from '../../src/server.js';

const noopDeps: McpServerDeps = {
  recordWine: () => Promise.resolve({ ok: true, wineId: 'x', recordedAt: 'x' }),
};

describe('MCP サーバー骨組み', () => {
  it('GET /health は 200 と {status:"ok"} を返す', async () => {
    const app = createApp(noopDeps);
    const srv = app.listen(0);
    try {
      const { port } = srv.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'ok' });
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });
});
