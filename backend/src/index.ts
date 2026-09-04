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
import { runCatchUp, startWatchers, stopWatchers } from './watchers';

const log = createLogger('server');

const bootedAt = Date.now();

async function main(): Promise<void> {
  // `app` é o Express em si; `router` é onde o Bolt monta `/slack/events` e
  // onde penduramos as nossas rotas.
  const { app, router } = receiver;

  // O Render fica atras de um proxy: sem isso, `request.ip` seria sempre o do
  // proxy e o rate limit do PIN valeria para o mundo inteiro junto.
  app.set('trust proxy', 1);

  /**
   * CORS restrito ao app (secao 10). O endpoint do Slack nao passa por aqui:
   * o Slack nao e um navegador e nao manda `Origin`.
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

  router.get('/', (_request, response) => {
    response.type('text/plain').send('AM Marketing API — veja /health.');
  });

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
