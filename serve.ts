// A tiny static server for game/ (Node 22, standard library only), so the
// entry can be played locally without a build step:
//
//   node serve.ts                    serves game/ on http://localhost:8080
//   node serve.ts --port 9000        pick a different port
//   node serve.ts --host 0.0.0.0     listen on all interfaces (LAN play)
//
// It sends the MIME types a browser game needs, refuses any path outside
// game/, and otherwise does nothing clever: this is a development
// convenience, not a web server for the internet.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const requested = portIndex === -1 ? 8080 : Number(args[portIndex + 1]);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 8080;
const hostIndex = args.indexOf('--host');
const host = hostIndex === -1 ? '127.0.0.1' : (args[hostIndex + 1] ?? '127.0.0.1');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

function sendError(response: { writeHead: (code: number) => { end: (msg: string) => void } }, code: number, msg: string) {
  response.writeHead(code).end(msg);
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendError(response, 400, 'bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  // Refuse anything outside game/, including `..` escapes.
  if (file !== root && !file.startsWith(root + sep)) {
    sendError(response, 403, 'forbidden');
    return;
  }
  let size: number;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    sendError(response, 404, 'not found');
    return;
  }
  response.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  // One log line per request, so a missing file is easy to spot while
  // developing. Nothing is logged to disk.
  console.log(`${request.method} ${pathname} -> ${size} bytes`);
  // HEAD asks for the headers only (a quick "is the game there?" check).
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
}).listen(port, host, () => {
  console.log(`game/ is on http://${host}:${port}`);
});
