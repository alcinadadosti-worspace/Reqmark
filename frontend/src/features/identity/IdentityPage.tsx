import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Search, X } from 'lucide-react';
import AnimatedList from '@/components/reactbits/AnimatedList/AnimatedList';
import SplitText from '@/components/reactbits/SplitText/SplitText';
import ShinyText from '@/components/reactbits/ShinyText/ShinyText';
import { Avatar } from '@/components/ui/Avatar';
import { LogoMark } from '@/components/ui/Logo';
import { Input } from '@/components/ui/Field';
import { EmptyState, ErrorNotice, LoadingScreen } from '@/components/ui/Feedback';
import { useAppData } from '@/data/AppDataProvider';
import { useIdentityStore } from '@/store/identity';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { normalize } from '@/lib/geocode';
import { EASE_BRAND } from '@/lib/motion';
import type { AppUser } from '@/shared/types';
import { AuroraBackdrop } from './AuroraBackdrop';
import { AdminPinDialog } from './AdminPinDialog';

/**
 * Tela de identidade (`/`) — seção 8.1.
 *
 * Sem cadastro nem senha: a pessoa se encontra na lista e entra. A escolha vai
 * para o `localStorage`. Se for a administradora, o PIN é pedido em seguida —
 * mas ela pode dispensar e usar o app como solicitante.
 */
export default function IdentityPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = usePrefersReducedMotion();

  const { users, ready, error } = useAppData();
  const identity = useIdentityStore((state) => state.identity);
  const setIdentity = useIdentityStore((state) => state.setIdentity);
  const unlockAdmin = useIdentityStore((state) => state.unlockAdmin);

  const [term, setTerm] = useState('');
  const [pendingAdmin, setPendingAdmin] = useState<AppUser | null>(null);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/itens';

  // Já identificado? Vai direto para o app.
  useEffect(() => {
    if (identity) navigate(redirectTo, { replace: true });
  }, [identity, navigate, redirectTo]);

  /** Busca tolerante a acentos: "jose" encontra "José". */
  const results = useMemo(() => {
    const needle = normalize(term);
    if (!needle) return users;

    return users
      .map((user) => {
        const haystack = normalize(user.name);
        const index = haystack.indexOf(needle);
        if (index < 0) return null;
        // Quem começa com o termo (ou começa uma palavra com ele) vem antes.
        const startsWord = index === 0 || haystack[index - 1] === ' ';
        return { user, rank: startsWord ? index : index + 100 };
      })
      .filter((entry): entry is { user: AppUser; rank: number } => entry !== null)
      .sort((a, b) => a.rank - b.rank || a.user.name.localeCompare(b.user.name, 'pt-BR'))
      .map((entry) => entry.user);
  }, [term, users]);

  const choose = (user: AppUser) => {
    if (user.role === 'admin') {
      setPendingAdmin(user);
      return;
    }
    setIdentity({ slackId: user.slackId, name: user.name, role: user.role });
    navigate(redirectTo, { replace: true });
  };

  /** Entra como administradora depois do PIN validado. */
  const completeAdmin = (unlocked: boolean) => {
    if (!pendingAdmin) return;
    setIdentity({ slackId: pendingAdmin.slackId, name: pendingAdmin.name, role: pendingAdmin.role });
    if (unlocked) unlockAdmin();
    setPendingAdmin(null);
    navigate(unlocked ? '/admin' : redirectTo, { replace: true });
  };

  const listItems = useMemo(
    () =>
      results.map((user) => (
        <div className="flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-colors">
          <Avatar name={user.name} size="md" highlighted={user.role === 'admin'} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.95rem] text-ivory">{user.name}</span>
            {user.role === 'admin' ? (
              <span className="text-2xs uppercase tracking-[0.14em] text-gold-500/80">
                Administradora do Marketing
              </span>
            ) : null}
          </span>
        </div>
      )),
    [results]
  );

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <AuroraBackdrop />

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-8 pt-12 sm:pt-20">
        <motion.div
          className="flex flex-col items-center text-center"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_BRAND }}
        >
          <LogoMark size={92} glow priority />

          <p className="mt-6 text-2xs uppercase tracking-[0.32em] text-gold-500/85">AM Marketing</p>

          {reduced ? (
            <h1 className="mt-2 font-display text-4xl text-ivory sm:text-5xl">Quem é você?</h1>
          ) : (
            <SplitText
              text="Quem é você?"
              tag="h1"
              className="mt-2 font-display text-4xl text-ivory sm:text-5xl"
              delay={38}
              duration={0.7}
              splitType="chars"
              from={{ opacity: 0, y: 26 }}
              to={{ opacity: 1, y: 0 }}
              textAlign="center"
            />
          )}

          <div className="mt-3 max-w-sm text-sm text-muted">
            {reduced ? (
              <span>Escolha seu nome para ver os itens e abrir requisições.</span>
            ) : (
              <ShinyText
                text="Escolha seu nome para ver os itens e abrir requisições."
                speed={7}
                color="#A8A39A"
                shineColor="#F3D28C"
              />
            )}
          </div>
        </motion.div>

        <motion.div
          className="mt-8 flex min-h-0 flex-1 flex-col"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: EASE_BRAND }}
        >
          {error ? (
            <ErrorNotice title="Não consegui carregar as pessoas" message={error} />
          ) : !ready ? (
            <LoadingScreen label="Carregando a equipe…" />
          ) : (
            <>
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Buscar pelo nome…"
                aria-label="Buscar pessoa pelo nome"
                autoComplete="off"
                enterKeyHint="search"
                leading={<Search className="h-4 w-4" aria-hidden />}
                trailing={
                  term ? (
                    <button
                      type="button"
                      onClick={() => setTerm('')}
                      className="rounded-full p-1 transition-colors hover:text-ivory"
                      aria-label="Limpar busca"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null
                }
              />

              <p className="mt-2 px-1 text-2xs text-muted" aria-live="polite">
                {results.length === users.length
                  ? `${users.length} pessoas`
                  : `${results.length} de ${users.length} pessoas`}
              </p>

              {results.length === 0 ? (
                <EmptyState
                  className="mt-4"
                  icon={<Search className="h-7 w-7" strokeWidth={1.2} aria-hidden />}
                  title="Ninguém com esse nome"
                  description="Confira a grafia ou procure pelo sobrenome. Se você entrou na empresa há pouco tempo, peça à Suzana para te cadastrar."
                />
              ) : (
                <AnimatedList
                  className="glass mt-4 min-h-0 flex-1 overflow-hidden"
                  listClassName="max-h-[46vh] p-2 sm:max-h-[42vh]"
                  itemClassName="rounded-2xl border border-transparent transition-colors"
                  selectedItemClassName="!border-gold-500/35 bg-gold-500/8"
                  items={listItems}
                  onItemSelect={(index) => {
                    const user = results[index];
                    if (user) choose(user);
                  }}
                  gradientColor="#121216"
                  displayScrollbar={false}
                  aria-label="Pessoas da equipe"
                />
              )}
            </>
          )}
        </motion.div>

        <p className="mt-6 text-center text-2xs leading-relaxed text-muted/70">
          Ferramenta interna do Grupo Alcina Maria. Sua escolha fica salva neste aparelho —
          você pode trocar de pessoa no menu a qualquer momento.
        </p>
      </div>

      <AdminPinDialog
        open={Boolean(pendingAdmin)}
        name={pendingAdmin?.name ?? ''}
        onClose={() => completeAdmin(false)}
        onSuccess={() => completeAdmin(true)}
      />
    </div>
  );
}
