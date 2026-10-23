import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import hostingConfig from './.openai/hosting.json';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

// Serves api/activity.ts in `vite dev`, where Vercel functions don't run.
function activityApi(): Plugin {
  return {
    name: 'activity-api',
    configureServer(server) {
      Object.assign(process.env, {
        ...loadEnv('development', process.cwd(), 'ACTIVITY_'),
        ...process.env,
      });
      server.middlewares.use('/api/activity', async (req, res) => {
        try {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          // Native Node TS import: the Cloudflare plugin makes ssrLoadModule unusable.
          const { POST } = await import(
            `${pathToFileURL(resolve('api/activity.ts')).href}?t=${Date.now()}`
          );
          const response: Response = await POST(
            new Request('http://localhost/api/activity', {
              method: 'POST',
              body: Buffer.concat(chunks),
            }),
          );
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(await response.text());
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, message: String(error) }));
        }
      });
    },
  };
}

export default defineConfig(async () => {
  // Vercel serves this browser-only game as static HTML and assets.
  if (process.env.VERCEL) {
    return {
      css: { postcss: { plugins: [tailwindcss()] } },
      plugins: [vinext()],
    };
  }
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      activityApi(),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
});
