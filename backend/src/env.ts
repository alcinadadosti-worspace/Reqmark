/**
 * Variaveis de ambiente do backend.
 *
 * Tudo que e segredo vive so aqui (restricao 6). O processo se recusa a subir
 * sem o essencial: falhar no boot com uma mensagem clara e muito melhor do que
 * descobrir a falta de um token na primeira requisicao do Slack.
 */
import { resolve } from 'node:path';
import { config } from 'dotenv';

/**
 * Carrega o `.env` da RAIZ do repositorio e, se existir, o do proprio pacote.
 *
 * A raiz vem primeiro porque e onde mora o arquivo unico que serve os dois
 * lados (o build do frontend le o mesmo, via `envDir` no vite.config). O
 * `backend/.env` continua funcionando para quem prefere separar.
 *
 * Precisa ser caminho absoluto: `npm run seed` roda com o cwd em `backend/`,
 * enquanto `npm start` no Render roda a partir da raiz.
 */
config({
  path: [resolve(__dirname, '..', '..', '.env'), resolve(__dirname, '..', '.env')],
  // Variaveis ja definidas no ambiente (o painel do Render) sempre vencem.
  override: false,
});

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Variavel de ambiente ausente: ${name}. Veja .env.example na raiz e o README (secao Deploy).`
    );
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  // Slack
  slackBotToken: required('SLACK_BOT_TOKEN'),
  slackSigningSecret: required('SLACK_SIGNING_SECRET'),
  adminSlackId: optional('ADMIN_SLACK_ID', 'U09F9LWM6MC'),

  // Firebase
  firebaseServiceAccountB64: required('FIREBASE_SERVICE_ACCOUNT_B64'),

  // Acesso administrativo
  adminPin: required('ADMIN_PIN'),
  adminTokenSecret: required('ADMIN_TOKEN_SECRET'),

  /**
   * URL publica do app — usada nos links "Abrir no app" das mensagens do Slack
   * e como origem permitida no CORS.
   *
   * Com tudo num unico Web Service, o proprio Render informa a URL em
   * `RENDER_EXTERNAL_URL`, entao `APP_URL` so precisa ser preenchida quando o
   * frontend e publicado a parte (Static Site) ou com dominio proprio.
   */
  appUrl: optional('APP_URL', optional('RENDER_EXTERNAL_URL', 'http://localhost:8080')).replace(
    /\/+$/,
    ''
  ),
  port: Number(optional('PORT', '8080')),

  isProduction: process.env.NODE_ENV === 'production',
};

/** Validade do token administrativo: 12 horas (secao 10). */
export const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

/** Monta o link para um ticket no app. */
export function ticketUrl(requestId: string): string {
  return `${env.appUrl}/requisicoes/${requestId}`;
}
