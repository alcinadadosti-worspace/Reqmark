import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { KeyRound, Search, SearchX, X } from 'lucide-react';
import AnimatedList from '@/components/reactbits/AnimatedList/AnimatedList';
import SplitText from '@/components/reactbits/SplitText/SplitText';
import ShinyText from '@/components/reactbits/ShinyText/ShinyText';
import { Avatar } from '@/components/ui/Avatar';
import { LogoMark } from '@/components/ui/Logo';
import { Input } from '@/components/ui/Field';
import { ErrorNotice, LoadingScreen } from '@/components/ui/Feedback';
import { useAppData } from '@/data/AppDataProvider';
import { useIdentityStore } from '@/store/identity';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { searchPeople } from '@/lib/peopleSearch';
import { EASE_BRAND } from '@/lib/motion';
import type { AppUser } from '@/shared/types';
import { AuroraBackdrop } from './AuroraBackdrop';
import { AdminPinDialog } from './AdminPinDialog';

/** A partir de quantos caracteres a busca começa a mostrar resultados. */
const MIN_QUERY = 2;

/**
 * Tela de identidade (`/`) — seção 8.1.
 *
 * Sem cadastro nem senha: a pessoa se encontra e entra. A lista NÃO é exibida
 * inteira — são ~110 nomes, e rolar até o seu é pior do que digitar duas
 * letras. Quem digita manda no que aparece; a busca aceita nome, pedaço do
 * nome ou iniciais.
 *
 * A administradora tem um caminho próprio e discreto no rodapé, que pede o PIN
 * direto — ela não precisa se procurar na lista.
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
  /** `person` = escolheu a administradora na busca; `button` = veio do rodapé. */
  const [pinFor, setPinFor] = useState<'person' | 'button' | null>(null);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/itens';

  useEffect(() => {
    if (identity) navigate(redirectTo, { replace: true });
  }, [identity, navigate, redirectTo]);

  const admin = useMemo(() => users.find((user) => user.role === 'admin') ?? null, [users]);

  const results = useMemo(() => searchPeople(users, term), [term, users]);

  const query = term.trim();
  const searching = query.length >= MIN_QUERY;

  const enter = (user: AppUser) => {
    setIdentity({ slackId: user.slackId, name: user.name, role: user.role });
    navigate(redirectTo, { replace: true });
  };

  const choose = (user: AppUser) => {
    if (user.role === 'admin') {
      setPinFor('person');
      return;
    }
    enter(user);
  };

  /** Encerra o fluxo do PIN, tendo ele sido validado ou dispensado. */
  const finishAdmin = (unlocked: boolean) => {
    const origin = pinFor;
    setPinFor(null);
    if (!admin) return;

    // Dispensou o PIN vindo do botão: era só o caminho da admin, não entra.
    if (!unlocked && origin === 'button') return;

    setIdentity({ slackId: admin.slackId, name: admin.name, role: admin.role });
    if (unlocked) unlockAdmin();
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

      {/* `justify-center`: sem a lista aberta a tela tem pouco conteúdo, e
          empurrar o rodapé para baixo deixaria um vazio no meio. */}
      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 pb-8 pt-12">
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
              <span>Digite seu nome ou suas iniciais para entrar.</span>
            ) : (
              <ShinyText
                text="Digite seu nome ou suas iniciais para entrar."
                speed={7}
                color="#A8A39A"
                shineColor="#F3D28C"
              />
            )}
          </div>
        </motion.div>

        <motion.div
          className="mt-8 flex min-h-0 flex-col"
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
                placeholder="Seu nome ou iniciais…"
                aria-label="Buscar seu nome"
                autoComplete="off"
                autoFocus
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

              <p className="sr-only" aria-live="polite">
                {searching ? `${results.length} pessoa(s) encontrada(s)` : ''}
              </p>

              <AnimatePresence mode="wait" initial={false}>
                {!searching ? (
                  <motion.p
                    key="dica"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="mt-6 text-center text-sm leading-relaxed text-muted/80"
                  >
                    Comece a digitar — por exemplo{' '}
                    <button
                      type="button"
                      onClick={() => setTerm('rafa')}
                      className="text-gold-300 underline decoration-dotted underline-offset-4 hover:text-gold-200"
                    >
                      rafa
                    </button>{' '}
                    ou as iniciais{' '}
                    <button
                      type="button"
                      onClick={() => setTerm('rm')}
                      className="text-gold-300 underline decoration-dotted underline-offset-4 hover:text-gold-200"
                    >
                      RM
                    </button>
                    .
                    <span className="mt-2 block text-2xs text-muted/60">
                      {users.length} pessoas cadastradas
                    </span>
                  </motion.p>
                ) : results.length === 0 ? (
                  <motion.div
                    key="vazio"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="mt-6 flex flex-col items-center gap-2 text-center"
                  >
                    <SearchX className="h-7 w-7 text-gold-500/50" strokeWidth={1.2} aria-hidden />
                    <p className="text-sm text-ivory">Ninguém com esse nome</p>
                    <p className="max-w-xs text-xs leading-relaxed text-muted">
                      Confira a grafia ou tente o sobrenome. Se você entrou na empresa há pouco
                      tempo, peça à Suzana para te cadastrar.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="resultados"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="mt-4 min-h-0 flex-1"
                  >
                    <AnimatedList
                      className="glass overflow-hidden"
                      listClassName="max-h-[42vh] p-2"
                      itemClassName="rounded-2xl border border-transparent transition-colors"
                      selectedItemClassName="!border-gold-500/35 bg-gold-500/8"
                      items={listItems}
                      onItemSelect={(index) => {
                        const user = results[index];
                        if (user) choose(user);
                      }}
                      gradientColor="#121216"
                      displayScrollbar={false}
                      aria-label="Pessoas encontradas"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.div>

        {/* Caminho da administradora: discreto, mas sempre no mesmo lugar. */}
        {ready && !error && admin ? (
          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="brand-rule max-w-[10rem] opacity-50" aria-hidden />
            <button
              type="button"
              onClick={() => setPinFor('button')}
              className="inline-flex items-center gap-2 rounded-full border border-gold-500/20 px-4 py-2 text-xs text-muted transition-colors hover:border-gold-500/45 hover:text-gold-300"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              Entrar como administradora
            </button>
          </div>
        ) : null}

        <p className="mt-6 text-center text-2xs leading-relaxed text-muted/70">
          Ferramenta interna do Grupo Alcina Maria. Sua escolha fica salva neste aparelho —
          você pode trocar de pessoa no menu a qualquer momento.
        </p>
      </div>

      <AdminPinDialog
        open={pinFor !== null}
        name={admin?.name ?? ''}
        // Vindo do botão, dispensar o PIN não deve entrar como solicitante.
        allowSkip={pinFor === 'person'}
        onClose={() => finishAdmin(false)}
        onSuccess={() => finishAdmin(true)}
      />
    </div>
  );
}
