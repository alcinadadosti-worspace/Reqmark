import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, LoadingScreen } from '@/components/ui/Feedback';
import { api, clearAdminToken, getAdminToken } from '@/lib/api';
import { useIdentityStore } from '@/store/identity';
import { AdminPinDialog } from '@/features/identity/AdminPinDialog';

/**
 * Portão do painel: exige que a pessoa seja a administradora E tenha um token
 * válido do backend nesta aba.
 *
 * O token é só a chave da interface; a proteção de verdade está nas rotas
 * `/admin/*`, que exigem `Authorization: Bearer` — mesmo que alguém force a
 * rota no navegador, nenhuma ação privilegiada passa sem o token.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const identity = useIdentityStore((state) => state.identity);
  const adminUnlocked = useIdentityStore((state) => state.adminUnlocked);
  const unlockAdmin = useIdentityStore((state) => state.unlockAdmin);
  const lockAdmin = useIdentityStore((state) => state.lockAdmin);

  const [checking, setChecking] = useState(true);
  const [askPin, setAskPin] = useState(false);

  const isAdmin = identity?.role === 'admin';

  /** Confere com o backend se o token guardado ainda vale. */
  useEffect(() => {
    if (!isAdmin) {
      setChecking(false);
      return;
    }

    const token = getAdminToken();
    if (!token) {
      lockAdmin();
      setChecking(false);
      setAskPin(true);
      return;
    }

    let disposed = false;

    api
      .session()
      .then(() => {
        if (disposed) return;
        unlockAdmin();
      })
      .catch(() => {
        if (disposed) return;
        clearAdminToken();
        lockAdmin();
        setAskPin(true);
      })
      .finally(() => {
        if (!disposed) setChecking(false);
      });

    return () => {
      disposed = true;
    };
  }, [isAdmin, unlockAdmin, lockAdmin]);

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-7 w-7" strokeWidth={1.2} aria-hidden />}
        title="Área da administradora"
        description="Só a Suzana tem acesso ao painel de aprovações e ao cadastro de itens."
        action={
          <Link to="/itens" className="text-sm text-gold-300 underline underline-offset-4">
            Voltar aos itens
          </Link>
        }
      />
    );
  }

  if (checking) return <LoadingScreen label="Conferindo sua sessão…" />;

  if (!adminUnlocked) {
    return (
      <>
        <EmptyState
          icon={<KeyRound className="h-7 w-7" strokeWidth={1.2} aria-hidden />}
          title="Informe o PIN"
          description="O painel de aprovações pede o PIN uma vez por sessão."
          action={<Button onClick={() => setAskPin(true)}>Informar PIN</Button>}
        />
        <AdminPinDialog
          open={askPin}
          name={identity?.name ?? ''}
          onClose={() => setAskPin(false)}
          onSuccess={() => {
            unlockAdmin();
            setAskPin(false);
          }}
        />
      </>
    );
  }

  return <>{children}</>;
}
