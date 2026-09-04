import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AppShell } from '@/components/layout/AppShell';
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

function RequireIdentity({ children }: { children: ReactNode }) {
  const identity = useIdentityStore((state) => state.identity);
  const location = useLocation();

  if (!identity) {
    return <Navigate to="/" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}

function AppLayout() {
  return (
    <RequireIdentity>
      <MyRequestsProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </MyRequestsProvider>
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
              <AnimatedOutlet>
                <WizardPage />
              </AnimatedOutlet>
            }
          />
          <Route
            path="/requisicoes"
            element={
              <AnimatedOutlet>
                <MyRequestsPage />
              </AnimatedOutlet>
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
