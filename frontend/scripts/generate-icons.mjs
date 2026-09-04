#!/usr/bin/env node
/**
 * Gera os ícones do app a partir de `public/logo-am.png`.
 *
 * O monograma tem fundo transparente e traço fino: sobre a tela clara do
 * launcher ele sumiria. Por isso todos os ícones recebem o fundo onyx
 * arredondado da marca, com o monograma centralizado e uma margem segura.
 *
 *   npm run icons
 *
 * Saída em `public/icons/` + `public/favicon.svg`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public', 'logo-am.png');
const outputDir = join(root, 'public', 'icons');

const ONYX = { r: 11, g: 11, b: 13, alpha: 1 };

/**
 * @param {number} size      lado do ícone em px
 * @param {number} padding   fração do lado reservada como margem (0–0.5)
 * @param {number} radius    raio dos cantos em px (0 = quadrado, para maskable)
 */
async function renderIcon(size, padding, radius) {
  const inner = Math.round(size * (1 - padding * 2));

  const monogram = await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const base = sharp({
    create: { width: size, height: size, channels: 4, background: ONYX },
  }).composite([{ input: monogram, gravity: 'center' }]);

  if (radius <= 0) return base.png().toBuffer();

  // Máscara de cantos arredondados aplicada como canal alfa.
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
  );

  return sharp(await base.png().toBuffer())
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

const TARGETS = [
  // nome,                    lado, margem, raio
  ['favicon-32.png', 32, 0.12, 6],
  ['favicon-16.png', 16, 0.1, 3],
  ['apple-touch-icon.png', 180, 0.16, 40],
  ['pwa-192.png', 192, 0.16, 42],
  ['pwa-512.png', 512, 0.16, 112],
  // `maskable` precisa de margem generosa: o launcher recorta as bordas.
  ['pwa-maskable-512.png', 512, 0.26, 0],
];

await mkdir(outputDir, { recursive: true });

for (const [name, size, padding, radius] of TARGETS) {
  const buffer = await renderIcon(size, padding, radius);
  const destination = name.startsWith('apple') ? join(root, 'public', name) : join(outputDir, name);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, buffer);
  console.log(`  ${name.padEnd(24)} ${size}x${size}`);
}

// Favicon .ico (32px) para navegadores e feeds antigos.
await writeFile(join(root, 'public', 'favicon.ico'), await renderIcon(32, 0.12, 6));
console.log('  favicon.ico              32x32');

/**
 * Favicon vetorial: o "AM" redesenhado como duas letras douradas, para ficar
 * nítido em qualquer tamanho. O PNG cobre os navegadores sem suporte a SVG.
 */
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F3D28C"/>
      <stop offset="45%" stop-color="#CEA15C"/>
      <stop offset="100%" stop-color="#A5793D"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#0B0B0D"/>
  <g fill="none" stroke="url(#g)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 46 L26 18 L32 32"/>
    <path d="M30 46 L36 30 L44 42 L52 22 L52 46"/>
    <path d="M25 34a9 9 0 1 0 6 8"/>
  </g>
</svg>
`;

await writeFile(join(root, 'public', 'favicon.svg'), faviconSvg, 'utf8');
console.log('  favicon.svg              vetorial');

console.log('\nÍcones gerados em public/icons/.');
