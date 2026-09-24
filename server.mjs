import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { generate } from './api/generate.js';
const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css','text/css'], '/icon.svg': ['icon.svg','image/svg+xml'], '/manifest.webmanifest': ['manifest.webmanifest','application/manifest+json'] };
http.createServer(async (req,res) => {
  if (req.url === '/api/generate') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request('http://localhost:3000/api/generate', { method: req.method, headers: req.headers, body });
    const response = await generate(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    return res.end(Buffer.from(await response.arrayBuffer()));
  }
  const file = files[req.url?.split('?')[0]];
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  try { res.setHeader('Content-Type',file[1]); res.end(await readFile(new URL(`./public/${file[0]}`,import.meta.url))); }
  catch { res.writeHead(500); res.end('Unable to load app'); }
}).listen(3000,'127.0.0.1',()=>console.log('Appunto: http://localhost:3000'));

