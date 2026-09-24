import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js', 'icon.svg', 'manifest.webmanifest']) await copyFile(`public/${file}`, `dist/${file}`);
console.log('Appunto: static assets ready. API deployed by Vercel.');

