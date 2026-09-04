import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { LogoMark } from '@/components/ui/Logo';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5">
      <LogoMark size={64} glow />
      <EmptyState
        className="max-w-md"
        icon={<Compass className="h-7 w-7" strokeWidth={1.2} aria-hidden />}
        title="Essa página não existe"
        description="O link pode estar errado ou a requisição foi removida."
        action={<ButtonLink to="/itens">Ir para os itens</ButtonLink>}
      />
    </div>
  );
}
