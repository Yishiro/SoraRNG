// Temporary public sharing of the production build; never expose next dev.
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const directory = path.join(root, '.local', 'public-share');
const statusFile = path.join(directory, 'status.json');
const stopFile = path.join(directory, 'stop');
await mkdir(directory, { recursive: true });
if (process.argv.includes('--stop')) {
  // The running manager watches this marker; no PID-based termination of unrelated processes.
  await writeFile(stopFile, new Date().toISOString());
  console.log('Arrêt demandé au partage public.');
  process.exit(0);
}
let old;
try {
  old = JSON.parse(await readFile(statusFile, 'utf8'));
} catch {}
if (old?.managerPid) {
  try {
    process.kill(old.managerPid, 0);
    throw new Error(
      'Un partage est déjà actif : utiliser share:stop avant de relancer.',
    );
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}
await access(path.join(root, '.next', 'BUILD_ID'));
const binary = path.join(root, '.local', 'bin', 'cloudflared.exe');
await access(binary);
const started = Date.now();
let server,
  tunnel,
  stopping = false;
const status = {
  startedAt: new Date(started).toISOString(),
  managerPid: process.pid,
  status: 'starting',
  temporary: true,
};
const save = () =>
  writeFile(statusFile, JSON.stringify(status, null, 2) + '\n');
async function stop(message) {
  if (stopping) return;
  stopping = true;
  clearInterval(watcher);
  for (const child of [tunnel, server])
    if (child?.pid) {
      try {
        if (process.platform === 'win32')
          execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true,
          });
        else child.kill('SIGTERM');
      } catch {}
    }
  status.status = 'stopped';
  status.message = message;
  await save();
  process.exit(message === 'requested' ? 0 : 1);
}
const watcher = setInterval(async () => {
  try {
    const marker = await readFile(stopFile, 'utf8');
    if (Date.parse(marker) >= started) await stop('requested');
  } catch {}
}, 1000);
process.on('SIGINT', () => void stop('requested'));
process.on('SIGTERM', () => void stop('requested'));
await save();
try {
  const url = await new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(
      () => reject(new Error('Tunnel startup timed out')),
      60000,
    );
    tunnel = spawn(
      binary,
      [
        'tunnel',
        '--no-autoupdate',
        '--protocol',
        'http2',
        '--url',
        'http://127.0.0.1:3001',
      ],
      { cwd: root, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    status.tunnelPid = tunnel.pid;
    tunnel.stderr.on('data', (chunk) => {
      buffer = (buffer + chunk.toString()).slice(-16000);
      const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    });
    tunnel.on('error', () => {
      clearTimeout(timeout);
      reject(new Error('Tunnel failed to start'));
    });
    tunnel.on('exit', () => {
      clearTimeout(timeout);
      reject(new Error('Tunnel stopped'));
      if (status.status === 'ready') void stop('tunnel-stopped');
    });
  });
  status.url = url;
  const require = createRequire(import.meta.url);
  server = spawn(
    process.execPath,
    [
      require.resolve('next/dist/bin/next'),
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3001',
    ],
    {
      cwd: root,
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NEXTAUTH_URL: url,
        NEXTAUTH_URL_INTERNAL: 'http://127.0.0.1:3001',
        AUTH_SECRET: randomBytes(48).toString('hex'),
        ADMIN_DISCORD_IDS: '',
        MODERATOR_DISCORD_IDS: '',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  );
  status.serverPid = server.pid;
  server.on('error', () => void stop('server-error'));
  server.on('exit', () => {
    if (!stopping) void stop('server-stopped');
  });
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://127.0.0.1:3001/api/catalog', {
        signal: AbortSignal.timeout(2000),
      });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Production server unavailable');
  for (const endpoint of [
    '/api/local-card-assets',
    '/api/local-card-assets/KH-001',
    '/public/assets/cards/KH-001.webp',
  ]) {
    const response = await fetch(`http://127.0.0.1:3001${endpoint}`);
    if (response.status !== 404)
      throw new Error('Local media isolation failed');
  }
  status.status = 'ready';
  await save();
  console.log(`Public temporary URL: ${url}`);
} catch {
  await stop('startup-failed');
}
