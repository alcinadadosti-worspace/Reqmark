import { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, MessageSquare, Plus } from 'lucide-react';
import GradientText from '@/components/reactbits/GradientText/GradientText';
import { Button, ButtonLink } from '@/components/ui/Button';
import { celebrate } from '@/lib/confetti';
import { EASE_BRAND } from '@/lib/motion';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';

export interface SuccessScreenProps {
  requestId: string;
  number: number;
  onNewRequest: () => void;
}

/** Tela de sucesso com o número do ticket e confete dourado (seção 8.3). */
export function SuccessScreen({ requestId, number, onNewRequest }: SuccessScreenProps) {
  const reduced = usePrefersReducedMotion();
  const ticket = `#${String(number).padStart(4, '0')}`;

  useEffect(() => {
    void celebrate();
  }, []);

  return (
    <motion.div
      className="flex flex-col items-center justify-center px-4 py-14 text-center"
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_BRAND }}
    >
      <motion.span
        className="flex h-20 w-20 items-center justify-center rounded-full border border-status-approved/40 bg-status-approved/10 text-status-approved"
        initial={reduced ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.08 }}
      >
        <CheckCircle2 className="h-10 w-10" strokeWidth={1.4} aria-hidden />
      </motion.span>

      <h1 className="mt-6 font-display text-3xl text-ivory sm:text-4xl">Requisição enviada</h1>

      <div className="mt-2 font-display text-5xl sm:text-6xl">
        {reduced ? (
          <span className="tabular brand-text">{ticket}</span>
        ) : (
          <GradientText
            colors={['#F3D28C', '#CEA15C', '#A5793D', '#F3D28C']}
            animationSpeed={6}
            className="tabular"
          >
            {ticket}
          </GradientText>
        )}
      </div>

      <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
        A Suzana já recebeu o aviso no Slack. Assim que ela decidir, você é avisada aqui no app e
        também no seu Slack — não precisa ficar cobrando.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-2.5">
        <ButtonLink
          to={`/requisicoes/${requestId}`}
          size="lg"
          icon={<MessageSquare className="h-4 w-4" aria-hidden />}
        >
          Acompanhar requisição
        </ButtonLink>

        <Button variant="secondary" onClick={onNewRequest} icon={<Plus className="h-4 w-4" aria-hidden />}>
          Fazer outra requisição
        </Button>

        <ButtonLink to="/itens" variant="ghost">
          Voltar aos itens
        </ButtonLink>
      </div>
    </motion.div>
  );
}
