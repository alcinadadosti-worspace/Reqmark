#!/usr/bin/env node
/**
 * Copia os modulos de `shared/` para dentro de cada pacote.
 *
 * Por que copiar em vez de importar de fora do pacote: o Render constroi cada
 * servico com um `rootDir` proprio (`frontend/` e `backend/`), e tanto o `tsc`
 * do backend quanto o Vite ficam bem mais simples quando todo o codigo-fonte
 * vive dentro do pacote. As copias sao versionadas no repositorio, entao o
 * build funciona mesmo sem rodar este script.
 *
 * Fonte da verdade: `shared/*.ts`. Rode `npm run sync:shared` depois de editar.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'shared');

const targets = [join(root, 'frontend', 'src', 'shared'), join(root, 'backend', 'src', 'shared')];

const HEADER = [
  '// ATENCAO: arquivo gerado. Nao edite aqui.',
  '// Fonte: /shared — rode `npm run sync:shared` na raiz para atualizar.',
  '',
].join('\n');

if (!existsSync(source)) {
  console.log('[sync:shared] pasta /shared ausente — usando as copias ja versionadas.');
  process.exit(0);
}

const files = readdirSync(source).filter((f) => f.endsWith('.ts'));
let written = 0;

for (const target of targets) {
  if (!existsSync(dirname(target))) {
    console.log(`[sync:shared] ignorando ${target} (pacote nao instalado aqui).`);
    continue;
  }
  mkdirSync(target, { recursive: true });
  for (const file of files) {
    const body = readFileSync(join(source, file), 'utf8');
    const next = `${HEADER}${body}`;
    const dest = join(target, file);
    const current = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
    if (current !== next) {
      writeFileSync(dest, next, 'utf8');
      written += 1;
    }
  }
}

console.log(`[sync:shared] ${files.length} arquivo(s) sincronizado(s); ${written} atualizado(s).`);
