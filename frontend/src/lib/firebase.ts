/**
 * Inicializacao do Firebase: Firestore (tempo real) + Auth anonimo.
 *
 * O frontend fala DIRETO com o Firestore para ler e para criar requisicoes e
 * mensagens. Assim a experiencia nao depende do backend estar acordado — o
 * Web Service gratuito do Render dorme apos ~15 min sem trafego.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type Auth, type User } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, isConfigured } from './env';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

function ensureApp(): FirebaseApp {
  if (!isConfigured) {
    throw new Error(
      'Firebase nao configurado: preencha as variaveis VITE_FIREBASE_* (veja .env.example na raiz).'
    );
  }
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

export function getDb(): Firestore {
  if (db) return db;
  const instance = ensureApp();
  try {
    // Cache em disco: abrir o app offline mostra a ultima leitura em vez de
    // uma tela vazia, e reduz leituras cobradas no plano Spark.
    db = initializeFirestore(instance, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) }),
    });
  } catch {
    // Navegador sem IndexedDB (aba anonima, por exemplo): segue sem cache.
    db = getFirestore(instance);
  }
  return db;
}

export function getAuthInstance(): Auth {
  if (!auth) auth = getAuth(ensureApp());
  return auth;
}

let signInPromise: Promise<User> | null = null;

/**
 * Garante uma sessao anonima. As `firestore.rules` exigem `request.auth != null`
 * para qualquer operacao, entao isso roda antes de qualquer leitura.
 */
export function ensureAnonymousAuth(): Promise<User> {
  if (signInPromise) return signInPromise;

  signInPromise = new Promise<User>((resolve, reject) => {
    const instance = getAuthInstance();

    const unsubscribe = onAuthStateChanged(
      instance,
      (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        }
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );

    if (!instance.currentUser) {
      signInAnonymously(instance).catch((error) => {
        unsubscribe();
        reject(error);
      });
    }
  });

  // Um erro nao pode envenenar a promise para sempre: permite nova tentativa.
  signInPromise.catch(() => {
    signInPromise = null;
  });

  return signInPromise;
}
