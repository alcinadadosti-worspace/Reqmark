import { useEffect, useRef, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { ErrorNotice } from '@/components/ui/Feedback';
import { ApiError, api, storeAdminToken } from '@/lib/api';

export interface AdminPinDialogProps {
  open: boolean;
  name: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * PIN da administradora.
 *
 * O PIN nunca é comparado no navegador: vai para `POST /admin/login`, que
 * confere em tempo constante e devolve um token HMAC de 12 h guardado no
 * `sessionStorage`.
 */
export function AdminPinDialog({ open, name, onClose, onSuccess }: AdminPinDialogProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin('');
      setError(null);
      // O backend gratuito pode estar dormindo; acorda enquanto ela digita.
      api.ping();
    }
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pin.trim().length < 4 || loading) return;

    setLoading(true);
    setError(null);

    try {
      const session = await api.login(pin.trim());
      storeAdminToken(session.token, session.expiresAt);
      onSuccess();
    } catch (cause) {
      const message =
        cause instanceof ApiError
          ? cause.status === 401
            ? 'PIN incorreto. Tente de novo.'
            : cause.message
          : 'Não consegui validar o PIN agora.';
      setError(message);
      setPin('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Acesso da administradora"
      description={`Oi, ${name.split(' ')[0]}. Informe o PIN para liberar o painel.`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Agora não
          </Button>
          <Button type="submit" form="admin-pin-form" loading={loading} disabled={pin.trim().length < 4}>
            Entrar
          </Button>
        </>
      }
    >
      <form id="admin-pin-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-gold-500/20 bg-gold-500/5 p-3.5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" aria-hidden />
          <p className="text-sm leading-relaxed text-muted">
            Você também pode usar o app como solicitante — é só fechar esta janela. O PIN só é
            necessário para aprovar, reprovar e cadastrar itens.
          </p>
        </div>

        <Field label="PIN" required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              ref={inputRef}
              aria-describedby={describedBy}
              invalid={invalid}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              className="tabular text-center text-2xl tracking-[0.5em]"
              leading={<KeyRound className="h-4 w-4" aria-hidden />}
              autoFocus
            />
          )}
        </Field>

        {error ? <ErrorNotice title="Não foi dessa vez" message={error} /> : null}
      </form>
    </Modal>
  );
}
