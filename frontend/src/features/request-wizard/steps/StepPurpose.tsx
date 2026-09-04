import { Chip, ChipWrap } from '@/components/ui/Chip';
import { Field, Textarea } from '@/components/ui/Field';

/** Espaço suficiente para explicar sem virar redação. */
const MAX_PURPOSE = 400;
const MIN_PURPOSE = 10;

export interface StepPurposeProps {
  purposeTypes: string[];
  purposeType: string;
  purpose: string;
  onTypeChange: (value: string) => void;
  onPurposeChange: (value: string) => void;
  showErrors: boolean;
}

/**
 * Passo 2 — Finalidade.
 *
 * O texto livre é obrigatório: é ele que dá à administradora o contexto para
 * decidir entre duas requisições que disputam o mesmo item.
 */
export function StepPurpose({
  purposeTypes,
  purposeType,
  purpose,
  onTypeChange,
  onPurposeChange,
  showErrors,
}: StepPurposeProps) {
  const trimmed = purpose.trim();
  const typeError = showErrors && !purposeType ? 'Escolha um tipo de ação.' : undefined;
  const textError =
    showErrors && trimmed.length < MIN_PURPOSE
      ? `Conte um pouco mais — pelo menos ${MIN_PURPOSE} caracteres.`
      : undefined;

  return (
    <div className="space-y-6">
      <Field label="Que tipo de ação é?" required error={typeError}>
        {() => (
          <ChipWrap>
            {purposeTypes.map((type) => (
              <Chip key={type} selected={purposeType === type} onClick={() => onTypeChange(type)}>
                {type}
              </Chip>
            ))}
          </ChipWrap>
        )}
      </Field>

      <Field
        label="Para que vai usar?"
        required
        error={textError}
        hint="Quanto mais claro, mais rápido a Suzana consegue aprovar."
        counter={`${purpose.length}/${MAX_PURPOSE}`}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={purpose}
            maxLength={MAX_PURPOSE}
            onChange={(event) => onPurposeChange(event.target.value)}
            placeholder="Ex.: ativação de Dia das Mães na praça central de Penedo, com degustação de perfumaria e abordagem de fluxo — sábado e domingo, das 9h às 17h."
          />
        )}
      </Field>
    </div>
  );
}
