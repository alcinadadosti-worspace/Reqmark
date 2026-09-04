// Stepper — React Bits (https://reactbits.dev/), variante TS-TW.
// Origem: https://reactbits.dev/r/Stepper-TS-TW.json
//
// CUSTOMIZADO neste repositório (`npm run reactbits` não sobrescreve; use --force):
//  1. Modo CONTROLADO: aceita `currentStep` + `onStepChange`. O wizard guarda o
//     passo no `sessionStorage`, então recarregar a página não pode perder o
//     lugar — a versão original só tinha estado interno.
//  2. `renderFooter`: o rodapé original tem botões próprios e escreve
//     "Complete" em inglês, fixo no código (ignorando `nextButtonText`). O
//     wizard precisa de "Voltar/Continuar/Enviar requisição" em português, com
//     Magnet e StarBorder no botão final.
//  3. Layout: saíram `sm:aspect-[4/3] md:aspect-[2/1]` e `max-w-md`, que
//     engessavam a altura e a largura. Agora `className` e
//     `stepCircleContainerClassName` mandam.
//  4. Cores fixas (#5227FF) trocadas por `currentColor`, para o indicador
//     herdar o dourado da marca.
import React, {
  useState,
  Children,
  useRef,
  useLayoutEffect,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';

export interface StepperFooterApi {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  back: () => void;
  next: () => void;
  complete: () => void;
}

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  initialStep?: number;
  /** Passo atual. Informe para usar o componente em modo controlado. */
  currentStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  stepCircleContainerClassName?: string;
  stepContainerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  backButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  nextButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  backButtonText?: string;
  nextButtonText?: string;
  completeButtonText?: string;
  disableStepIndicators?: boolean;
  renderStepIndicator?: (props: {
    step: number;
    currentStep: number;
    onStepClick: (clicked: number) => void;
  }) => ReactNode;
  /** Substitui o rodapé padrão por um próprio. */
  renderFooter?: (api: StepperFooterApi) => ReactNode;
}

