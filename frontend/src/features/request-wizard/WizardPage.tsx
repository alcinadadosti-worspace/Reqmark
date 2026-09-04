import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import Stepper, { Step, type StepperFooterApi } from '@/components/reactbits/Stepper/Stepper';
import ClickSpark from '@/components/reactbits/ClickSpark/ClickSpark';
import Magnet from '@/components/reactbits/Magnet/Magnet';
import StarBorder from '@/components/reactbits/StarBorder/StarBorder';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Surface';
import { ErrorNotice, LoadingScreen } from '@/components/ui/Feedback';
import { cn } from '@/lib/cn';
import { evaluatePeriod } from '@/lib/availability';
import { createRequest } from '@/lib/collections';
import { today } from '@/lib/dates';
import { daysBetweenInclusive } from '@/shared/dates';
import { useAppData } from '@/data/AppDataProvider';
import { useIdentityStore } from '@/store/identity';
import { useIsTouch } from '@/hooks/useMediaQuery';
import { selectionToLines, useWizardStore } from '@/store/wizard';
import type { Item, RequestItem } from '@/shared/types';
import { StepItems } from './steps/StepItems';
import { StepPurpose } from './steps/StepPurpose';
import { StepCity } from './steps/StepCity';
import { StepPeriod } from './steps/StepPeriod';
import { StepReview } from './steps/StepReview';
import { SuccessScreen } from './SuccessScreen';

const STEP_TITLES = ['Itens', 'Finalidade', 'Cidade', 'Período', 'Revisão'];
const TOTAL_STEPS = STEP_TITLES.length;

/**
 * Wizard de nova requisição (`/nova`) — seção 8.3.
 *
 * Cinco passos com validação a cada um: não dá para avançar com erro. O estado
 * vive no `sessionStorage` (store `wizard`), então recarregar a página no meio
 * do preenchimento não perde nada.
 */
