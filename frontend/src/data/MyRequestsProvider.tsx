/**
 * Requisicoes da pessoa logada, assinadas UMA vez e compartilhadas.
 *
 * O sino do cabecalho, a pagina "Minhas requisicoes" e a home leem a mesma
 * lista. Sem isso seriam tres `onSnapshot` sobre a mesma consulta.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useMyRequests } from '@/hooks/useRequests';
import { useIdentityStore } from '@/store/identity';
import { demoStore, isDemoMode } from '@/demo';
import type { MarketingRequest } from '@/shared/types';

interface MyRequestsData {
  requests: MarketingRequest[];
  loading: boolean;
  error: string | null;
  /** Requisicoes ainda em aberto (pendentes ou aprovadas em curso). */
  open: MarketingRequest[];
  unread: number;
}

const MyRequestsContext = createContext<MyRequestsData | null>(null);

export function MyRequestsProvider({ children }: { children: ReactNode }) {
  const identity = useIdentityStore((state) => state.identity);
  const { data, loading, error } = useMyRequests(identity?.slackId);

  // Na demonstração, duas requisições de exemplo passam para quem entrou, para
  // "Minhas requisições" e o sino terem conteúdo seja quem for a pessoa.
  useEffect(() => {
    if (isDemoMode() && identity) demoStore.adoptIdentity(identity.slackId, identity.name);
  }, [identity]);

  const value = useMemo<MyRequestsData>(() => {
    const open = data.filter(
      (request) => request.status === 'pending' || request.status === 'approved'
    );
    return {
      requests: data,
      loading,
      error,
      open,
      unread: data.reduce((total, request) => total + (request.unread?.requester ?? 0), 0),
    };
  }, [data, loading, error]);

  return <MyRequestsContext.Provider value={value}>{children}</MyRequestsContext.Provider>;
}

export function useMyRequestsData(): MyRequestsData {
  const context = useContext(MyRequestsContext);
  if (!context) throw new Error('useMyRequestsData precisa estar dentro de <MyRequestsProvider>.');
  return context;
}
