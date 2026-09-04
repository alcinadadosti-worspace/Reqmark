/**
 * Assinaturas de requisicoes fora do conjunto compartilhado.
 *
 * A consulta de ocupacao (pendentes + aprovadas) vive no `AppDataProvider`.
 * Aqui ficam as listas por pessoa e o ticket aberto, que sao especificas de
 * uma tela e por isso nao valem uma assinatura global.
 */
import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { docToEvent, docToRequest, mapSnapshot, queries, refs } from '@/lib/collections';
import { ensureAnonymousAuth } from '@/lib/firebase';
import { demoStore, isDemoMode } from '@/demo';
import type { MarketingRequest, RequestEvent } from '@/shared/types';

interface ListState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

const EMPTY_LIST = { data: [], loading: true, error: null };

/** Requisicoes de uma pessoa, mais recentes primeiro. */
export function useMyRequests(requesterId: string | null | undefined): ListState<MarketingRequest> {
  const [state, setState] = useState<ListState<MarketingRequest>>(EMPTY_LIST);

  useEffect(() => {
    if (!requesterId) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    if (isDemoMode()) {
      const sync = () =>
        setState({ data: demoStore.requestsOf(requesterId), loading: false, error: null });
      sync();
      return demoStore.subscribe(sync);
    }

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    ensureAnonymousAuth()
      .then(() => {
        if (disposed) return;
        unsubscribe = onSnapshot(
          queries.myRequests(requesterId),
          (snapshot) => setState({ data: mapSnapshot(snapshot, docToRequest), loading: false, error: null }),
          (cause) => {
            console.error('[useMyRequests]', cause);
            setState({ data: [], loading: false, error: 'Não consegui carregar suas requisições.' });
          }
        );
      })
      .catch(() => {
        if (!disposed) setState({ data: [], loading: false, error: 'Falha ao autenticar.' });
      });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [requesterId]);

  return state;
}

/** Todas as requisicoes — apenas para a administradora. */
export function useAllRequests(enabled: boolean): ListState<MarketingRequest> {
  const [state, setState] = useState<ListState<MarketingRequest>>(EMPTY_LIST);

  useEffect(() => {
    if (!enabled) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    if (isDemoMode()) {
      const sync = () => setState({ data: [...demoStore.requests], loading: false, error: null });
      sync();
      return demoStore.subscribe(sync);
    }

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    ensureAnonymousAuth()
      .then(() => {
        if (disposed) return;
        unsubscribe = onSnapshot(
          queries.allRequests(),
          (snapshot) => setState({ data: mapSnapshot(snapshot, docToRequest), loading: false, error: null }),
          (cause) => {
            console.error('[useAllRequests]', cause);
            setState({ data: [], loading: false, error: 'Não consegui carregar a fila.' });
          }
        );
      })
      .catch(() => {
        if (!disposed) setState({ data: [], loading: false, error: 'Falha ao autenticar.' });
      });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [enabled]);

  return state;
}

export interface TicketState {
  request: MarketingRequest | null;
  events: RequestEvent[];
  loading: boolean;
  notFound: boolean;
  error: string | null;
}

/** Um ticket: o documento da requisicao mais a timeline/chat, em tempo real. */
export function useRequestTicket(requestId: string | undefined): TicketState {
  const [request, setRequest] = useState<MarketingRequest | null>(null);
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    if (isDemoMode()) {
      const sync = () => {
        const found = demoStore.find(requestId);
        setRequest(found ? { ...found } : null);
        setEvents([...demoStore.eventsOf(requestId)]);
        setNotFound(!found);
        setLoading(false);
      };
      sync();
      return demoStore.subscribe(sync);
    }

    let disposed = false;
    const unsubscribers: (() => void)[] = [];

    setLoading(true);
    setNotFound(false);
    setError(null);

    ensureAnonymousAuth()
      .then(() => {
        if (disposed) return;

        unsubscribers.push(
          onSnapshot(
            refs.request(requestId),
            (snapshot) => {
              if (!snapshot.exists()) {
                setNotFound(true);
                setRequest(null);
              } else {
                setRequest(docToRequest(snapshot));
                setNotFound(false);
              }
              setLoading(false);
            },
            (cause) => {
              console.error('[useRequestTicket]', cause);
              setError('Não consegui carregar esta requisição.');
              setLoading(false);
            }
          )
        );

        unsubscribers.push(
          onSnapshot(
            queries.events(requestId),
            (snapshot) => setEvents(mapSnapshot(snapshot, docToEvent)),
            (cause) => console.error('[useRequestTicket:events]', cause)
          )
        );
      })
      .catch(() => {
        if (!disposed) {
          setError('Falha ao autenticar.');
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [requestId]);

  return { request, events, loading, notFound, error };
}

/** Total de mensagens nao lidas de um lado — alimenta o badge do sino. */
export function useUnreadCount(requests: MarketingRequest[], side: 'admin' | 'requester'): number {
  return useMemo(
    () => requests.reduce((total, request) => total + (request.unread?.[side] ?? 0), 0),
    [requests, side]
  );
}
