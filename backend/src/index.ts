/**
 * AM Marketing — backend.
 *
 * Um unico servico com tres papeis (secao 3):
 *   1. Ponte com o Slack (Bolt sobre ExpressReceiver, em `/slack/events`).
 *   2. Guardiao das acoes privilegiadas (`/admin/*`, autenticadas por PIN).
 *   3. Ouvinte do Firestore, que transforma o que o app escreve em mensagens do
 *      Slack — com catch-up no boot para nada se perder enquanto o servico
 *      gratuito do Render dorme.
 */
import cors from 'cors';
import express from 'express';
import { env } from './env';
import { createLogger, describeError } from './lib/logger';
import { createAdminRouter } from './routes/admin';
import { registerSlackActions } from './slack/actions';
import { receiver, slackApp } from './slack/client';
import { serveFrontend } from './static';
import { runCatchUp, startWatchers, stopWatchers } from './watchers';

const log = createLogger('server');

const bootedAt = Date.now();

/**
 * Rede de seguranca contra falhas assincronas do Slack.
 *
 * Todas as chamadas ao Slack no nosso codigo sao best-effort e ja tratam erro,
 * mas o proprio Bolt dispara chamadas em segundo plano (a validacao do token no
 * boot, por exemplo). Uma delas falhando — token trocado, limite de taxa, uma
 * instabilidade de rede — virava uma rejeicao nao tratada que **derrubava o
 * processo**. No plano gratuito do Render, cair significa subir de novo em
 * ~1 min: exatamente a janela em que o Slack desiste de esperar o `ack`.
 *
 * A verdade do sistema esta no Firestore, e o HTTP e os listeners nao dependem
 * do Slack estar respondendo. Entao registrar e seguir e mais seguro, aqui, do
 * que morrer: o pior caso vira uma mensagem que nao saiu, e o catch-up do
 * proximo boot a recupera.
 */
function installCrashGuards(): void {
  process.on('unhandledRejection', (reason) => {
    log.error('promise rejeitada sem tratamento (seguindo em frente)', describeError(reason));
  });

  process.on('uncaughtException', (error) => {
    log.error('excecao nao capturada (seguindo em frente)', describeError(error));
  });
}

async function main(): Promise<void> {
  installCrashGuards();

  // `app` é o Express em si; `router` é onde o Bolt monta `/slack/events` e
  // onde penduramos as nossas rotas.
  const { app, router } = receiver;

  // O Render fica atras de um proxy: sem isso, `request.ip` seria sempre o do
  // proxy e o rate limit do PIN valeria para o mundo inteiro junto.
  app.set('trust proxy', 1);

  /**
   * CORS restrito ao app (secao 10). O endpoint do Slack nao passa por aqui:
   * o Slack nao e um navegador e nao manda `Origin`.
   *
   * Com tudo num servico so, o app e a API tem a MESMA origem e o navegador
   * nem chega a fazer preflight — isto continua aqui para o caso de o frontend
   * ser publicado a parte (Static Site), onde a origem e outra.
   */
  router.use(
    '/admin',
    cors({
      origin: env.appUrl,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    })
  );

  router.use('/admin', express.json({ limit: '128kb' }));
  router.use('/admin', createAdminRouter());

  /**
   * Health check leve, para o monitor externo de keep-alive (secao 9).
   * Nao toca o Firestore de proposito: sao milhares de chamadas por mes, e o
   * plano Spark cobra por leitura.
   */
  router.get('/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'am-marketing-api',
      uptimeSeconds: Math.round((Date.now() - bootedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * O app (SPA) sai do mesmo servico — por isso um unico Web Service basta.
   * Vem DEPOIS das rotas da API: `/slack/events`, `/admin/*` e `/health` sao
   * resolvidos antes de qualquer coisa cair no `index.html`.
   */
  const servingApp = serveFrontend(router);

  if (!servingApp) {
    router.get('/', (_request, response) => {
      response.type('text/plain').send('AM Marketing API — veja /health.');
    });
  }

  registerSlackActions();

  await slackApp.start(env.port);
  log.info(`ouvindo na porta ${env.port} (app: ${env.appUrl})`);

  // Primeiro o catch-up (processa o que ficou parado), depois os listeners.
  await runCatchUp();
  startWatchers();

  const shutdown = (signal: string) => {
    log.info(`recebi ${signal}, encerrando…`);
    stopWatchers();
    slackApp
      .stop()
      .catch((error) => log.error('falha ao parar o Bolt', describeError(error)))
      .finally(() => process.exit(0));
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  log.error('falha ao subir o servidor', describeError(error));
  process.exit(1);
});
