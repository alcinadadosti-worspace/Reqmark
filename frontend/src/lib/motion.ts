/**
 * Vocabulario de movimento do app.
 *
 * Principio (secao 5): rapido e intencional — 150 a 350 ms, springs suaves nos
 * cards, stagger de 40 a 60 ms nas listas. Tudo passa por `prefers-reduced-
 * motion`: quando a pessoa pede menos movimento, as variantes viram no-ops e os
 * fundos WebGL nem sao carregados.
 */
import type { Transition, Variants } from 'motion/react';

export const EASE_BRAND = [0.22, 1, 0.36, 1] as const;

export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 26, mass: 0.7 };
export const springSnappy: Transition = { type: 'spring', stiffness: 420, damping: 32, mass: 0.6 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_BRAND } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16, ease: EASE_BRAND } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22, ease: EASE_BRAND } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: springSoft },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.14 } },
};

/** Container de lista: escalona os filhos em 45 ms. */
export const staggerList: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

export const staggerItem: Variants = fadeUp;

/** Transicao de pagina usada pelo `AnimatePresence` das rotas. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE_BRAND } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: EASE_BRAND } },
};

/** Drawer que sobe pela base no celular e desliza pela direita no desktop. */
export const drawerVariants: Variants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: { type: 'spring', stiffness: 320, damping: 34 } },
  exit: { y: '100%', transition: { duration: 0.2, ease: EASE_BRAND } },
};

/** Variantes neutras, para quando `prefers-reduced-motion` esta ativo. */
export const reducedVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
  exit: { opacity: 1 },
};

/** Escolhe entre a variante animada e a neutra. */
export function variantsFor(reduced: boolean, variants: Variants): Variants {
  return reduced ? reducedVariants : variants;
}
