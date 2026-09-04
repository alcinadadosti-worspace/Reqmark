import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { ErrorNotice } from '@/components/ui/Feedback';
import { ApiError, api } from '@/lib/api';
import { describeConflict } from '@/lib/availability';
import type { Conflict } from '@/shared/availability';
import type { MarketingRequest } from '@/shared/types';

export type DecisionMode = 'approve' | 'reject';

export interface DecisionDialogProps {
  open: boolean;
  mode: DecisionMode;
  request: MarketingRequest | null;
  /** Conflitos com requisições já aprovadas — exigem confirmação explícita. */
  conflicts: Conflict[];
  onClose: () => void;
  onDone?: () => void;
}

const MAX_NOTE = 400;

/**
 * Aprovar / reprovar pelo app (seção 8.6).
 *
 * A decisão sempre vai para `POST /admin/requests/:id/decision`: é o backend
 * que revalida o conflito, escreve no Firestore, atualiza a mensagem do Slack e
 * manda a DM para o solicitante. O app só reflete o Firestore em tempo real.
 *
 * Aprovar com conflito é possível — a administradora pode ter combinado algo por
 * fora — mas exige marcar a confirmação, para nunca acontecer sem querer.
 */
export function DecisionDialog({
  open,
  mode,
  request,
  conflicts,
  onClose,
  onDone,
}: DecisionDialogProps) {
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote('');
      setConfirmed(false);
      setError(null);
    }
  }, [open]);

  const isReject = mode === 'reject';
  const hasConflicts = conflicts.length > 0;
  const noteRequired = isReject;
  const noteMissing = noteRequired && note.trim().length < 3;
  const blockedByConfirmation = !isReject && hasConflicts && !confirmed;

  const submit = async () => {
    if (!request || loading || noteMissing || blockedByConfirmation) return;

    setLoading(true);
    setError(null);

    try {
      await api.decide(request.id, {
        decision: mode,
        note: note.trim() || undefined,
        force: !isReject && hasConflicts ? true : undefined,
      });

      toast.success(isReject ? 'Requisição reprovada' : 'Requisição aprovada', {
        description: isReject
          ? 'O solicitante recebeu o motivo no app e no Slack.'
          : 'O solicitante já foi avisado no app e no Slack.',
      });

      onDone?.();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Não consegui registrar a decisão. Tente de novo.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      persistent={loading}
      title={isReject ? 'Reprovar requisição' : 'Aprovar requisição'}
      description={
        request
          ? `#${String(request.number).padStart(4, '0')} · ${request.requesterName}`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant={isReject ? 'danger' : 'success'}
            onClick={submit}
            loading={loading}
            disabled={noteMissing || blockedByConfirmation}
            spark={!isReject}
          >
            {isReject ? 'Reprovar' : 'Aprovar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {hasConflicts && !isReject ? (
          <div className="rounded-2xl border border-status-rejected/35 bg-status-rejected/8 p-3.5">
            <p className="flex items-center gap-2 text-sm font-medium text-status-rejected">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              Conflito com uma reserva já aprovada
            </p>

            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ivory/85">
              {conflicts.map((conflict) => (
                <li key={conflict.itemId}>{describeConflict(conflict)}</li>
              ))}
            </ul>

            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs text-ivory/90">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#CEA15C]"
              />
              <span>
                Entendi o conflito e quero aprovar mesmo assim — vou combinar a divisão dos itens
                com as pessoas envolvidas.
              </span>
            </label>
          </div>
        ) : null}

        <Field
          label={isReject ? 'Motivo da reprovação' : 'Observação (opcional)'}
          required={noteRequired}
          hint={
            isReject
              ? 'O solicitante recebe este texto no app e no Slack — explique para ele poder ajustar e pedir de novo.'
              : 'Ex.: "A tenda está com um pé torto, cuidado na montagem."'
          }
          counter={`${note.length}/${MAX_NOTE}`}
          error={noteMissing && note.length > 0 ? 'Escreva o motivo.' : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={note}
              maxLength={MAX_NOTE}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                isReject
                  ? 'Ex.: a tenda já está reservada para a ação de Arapiraca nesse fim de semana.'
                  : ''
              }
              className="min-h-[6rem]"
            />
          )}
        </Field>

        {error ? <ErrorNotice message={error} /> : null}
      </div>
    </Modal>
  );
}
