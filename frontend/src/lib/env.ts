/**
 * Variaveis de ambiente do frontend.
 *
 * Tudo aqui e PUBLICO (vai para dentro do bundle). A config web do Firebase e
 * publica por design: quem protege os dados sao as `firestore.rules`, nunca
 * essas chaves.
 */

const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

function read(key: string): string {
  return (import.meta.env[key] as string | undefined)?.trim() ?? '';
}

export const firebaseConfig = {
  apiKey: read('VITE_FIREBASE_API_KEY'),
  authDomain: read('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: read('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: read('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: read('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: read('VITE_FIREBASE_APP_ID'),
};

/**
 * URL do backend, sem barra no final.
 *
 * Vazia significa MESMA ORIGEM — que e o caso quando o app e a API sobem juntos
 * num unico Web Service (as chamadas viram `/admin/...` relativas). Só precisa
 * ser preenchida quando o frontend é publicado à parte, como Static Site.
 */
export const API_URL = read('VITE_API_URL').replace(/\/+$/, '');

/** Nomes das variaveis que faltam — a UI mostra isso em vez de quebrar em branco. */
export const missingEnvVars: string[] = REQUIRED.filter((key) => !read(key));

export const isConfigured = missingEnvVars.length === 0;

export const isDev = import.meta.env.DEV;