export default function Stepper({
  children,
  initialStep = 1,
  currentStep: controlledStep,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  stepCircleContainerClassName = '',
  stepContainerClassName = '',
  contentClassName = '',
  footerClassName = '',
  backButtonProps = {},
  nextButtonProps = {},
  backButtonText = 'Voltar',
  nextButtonText = 'Continuar',
  completeButtonText = 'Concluir',
  disableStepIndicators = false,
  renderStepIndicator,
  renderFooter,
  className = '',
  ...rest
}: StepperProps) {
  const [internalStep, setInternalStep] = useState<number>(initialStep);
  const isControlled = controlledStep !== undefined;
  const currentStep = isControlled ? controlledStep : internalStep;

  const [direction, setDirection] = useState<number>(0);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = (newStep: number) => {
    if (!isControlled) setInternalStep(newStep);
    if (newStep > totalSteps) onFinalStepCompleted();
    else onStepChange(newStep);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      updateStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1);
      updateStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    setDirection(1);
    updateStep(totalSteps + 1);
  };

  const footerApi: StepperFooterApi = {
    currentStep,
    totalSteps,
    isFirstStep: currentStep === 1,
    isLastStep,
    back: handleBack,
    next: handleNext,
    complete: handleComplete,
  };

  return (
    <div className={className || 'flex min-h-full flex-1 flex-col items-center justify-center p-4'} {...rest}>
      <div className={stepCircleContainerClassName || 'mx-auto w-full max-w-md rounded-4xl shadow-xl'}>
        <div className={`${stepContainerClassName} flex w-full items-center p-8`}>
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            const isNotLastStep = index < totalSteps - 1;
            return (
              <React.Fragment key={stepNumber}>
                {renderStepIndicator ? (
                  renderStepIndicator({
                    step: stepNumber,
                    currentStep,
                    onStepClick: (clicked) => {
                      setDirection(clicked > currentStep ? 1 : -1);
                      updateStep(clicked);
                    },
                  })
                ) : (
                  <StepIndicator
                    step={stepNumber}
                    disableStepIndicators={disableStepIndicators}
                    currentStep={currentStep}
                    onClickStep={(clicked) => {
                      setDirection(clicked > currentStep ? 1 : -1);
                      updateStep(clicked);
                    }}
                  />
                )}
                {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} />}
              </React.Fragment>
            );
          })}
        </div>

        <StepContentWrapper
          isCompleted={isCompleted}
          currentStep={currentStep}
          direction={direction}
          className={`space-y-2 ${contentClassName}`}
        >
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {!isCompleted &&
          (renderFooter ? (
            <div className={footerClassName}>{renderFooter(footerApi)}</div>
          ) : (
            <div className={`px-8 pb-8 ${footerClassName}`}>
              <div className={`mt-10 flex ${currentStep !== 1 ? 'justify-between' : 'justify-end'}`}>
                {currentStep !== 1 && (
                  <button
                    onClick={handleBack}
                    className="duration-350 rounded px-2 py-1 text-neutral-400 transition hover:text-neutral-200"
                    {...backButtonProps}
                  >
                    {backButtonText}
                  </button>
                )}
                <button
                  onClick={isLastStep ? handleComplete : handleNext}
                  className="duration-350 flex items-center justify-center rounded-full px-3.5 py-1.5 font-medium tracking-tight transition"
                  {...nextButtonProps}
                >
                  {isLastStep ? completeButtonText : nextButtonText}
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

interface StepContentWrapperProps {
  isCompleted: boolean;
  currentStep: number;
  direction: number;
  children: ReactNode;
  className?: string;
}

function StepContentWrapper({
  isCompleted,
  currentStep,
  direction,
  children,
  className = '',
}: StepContentWrapperProps) {
  const [parentHeight, setParentHeight] = useState<number>(0);

  return (
    <motion.div
      style={{ position: 'relative', overflow: 'hidden' }}
      animate={{ height: isCompleted ? 0 : parentHeight }}
      transition={{ type: 'spring', duration: 0.4 }}
      className={className}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <SlideTransition key={currentStep} direction={direction} onHeightReady={(h) => setParentHeight(h)}>
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface SlideTransitionProps {
  children: ReactNode;
  direction: number;
  onHeightReady: (height: number) => void;
}

function SlideTransition({ children, direction, onHeightReady }: SlideTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    onHeightReady(element.offsetHeight);

    // O conteúdo muda de altura sozinho (calendário troca de mês, lista de
    // cidades abre): sem observar, a moldura ficaria com a altura antiga.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => onHeightReady(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [children, onHeightReady]);

  return (
    <motion.div
      ref={containerRef}
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.34 }}
      style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
    >
      {children}
    </motion.div>
  );
}

const stepVariants: Variants = {
  enter: (dir: number) => ({
    x: dir >= 0 ? '-100%' : '100%',
    opacity: 0,
  }),
  center: {
    x: '0%',
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? '50%' : '-50%',
    opacity: 0,
  }),
};

interface StepProps {
  children: ReactNode;
}

export function Step({ children }: StepProps) {
  return <div>{children}</div>;
}

interface StepIndicatorProps {
  step: number;
  currentStep: number;
  onClickStep: (clicked: number) => void;
  disableStepIndicators?: boolean;
}

function StepIndicator({ step, currentStep, onClickStep, disableStepIndicators = false }: StepIndicatorProps) {
  const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete';

  const handleClick = () => {
    if (step !== currentStep && !disableStepIndicators) onClickStep(step);
  };

  return (
    <motion.div
      onClick={handleClick}
      className={`relative outline-none focus:outline-none ${
        disableStepIndicators ? 'pointer-events-none opacity-50' : 'cursor-pointer'
      }`}
      animate={status}
      initial={false}
    >
      <motion.div
        variants={{
          inactive: { scale: 1, opacity: 0.45 },
          active: { scale: 1, opacity: 1 },
          complete: { scale: 1, opacity: 1 },
        }}
        transition={{ duration: 0.3 }}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-current font-semibold text-current"
      >
        {status === 'complete' ? (
          <CheckIcon className="h-4 w-4" />
        ) : status === 'active' ? (
          <div className="h-3 w-3 rounded-full bg-current" />
        ) : (
          <span className="text-sm">{step}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

interface StepConnectorProps {
  isComplete: boolean;
}

function StepConnector({ isComplete }: StepConnectorProps) {
  const lineVariants: Variants = {
    incomplete: { width: 0 },
    complete: { width: '100%' },
  };

  return (
    <div className="relative mx-2 h-0.5 flex-1 overflow-hidden rounded bg-current opacity-25">
      <motion.div
        className="absolute left-0 top-0 h-full bg-current opacity-100"
        variants={lineVariants}
        initial={false}
        animate={isComplete ? 'complete' : 'incomplete'}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
}

type CheckIconProps = React.SVGProps<SVGSVGElement>;

function CheckIcon(props: CheckIconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.1, type: 'tween', ease: 'easeOut', duration: 0.3 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
