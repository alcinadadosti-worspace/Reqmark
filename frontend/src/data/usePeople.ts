/**
 * Cadastro de pessoas — carregado so por quem precisa dele.
 *
 * Sao ~110 documentos, e cada leitura conta na cota diaria do plano Spark.
 * Duas decisoes seguram esse custo:
 *
 * 1. NAO fica no AppDataProvider. A lista tem um unico consumidor, a tela de
 *    identidade, e essa tela so aparece antes da pessoa se identificar — depois
 *    a escolha vive no localStorage e todo mundo cai direto em /itens. No
 *    provider global, toda sessao pagaria 109 leituras por uma tela que quase
 *    nunca e exibida.
 *
 * 2. Leitura unica, e do cache primeiro. O cadastro muda quando alguem entra ou
 *    sai da empresa — raro o bastante para nao justificar um `onSnapshot`, que
 *    ficaria escutando a coleção inteira a sessao toda. O cache em disco do
 *    Firestore (ver `lib/firebase.ts`) responde de graca; o servidor so e
 *    consultado quando nao ha nada guardado ou quando o guardado envelheceu.
 */
import { useEffect, useMemo, useState } from 'react';
import { getDocs, getDocsFromCache } from 'firebase/firestore';
import { ensureAnonymousAuth } from '@/lib/firebase';
import { docToUser, mapSnapshot, queries } from '@/lib/collections';
import { isConfigured, missingEnvVars } from '@/lib/env';
import { demoStore, isDemoMode } from '@/demo';
import type { AppUser } from '@/shared/types';

/** Quanto tempo o cadastro guardado vale antes de valer a pena reconferir. */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FETCHED_AT_KEY = 'am:people-fetched-at';

function lastFetchedAt(): number {
  try {
    return Number(localStorage.getItem(FETCHED_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}

function markFetched(): void {
  try {
    localStorage.setItem(FETCHED_AT_KEY, String(Date.now()));
  } catch {
    /* aba anonima: vale so para esta sessao */
  }
}

export interface People {
  users: AppUser[];
  ready: boolean;
  error: string | null;
}

export function usePeople(): People {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode()) {
      const sync = () => {
        setUsers([...demoStore.users]);
        setReady(true);
      };
      sync();
      return demoStore.subscribe(sync);
    }

    if (!isConfigured) {
      setError(
        `Configuração do Firebase incompleta. Faltam: ${missingEnvVars.join(', ')}. ` +
          'Veja .env.example na raiz do repositório.'
      );
      return;
    }

    let disposed = false;

    const publish = (list: AppUser[]) => {
      if (disposed) return;
      setUsers(list.filter((user) => user.active));
      setReady(true);
    };

    ensureAnonymousAuth()
      .then(async () => {
        if (disposed) return;

        const fresh = Date.now() - lastFetchedAt() < CACHE_TTL_MS;

        if (fresh) {
          try {
            const cached = await getDocsFromCache(queries.users());
            if (!cached.empty) {
              publish(mapSnapshot(cached, docToUser));
              return;
            }
          } catch {
            // Sem IndexedDB ou cache vazio: cai para o servidor.
          }
        }

        const snapshot = await getDocs(queries.users());
        if (disposed) return;
        markFetched();
        publish(mapSnapshot(snapshot, docToUser));
      })
      .catch((cause) => {
        if (disposed) return;
        console.error('[usePeople] falha ao carregar o cadastro', cause);
        setError(
          'Não consegui carregar a lista de pessoas. Verifique as regras do Firestore ' +
            '(veja o README, seção "Solução de problemas").'
        );
      });

    return () => {
      disposed = true;
    };
  }, []);

  // Ordena aqui, e nao no Firestore: `orderBy('name')` ordena por bytes UTF-8,
  // entao "Angela" cairia depois de "Ze". Com `localeCompare('pt-BR')` a lista
  // fica na ordem que uma pessoa espera — e igual no modo demonstracao.
  const sorted = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [users]
  );

  return { users: sorted, ready, error };
}
