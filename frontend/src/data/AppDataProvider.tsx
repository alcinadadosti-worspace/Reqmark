/**
 * Assinaturas de tempo real compartilhadas por todo o app.
 *
 * Deliberadamente centralizado: catalogo, agenda e wizard usam a MESMA consulta
 * de ocupacao. Uma consulta por tela multiplicaria as leituras cobradas no
 * plano Spark sem trazer nenhum dado novo.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { ensureAnonymousAuth } from '@/lib/firebase';
import {
  FALLBACK_SETTINGS,
  docToItem,
  docToRequest,
  docToUser,
  mapSnapshot,
  queries,
  refs,
} from '@/lib/collections';
import { buildOccupancy, type OccupancyIndex, type StockItemRef } from '@/shared/availability';
import type { AppSettings, AppUser, Item, MarketingRequest } from '@/shared/types';
import { isConfigured, missingEnvVars } from '@/lib/env';
import { demoStore, isDemoMode } from '@/demo';

interface AppData {
  ready: boolean;
  error: string | null;

  items: Item[];
  activeItems: Item[];
  itemsById: Map<string, Item>;
  /** Forma reduzida que o motor de disponibilidade consome. */
  stockById: Map<string, StockItemRef>;

  users: AppUser[];
  settings: AppSettings;

  /** Requisicoes que afetam a disponibilidade (pendentes + aprovadas). */
  occupancyRequests: MarketingRequest[];
  occupancy: OccupancyIndex;
}

const AppDataContext = createContext<AppData | null>(null);

interface Loaded {
  items: boolean;
  users: boolean;
  settings: boolean;
  occupancy: boolean;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [settings, setSettings] = useState<AppSettings>(FALLBACK_SETTINGS);
  const [occupancyRequests, setOccupancyRequests] = useState<MarketingRequest[]>([]);
  const [loaded, setLoaded] = useState<Loaded>({
    items: false,
    users: false,
    settings: false,
    occupancy: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Modo demonstração: os dados vêm da loja em memória, não do Firestore.
    if (isDemoMode()) {
      const sync = () => {
        setItems([...demoStore.items]);
        setUsers([...demoStore.users]);
        setSettings({ ...demoStore.settings });
        setOccupancyRequests(
          demoStore.requests.filter(
            (request) => request.status === 'pending' || request.status === 'approved'
          )
        );
        setLoaded({ items: true, users: true, settings: true, occupancy: true });
      };

      sync();
      return demoStore.subscribe(sync);
    }

    if (!isConfigured) {
      setError(
        `Configuração do Firebase incompleta. Faltam: ${missingEnvVars.join(', ')}. ` +
          'Veja frontend/.env.example.'
      );
      return;
    }

    let disposed = false;
    const unsubscribers: (() => void)[] = [];

    const fail = (scope: string) => (cause: unknown) => {
      if (disposed) return;
      console.error(`[AppData] falha ao ouvir ${scope}`, cause);
      setError(
        `Não consegui carregar ${scope}. Verifique as regras do Firestore e os índices ` +
          '(veja o README, seção "Solução de problemas").'
      );
    };

    // As regras exigem `request.auth != null`: autentica antes de assinar.
    ensureAnonymousAuth()
      .then(() => {
        if (disposed) return;

        unsubscribers.push(
          onSnapshot(
            queries.items(),
            (snapshot) => {
              setItems(mapSnapshot(snapshot, docToItem));
              setLoaded((state) => ({ ...state, items: true }));
            },
            fail('os itens')
          )
        );

        unsubscribers.push(
          onSnapshot(
            queries.users(),
            (snapshot) => {
              setUsers(mapSnapshot(snapshot, docToUser).filter((user) => user.active));
              setLoaded((state) => ({ ...state, users: true }));
            },
            fail('a lista de pessoas')
          )
        );

        unsubscribers.push(
          onSnapshot(
            refs.appSettings(),
            (snapshot) => {
              const data = snapshot.data();
              if (data) {
                setSettings({
                  adminSlackId: data.adminSlackId ?? FALLBACK_SETTINGS.adminSlackId,
                  appUrl: data.appUrl ?? '',
                  cities: Array.isArray(data.cities) ? data.cities : [],
                  purposeTypes: Array.isArray(data.purposeTypes)
                    ? data.purposeTypes
                    : FALLBACK_SETTINGS.purposeTypes,
                });
              }
              setLoaded((state) => ({ ...state, settings: true }));
            },
            fail('as configurações')
          )
        );

        unsubscribers.push(
          onSnapshot(
            queries.occupancy(),
            (snapshot) => {
              setOccupancyRequests(mapSnapshot(snapshot, docToRequest));
              setLoaded((state) => ({ ...state, occupancy: true }));
            },
            fail('a agenda dos itens')
          )
        );
      })
      .catch((cause) => {
        if (disposed) return;
        console.error('[AppData] login anônimo falhou', cause);
        setError(
          'Não consegui entrar no Firebase. Confirme que o login anônimo está habilitado ' +
            'em Authentication > Sign-in method.'
        );
      });

    return () => {
      disposed = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const value = useMemo<AppData>(() => {
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const stockById = new Map<string, StockItemRef>(
      items.map((item) => [item.id, { id: item.id, name: item.name, quantity: item.quantity }])
    );

    return {
      ready: loaded.items && loaded.users && loaded.settings && loaded.occupancy,
      error,
      items,
      activeItems: items.filter((item) => item.active),
      itemsById,
      stockById,
      users,
      settings,
      occupancyRequests,
      occupancy: buildOccupancy(occupancyRequests),
    };
  }, [items, users, settings, occupancyRequests, loaded, error]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData precisa estar dentro de <AppDataProvider>.');
  return context;
}
