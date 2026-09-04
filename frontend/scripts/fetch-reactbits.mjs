#!/usr/bin/env node
/**
 * Baixa os componentes do React Bits do registry OFICIAL para dentro do repo.
 *
 *   https://reactbits.dev/r/<Componente>-TS-TW.json
 *
 * E a mesma fonte que `npx shadcn@latest add @react-bits/<Componente>-TS-TW`
 * consome (o registry esta declarado em `components.json`). Usamos o script no
 * build inicial para manter o controle das versoes das dependencias — a CLI
 * instalaria `react-router-dom@^6.30.1`, `motion@^12.23.12` etc. por conta
 * propria e uma delas quebraria o par React 18 / react-leaflet 4.
 *
 * Os arquivos ficam versionados em `src/components/reactbits/` e podem ser
 * customizados; rodar de novo SOBRESCREVE as customizacoes.
 *
 *   npm run reactbits              # baixa a lista fixada abaixo
 *   npm run reactbits -- Aurora    # baixa apenas os informados
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Componentes usados pelo app, conferidos um a um no catalogo real. */
const COMPONENTS = [
  // Fundos WebGL (ogl) — carregados sob demanda
  'Aurora',
  'LightRays',
  // Textura
  'Noise',
  // Texto
  'BlurText',
  'SplitText',
  'ShinyText',
  'GradientText',
  'CountUp',
  'Counter',
  // Cards e superficies
  'SpotlightCard',
  'GlareHover',
  // Navegacao
  'Dock',
  'PillNav',
  // Fluxo
  'Stepper',
  'AnimatedList',
  'AnimatedContent',
  'FadeContent',
  // Interacao
  'ClickSpark',
  'Magnet',
  'StarBorder',
  'ElectricBorder',
  'TargetCursor',
];

/**
 * Componentes que customizamos no repositorio. O script se recusa a
 * sobrescreve-los sem `--force` para nao apagar o trabalho por engano.
 * O que mudou em cada um esta anotado no topo do proprio arquivo.
 */
const CUSTOMIZED = new Set(['Stepper', 'AnimatedList']);

const VARIANT = 'TS-TW';
const REGISTRY = 'https://reactbits.dev/r';

const outputRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components', 'reactbits');

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const requested = argv.filter((arg) => !arg.startsWith('--'));
const list = requested.length > 0 ? requested : COMPONENTS;

const HEADER = (name) =>
  [
    `// ${name} — React Bits (https://reactbits.dev/), variante ${VARIANT}.`,
    `// Baixado de ${REGISTRY}/${name}-${VARIANT}.json por \`npm run reactbits\`.`,
    '// Versionado de proposito: pode ser customizado, mas o script sobrescreve.',
    '',
  ].join('\n');

let ok = 0;
const failures = [];

for (const name of list) {
  const itemName = `${name}-${VARIANT}`;
  const url = `${REGISTRY}/${itemName}.json`;

  if (CUSTOMIZED.has(name) && !force) {
    console.log(`  --  ${itemName.padEnd(26)} customizado no repo; use --force para sobrescrever`);
    ok += 1;
    continue;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const item = await response.json();
    if (!Array.isArray(item.files) || item.files.length === 0) {
      throw new Error('registry sem arquivos');
    }

    for (const file of item.files) {
      const destination = join(outputRoot, file.path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, HEADER(name) + file.content, 'utf8');
    }

    const deps = (item.dependencies ?? []).join(', ') || 'nenhuma';
    console.log(`  ok  ${itemName.padEnd(26)} deps: ${deps}`);

    if (item.registryDependencies?.length) {
      console.warn(`      ! depende de outros itens do registry: ${item.registryDependencies.join(', ')}`);
    }
    ok += 1;
  } catch (error) {
    failures.push(`${itemName}: ${error.message}`);
    console.error(`  ERRO ${itemName}: ${error.message}`);
  }
}

console.log(`\n${ok}/${list.length} componente(s) em src/components/reactbits/`);

if (failures.length > 0) {
  console.error('\nFalhas:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
