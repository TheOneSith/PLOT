import http from 'node:http';
import { readFile } from 'node:fs/promises';
import handler from './api/generate.js';
const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css','text/css'], '/icon.svg': ['icon.svg','image/svg+xml'], '/manifest.webmanifest': ['manifest.webmanifest','application/manifest+json'] };
http.createServer(async (req,res) => {
  if (req.url === '/api/generate') return handler(req,res);
  const file = files[req.url?.split('?')[0]];
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  try { res.setHeader('Content-Type',file[1]); res.end(await readFile(new URL(`./public/${file[0]}`,import.meta.url))); }
  catch { res.writeHead(500); res.end('Unable to load app'); }
}).listen(3000,'127.0.0.1',()=>console.log('Appunto: http://localhost:3000'));

