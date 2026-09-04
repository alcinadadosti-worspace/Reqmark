/**
 * Confete dourado da tela de sucesso.
 *
 * `canvas-confetti` chega por import dinâmico: são ~6 kB que só fazem sentido
 * para quem acabou de enviar uma requisição. Silenciosamente ignorado quando a
 * pessoa pediu menos movimento no sistema.
 */
const GOLD = ['#F3D28C', '#E2B96F', '#CEA15C', '#A5793D', '#F5F1EA'];

export async function celebrate(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  try {
    const { default: confetti } = await import('canvas-confetti');

    const base = {
      colors: GOLD,
      disableForReducedMotion: true,
      scalar: 0.9,
      ticks: 180,
      zIndex: 60,
    };

    // Dois jatos laterais convergindo: mais elegante que a explosão central.
    confetti({ ...base, particleCount: 42, spread: 62, angle: 62, origin: { x: 0.1, y: 0.75 } });
    confetti({ ...base, particleCount: 42, spread: 62, angle: 118, origin: { x: 0.9, y: 0.75 } });

    window.setTimeout(() => {
      confetti({ ...base, particleCount: 26, spread: 90, startVelocity: 26, origin: { y: 0.55 } });
    }, 180);
  } catch {
    // Confete é decoração: falhar aqui nunca pode atrapalhar o fluxo.
  }
}
