/**
 * Servir o app (SPA) pelo proprio backend.
 *
 * Permite subir TUDO como um unico Web Service no Render, em vez de um Web
 * Service + um Static Site. As vantagens sao concretas:
 *   - mesma origem, entao CORS deixa de existir como problema;
 *   - uma URL so — nada de casar `APP_URL` com `VITE_API_URL` na mao, que era
 *     onde o primeiro deploy costumava travar;
 *   - um servico so para monitorar.
 *
 * O custo: o Web Service gratuito dorme apos 15 min sem trafego, entao o app
 * inteiro fica sujeito ao cold start (~1 min). O monitor de keep-alive descrito
 * no README ja era obrigatorio por causa do Slack (que exige `ack` em 3 s), e
 * resolve os dois casos de uma vez.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import express, { type IRouter, type NextFunction, type Request, type Response } from 'express';
import { createLogger } from './lib/logger';

const log = createLogger('static');

/** Caminhos que pertencem a API e nunca devem cair no `index.html`. */
const API_PREFIXES = ['/slack', '/admin', '/health'];

/**
 * Procura o `dist` do frontend.
 * O `startCommand` do Render pode rodar da raiz do repositorio ou de dentro de
 * `backend/`, entao tentamos as duas formas — e `__dirname` (que aponta para
 * `backend/dist`) e o caminho mais confiavel dos dois.
 */
function findFrontendDist(): string | null {
  const candidates = [
    process.env.FRONTEND_DIST,
    resolve(__dirname, '..', '..', 'frontend', 'dist'),
    resolve(process.cwd(), 'frontend', 'dist'),
    resolve(process.cwd(), '..', 'frontend', 'dist'),
  ].filter((path): path is string => Boolean(path));

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }

  return null;
}

function isApiPath(path: string): boolean {
  return API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Monta o app estatico e o fallback de SPA no router.
 * Devolve `false` quando o `dist` nao existe — util em desenvolvimento, onde o
 * frontend roda no Vite em outra porta.
 */
export function serveFrontend(router: IRouter): boolean {
  const dist = findFrontendDist();

  if (!dist) {
    log.info('frontend/dist nao encontrado — servindo apenas a API.');
    return false;
  }

  const indexHtml = join(dist, 'index.html');

  router.use(
    express.static(dist, {
      // O fallback abaixo cuida do `/`; sem isso o `index.html` seria servido
      // sem os cabecalhos de cache que definimos.
      index: false,
      setHeaders: (response, filePath) => {
        // O service worker nao pode ficar em cache, senao a atualizacao do PWA
        // demora a chegar aos celulares.
        if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
          response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return;
        }
        // Os demais arquivos do build tem hash no nome: podem ser eternos.
        if (filePath.includes(`${'assets'}`)) {
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  /**
   * Fallback da SPA: qualquer rota desconhecida devolve o `index.html` e o
   * React Router resolve. Escrito como middleware (e nao como rota com `*`)
   * porque o Express 5 mudou a sintaxe de curinga e essa forma e mais clara
   * sobre o que fica de fora.
   */
  router.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return next();
    if (isApiPath(request.path)) return next();
    // Tem extensao e o `express.static` nao achou: e um arquivo que nao existe.
    // Devolver o `index.html` aqui esconderia o 404 e quebraria o cache do PWA.
    if (/\.[a-zA-Z0-9]{1,8}$/.test(request.path)) return next();

    response.sendFile(indexHtml);
  });

  log.info(`servindo o app de ${dist}`);
  return true;
}