export default function WizardPage() {
  const isTouch = useIsTouch();

  const { activeItems, itemsById, stockById, occupancy, settings, ready, error } = useAppData();
  const identity = useIdentityStore((state) => state.identity);

  const wizard = useWizardStore();
  const [showErrors, setShowErrors] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ id: string; number: number } | null>(null);

  const day = today();
  const lines = useMemo(() => selectionToLines(wizard.selection), [wizard.selection]);

  /** Só as linhas cujos itens ainda existem no catálogo. */
  const resolvedLines = useMemo(
    () =>
      lines
        .map((line) => {
          const item = itemsById.get(line.itemId);
          return item ? { item, quantity: line.quantity } : null;
        })
        .filter((entry): entry is { item: Item; quantity: number } => entry !== null),
    [lines, itemsById]
  );

  const evaluation = useMemo(() => {
    if (!wizard.startDate || !wizard.endDate || lines.length === 0) return null;
    return evaluatePeriod({
      selection: lines,
      items: stockById,
      index: occupancy,
      startDate: wizard.startDate,
      endDate: wizard.endDate,
    });
  }, [lines, stockById, occupancy, wizard.startDate, wizard.endDate]);

  // --- Validação por passo -------------------------------------------------

  const stepValidity = useMemo(() => {
    const purposeOk = Boolean(wizard.purposeType) && wizard.purpose.trim().length >= 10;
    const periodOk = Boolean(wizard.startDate && wizard.endDate) && (evaluation?.ok ?? false);

    return {
      1: resolvedLines.length > 0,
      2: purposeOk,
      3: Boolean(wizard.city),
      4: periodOk,
      5: resolvedLines.length > 0 && purposeOk && Boolean(wizard.city) && periodOk,
    } as Record<number, boolean>;
  }, [resolvedLines.length, wizard.purposeType, wizard.purpose, wizard.city, wizard.startDate, wizard.endDate, evaluation]);

  const canAdvance = stepValidity[wizard.step] ?? false;

  const goToStep = (next: number) => {
    // Voltar é sempre livre; avançar exige o passo atual válido.
    if (next > wizard.step && !canAdvance) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    wizard.setStep(Math.min(Math.max(next, 1), TOTAL_STEPS));
  };

  // --- Envio ---------------------------------------------------------------

  const submit = async () => {
    if (!identity || submitting) return;

    if (!stepValidity[5] || !wizard.city || !wizard.startDate || !wizard.endDate) {
      setShowErrors(true);
      return;
    }

    setSubmitting(true);

    try {
      // Revalida contra o estado mais recente: alguém pode ter sido aprovado
      // enquanto esta pessoa preenchia o formulário.
      const fresh = evaluatePeriod({
        selection: lines,
        items: stockById,
        index: occupancy,
        startDate: wizard.startDate,
        endDate: wizard.endDate,
      });

      if (!fresh.ok) {
        setSubmitting(false);
        wizard.setStep(4);
        setConflictMessage(
          'A disponibilidade mudou enquanto você preenchia. Escolha outro período, por favor.'
        );
        toast.error('O período ficou indisponível', {
          description: 'Alguém foi aprovado para esses dias. Escolha outra data.',
        });
        return;
      }

      const items: RequestItem[] = resolvedLines.map(({ item, quantity }) => ({
        itemId: item.id,
        itemName: item.name,
        icon: item.icon,
        quantity,
      }));

      const result = await createRequest({
        requesterId: identity.slackId,
        requesterName: identity.name,
        items,
        purposeType: wizard.purposeType,
        purpose: wizard.purpose.trim(),
        city: wizard.city,
        locationDetail: wizard.locationDetail.trim() || undefined,
        startDate: wizard.startDate,
        endDate: wizard.endDate,
        days: daysBetweenInclusive(wizard.startDate, wizard.endDate),
      });

      wizard.reset();
      setCreated(result);
    } catch (cause) {
      console.error('[WizardPage] falha ao criar requisição', cause);
      toast.error('Não consegui enviar a requisição', {
        description: 'Verifique sua conexão e tente de novo em alguns segundos.',
      });
      setSubmitting(false);
    }
  };

  // --- Renderização --------------------------------------------------------

  if (created) {
    return (
      <SuccessScreen
        requestId={created.id}
        number={created.number}
        onNewRequest={() => {
          setCreated(null);
          setSubmitting(false);
          wizard.reset();
        }}
      />
    );
  }

  if (error) return <ErrorNotice message={error} />;
  if (!ready) return <LoadingScreen label="Carregando os itens…" />;

  const footer = ({ currentStep, isFirstStep, isLastStep, back, next }: StepperFooterApi) => (
    <div className="flex items-center gap-3 pt-6">
      {!isFirstStep ? (
        <Button
          variant="ghost"
          onClick={() => {
            setShowErrors(false);
            back();
          }}
          icon={<ArrowLeft className="h-4 w-4" aria-hidden />}
        >
          Voltar
        </Button>
      ) : null}

      <div className="ml-auto">
        {isLastStep ? (
          <Magnet padding={70} magnetStrength={4} disabled={isTouch}>
            <StarBorder
              as="button"
              type="button"
              onClick={submit}
              color="#F3D28C"
              speed="5s"
              thickness={1}
              className={cn(submitting && 'pointer-events-none opacity-60')}
            >
              <ClickSpark sparkColor="#F3D28C" sparkCount={12} sparkSize={8} sparkRadius={22}>
                <span className="flex items-center gap-2 px-1 font-semibold">
                  <Send className="h-4 w-4" aria-hidden />
                  {submitting ? 'Enviando…' : 'Enviar requisição'}
                </span>
              </ClickSpark>
            </StarBorder>
          </Magnet>
        ) : (
          <Button
            onClick={() => {
              if (!canAdvance) {
                setShowErrors(true);
                return;
              }
              setShowErrors(false);
              next();
            }}
            disabled={!canAdvance}
            icon={<ArrowRight className="order-2 h-4 w-4" aria-hidden />}
          >
            Continuar
          </Button>
        )}
      </div>

      <span className="sr-only" aria-live="polite">
        Passo {currentStep} de {TOTAL_STEPS}: {STEP_TITLES[currentStep - 1]}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Passo ${wizard.step} de ${TOTAL_STEPS} · ${STEP_TITLES[wizard.step - 1]}`}
        title="Nova requisição"
        description="Escolha os itens, conte para que serão usados e diga onde e quando."
      />

      <Stepper
        className="w-full"
        stepCircleContainerClassName="glass w-full p-5 sm:p-6"
        stepContainerClassName="!p-0 pb-6 text-gold-400"
        contentClassName="!space-y-0"
        footerClassName=""
        currentStep={wizard.step}
        onStepChange={goToStep}
        disableStepIndicators={false}
        renderFooter={footer}
      >
        <Step>
          <StepItems
            items={activeItems}
            occupancy={occupancy}
            today={day}
            selection={wizard.selection}
            onQuantityChange={wizard.setQuantity}
            onToggle={wizard.toggleItem}
          />
          {showErrors && !stepValidity[1] ? (
            <p className="mt-3 text-xs text-status-rejected" role="alert">
              Escolha pelo menos um item.
            </p>
          ) : null}
        </Step>

        <Step>
          <StepPurpose
            purposeTypes={settings.purposeTypes}
            purposeType={wizard.purposeType}
            purpose={wizard.purpose}
            onTypeChange={wizard.setPurposeType}
            onPurposeChange={wizard.setPurpose}
            showErrors={showErrors}
          />
        </Step>

        <Step>
          <StepCity
            city={wizard.city}
            locationDetail={wizard.locationDetail}
            frequentCities={settings.cities}
            onCityChange={wizard.setCity}
            onLocationDetailChange={wizard.setLocationDetail}
            showErrors={showErrors}
          />
        </Step>

        <Step>
          <StepPeriod
            selection={lines}
            items={stockById}
            occupancy={occupancy}
            startDate={wizard.startDate}
            endDate={wizard.endDate}
            onChange={wizard.setPeriod}
            conflictMessage={conflictMessage}
            onConflict={setConflictMessage}
            showErrors={showErrors}
          />
        </Step>

        <Step>
          {wizard.city && wizard.startDate && wizard.endDate && resolvedLines.length > 0 ? (
            <StepReview
              lines={resolvedLines}
              purposeType={wizard.purposeType}
              purpose={wizard.purpose}
              city={wizard.city}
              locationDetail={wizard.locationDetail}
              startDate={wizard.startDate}
              endDate={wizard.endDate}
              warnings={evaluation?.warnings ?? []}
            />
          ) : (
            <div className="rounded-2xl border border-gold-500/25 bg-gold-500/6 p-4 text-sm text-ivory">
              Falta preencher alguns passos.{' '}
              <button
                type="button"
                onClick={() => wizard.setStep(1)}
                className="text-gold-300 underline underline-offset-4"
              >
                Voltar ao começo
              </button>
            </div>
          )}
        </Step>
      </Stepper>
    </div>
  );
}
