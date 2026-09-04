/**
 * Firebase Admin SDK.
 *
 * O backend e o unico que pode escrever `status`, `decision`, itens e
 * configuracoes — as `firestore.rules` proibem o cliente. O Admin SDK ignora as
 * regras, entao toda escrita daqui ja passou pela validacao das rotas.
 */
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { env } from './env';

function loadServiceAccount(): ServiceAccount {
  let json: string;
  try {
    json = Buffer.from(env.firebaseServiceAccountB64, 'base64').toString('utf8');
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 nao e um base64 valido.');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_B64 nao contem um JSON valido. ' +
        'Codifique o arquivo inteiro da service account, em uma linha so.'
    );
  }

  if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
    throw new Error('A service account do Firebase esta incompleta (falta project_id/private_key/client_email).');
  }

  return {
    projectId: String(parsed.project_id),
    privateKey: String(parsed.private_key),
    clientEmail: String(parsed.client_email),
  };
}

let cached: Firestore | null = null;

export function db(): Firestore {
  if (cached) return cached;

  if (getApps().length === 0) {
    initializeApp({ credential: cert(loadServiceAccount()) });
  }

  cached = getFirestore();
  cached.settings({ ignoreUndefinedProperties: true });
  return cached;
}

export { FieldValue, Timestamp };

export const collections = {
  users: () => db().collection('users'),
  items: () => db().collection('items'),
  requests: () => db().collection('requests'),
  events: (requestId: string) => db().collection('requests').doc(requestId).collection('events'),
  settingsApp: () => db().collection('settings').doc('app'),
  settingsCounters: () => db().collection('settings').doc('counters'),
};

export const serverTimestamp = () => FieldValue.serverTimestamp();
