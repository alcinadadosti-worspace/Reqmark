import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AppShell } from '@/components/layout/AppShell';
import { AppDataProvider } from '@/data/AppDataProvider';
import { MyRequestsProvider } from '@/data/MyRequestsProvider';
import { LoadingScreen } from '@/components/ui/Feedback';
import { useIdentityStore } from '@/store/identity';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { api } from '@/lib/api';
import { pageTransition, reducedVariants } from '@/lib/motion';

// Uma rota, um chunk. O mapa (Leaflet) e o calendário só chegam ao navegador
// de quem realmente abre a tela que os usa.
const IdentityPage = lazy(() => import('@/features/identity/IdentityPage'));
const CatalogPage = lazy(() => import('@/features/catalog/CatalogPage'));
const WizardPage = lazy(() => import('@/features/request-wizard/WizardPage'));
const MyRequestsPage = lazy(() => import('@/features/tickets/MyRequestsPage'));
const TicketPage = lazy(() => import('@/features/tickets/TicketPage'));
const AgendaPage = lazy(() => import('@/features/agenda/AgendaPage'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));
const NotFoundPage = lazy(() => import('@/features/misc/NotFoundPage'));

/**
 * Rotas que só fazem sentido para quem faz requisições.
 *
 * A administradora decide, não pede: "Nova" e a lista "Minhas requisições" não
 * aparecem no menu dela, e chegar nelas pela URL mostrava telas escritas para
 * outra pessoa ("uma conversa privada entre você e a Suzana" — sendo ela a
 * Suzana). Aqui ela é levada ao painel.
 *
 * O TICKET (`/requisicoes/:id`) fica de fora de propósito: é para lá que o
 * botão "Abrir no app" do card do Slack aponta, e ela precisa abri-lo.
 */
function RequesterOnly({ children }: { children: ReactNode }) {
  const identity = useIdentityStore((state) => state.identity);

  if (identity?.role === 'admin') return <Navigate to="/admin" replace />;

  return <>{children}</>;
}

function RequireIdentity({ children }: { children: ReactNode }) {
  const identity = useIdentityStore((state) => state.identity);
  const location = useLocation();

  if (!identity) {
    return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}

/**
 * Tudo que fala com o Firestore vive aqui dentro, depois do RequireIdentity.
 *
 * Antes o AppDataProvider montava na raiz, entao quem estava parado na tela
 * de identidade — sem ter escolhido nome ainda — ja pagava as leituras de
 * itens, configuracoes e ocupacao que aquela tela nao usa.
 */
function AppLayout() {
  return (
    <RequireIdentity>
      <AppDataProvider>
        <MyRequestsProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </MyRequestsProvider>
      </AppDataProvider>
    </RequireIdentity>
  );
}

/** Transição entre rotas — desligada sob `prefers-reduced-motion`. */
function AnimatedOutlet({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduced = usePrefersReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={reduced ? reducedVariants : pageTransition}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  // Acorda o Web Service gratuito do Render em segundo plano: quando alguém
  // enviar uma requisição, o backend já estará de pé para avisar o Slack.
  useEffect(() => {
    api.ping();
  }, []);

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<IdentityPage />} />

        <Route element={<AppLayout />}>
          <Route
            path="/itens"
            element={
              <AnimatedOutlet>
                <CatalogPage />
              </AnimatedOutlet>
            }
          />
          <Route
            path="/nova"
            element={
              <RequesterOnly>
                <AnimatedOutlet>
                  <WizardPage />
                </AnimatedOutlet>
              </RequesterOnly>
            }
          />
          <Route
            path="/requisicoes"
            element={
              <RequesterOnly>
                <AnimatedOutlet>
                  <MyRequestsPage />
                </AnimatedOutlet>
              </RequesterOnly>
            }
          />
          <Route
            path="/requisicoes/:requestId"
            element={
              <AnimatedOutlet>
                <TicketPage />
              </AnimatedOutlet>
            }
          />
          <Route
            path="/agenda"
            element={
              <AnimatedOutlet>
                <AgendaPage />
              </AnimatedOutlet>
            }
          />
          <Route
            path="/admin"
            element={
              <AnimatedOutlet>
                <AdminPage />
              </AnimatedOutlet>
            }
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
