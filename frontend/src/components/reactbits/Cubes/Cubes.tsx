// Cubes — React Bits (https://reactbits.dev/), variante TS-TW.
// Baixado de https://reactbits.dev/r/Cubes-TS-TW.json por `npm run reactbits`.
// Versionado de proposito: pode ser customizado, mas o script sobrescreve.
//
// CUSTOMIZADO (nao rode `npm run reactbits -- Cubes` sem --force):
//   - Acrescentado o prop `className`. O original fixa `w-1/2 max-md:w-11/12
//     aspect-square` na raiz, o que serve para uma vitrine isolada mas impede
//     usar a grade como camada de fundo de outro elemento.
//   - Acrescentado o prop `stretch`. Cada cubo tem `aspect-square`, entao a
//     grade sempre fica quadrada e transborda de um container que nao seja.
//     Com `stretch` os cubos viram prismas e a grade acompanha a caixa.
//   - Acrescentado o prop `rows`. O original usa `gridSize` para linhas e
//     colunas; um calendario e 7 x 5-ou-6, e sem isso os cubos ficam meio
//     quadro fora dos dias, parecendo erro de renderizacao.
//
// Sem esses tres props, o comportamento e identico ao de fabrica.
import React, { useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Gap {
  row: number;
  col: number;
}
interface Duration {
  enter: number;
  leave: number;
}

export interface CubesProps {
  gridSize?: number;
  cubeSize?: number;
  maxAngle?: number;
  radius?: number;
  easing?: gsap.EaseString;
  duration?: Duration;
  cellGap?: number | Gap;
  borderStyle?: string;
  faceColor?: string;
  shadow?: boolean | string;
  autoAnimate?: boolean;
  rippleOnClick?: boolean;
  rippleColor?: string;
  rippleSpeed?: number;
  /** CUSTOMIZADO: substitui o dimensionamento padrao da raiz. */
  className?: string;
  /** CUSTOMIZADO: deixa a grade preencher a caixa em vez de ficar quadrada. */
  stretch?: boolean;
  /** CUSTOMIZADO: numero de linhas, quando diferente de `gridSize`. */
  rows?: number;
}

const Cubes: React.FC<CubesProps> = ({
  gridSize = 10,
  cubeSize,
  maxAngle = 45,
  radius = 3,
  easing = 'power3.out',
  duration = { enter: 0.3, leave: 0.6 },
  cellGap,
  borderStyle = '1px solid #fff',
  faceColor = '#120F17',
  shadow = false,
  autoAnimate = true,
  rippleOnClick = true,
  rippleColor = '#fff',
  rippleSpeed = 2,
  className,
  stretch = false,
  rows
}) => {
  const rowCount = rows ?? gridSize;
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userActiveRef = useRef(false);
  const simPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const simTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const simRAFRef = useRef<number | null>(null);

  const colGap =
    typeof cellGap === 'number'
      ? `${cellGap}px`
      : (cellGap as Gap)?.col !== undefined
        ? `${(cellGap as Gap).col}px`
        : '5%';
  const rowGap =
    typeof cellGap === 'number'
      ? `${cellGap}px`
      : (cellGap as Gap)?.row !== undefined
        ? `${(cellGap as Gap).row}px`
        : '5%';

  const enterDur = duration.enter;
  const leaveDur = duration.leave;

  const tiltAt = useCallback(
    (rowCenter: number, colCenter: number) => {
      if (!sceneRef.current) return;
      sceneRef.current.querySelectorAll<HTMLDivElement>('.cube').forEach(cube => {
        const r = +cube.dataset.row!;
        const c = +cube.dataset.col!;
        const dist = Math.hypot(r - rowCenter, c - colCenter);
        if (dist <= radius) {
          const pct = 1 - dist / radius;
          const angle = pct * maxAngle;
          gsap.to(cube, {
            duration: enterDur,
            ease: easing,
            overwrite: true,
            rotateX: -angle,
            rotateY: angle
          });
        } else {
          gsap.to(cube, {
            duration: leaveDur,
            ease: 'power3.out',
            overwrite: true,
            rotateX: 0,
            rotateY: 0
          });
        }
      });
    },
    [radius, maxAngle, enterDur, leaveDur, easing]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      userActiveRef.current = true;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      const rect = sceneRef.current!.getBoundingClientRect();
      const cellW = rect.width / gridSize;
      const cellH = rect.height / rowCount;
      const colCenter = (e.clientX - rect.left) / cellW;
      const rowCenter = (e.clientY - rect.top) / cellH;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => tiltAt(rowCenter, colCenter));

      idleTimerRef.current = setTimeout(() => {
        userActiveRef.current = false;
      }, 3000);
    },
    [gridSize, tiltAt]
  );

  const resetAll = useCallback(() => {
    if (!sceneRef.current) return;
    sceneRef.current.querySelectorAll<HTMLDivElement>('.cube').forEach(cube =>
      gsap.to(cube, {
        duration: leaveDur,
        rotateX: 0,
        rotateY: 0,
        ease: 'power3.out'
      })
    );
  }, [leaveDur]);

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      userActiveRef.current = true;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      const rect = sceneRef.current!.getBoundingClientRect();
      const cellW = rect.width / gridSize;
      const cellH = rect.height / rowCount;

      const touch = e.touches[0];
      const colCenter = (touch.clientX - rect.left) / cellW;
      const rowCenter = (touch.clientY - rect.top) / cellH;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => tiltAt(rowCenter, colCenter));

      idleTimerRef.current = setTimeout(() => {
        userActiveRef.current = false;
      }, 3000);
    },
    [gridSize, tiltAt]
  );

  const onTouchStart = useCallback(() => {
    userActiveRef.current = true;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!sceneRef.current) return;
    resetAll();
  }, [resetAll]);

  const onClick = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!rippleOnClick || !sceneRef.current) return;
      const rect = sceneRef.current.getBoundingClientRect();
      const cellW = rect.width / gridSize;
      const cellH = rect.height / rowCount;

      const clientX = (e as MouseEvent).clientX || ((e as TouchEvent).touches && (e as TouchEvent).touches[0].clientX);
      const clientY = (e as MouseEvent).clientY || ((e as TouchEvent).touches && (e as TouchEvent).touches[0].clientY);

      const colHit = Math.floor((clientX - rect.left) / cellW);
      const rowHit = Math.floor((clientY - rect.top) / cellH);

      const baseRingDelay = 0.15;
      const baseAnimDur = 0.3;
      const baseHold = 0.6;

      const spreadDelay = baseRingDelay / rippleSpeed;
      const animDuration = baseAnimDur / rippleSpeed;
      const holdTime = baseHold / rippleSpeed;

      const rings: Record<number, HTMLDivElement[]> = {};
      sceneRef.current.querySelectorAll<HTMLDivElement>('.cube').forEach(cube => {
        const r = +cube.dataset.row!;
        const c = +cube.dataset.col!;
        const dist = Math.hypot(r - rowHit, c - colHit);
        const ring = Math.round(dist);
        if (!rings[ring]) rings[ring] = [];
        rings[ring].push(cube);
      });

      Object.keys(rings)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach(ring => {
          const delay = ring * spreadDelay;
          const faces = rings[ring].flatMap(cube => Array.from(cube.querySelectorAll<HTMLElement>('.cube-face')));

          gsap.to(faces, {
            backgroundColor: rippleColor,
            duration: animDuration,
            delay,
            ease: 'power3.out'
          });
          gsap.to(faces, {
            backgroundColor: faceColor,
            duration: animDuration,
            delay: delay + animDuration + holdTime,
            ease: 'power3.out'
          });
        });
    },
    [rippleOnClick, gridSize, faceColor, rippleColor, rippleSpeed]
  );

  useEffect(() => {
    if (!autoAnimate || !sceneRef.current) return;
    simPosRef.current = {
      x: Math.random() * gridSize,
      y: Math.random() * gridSize
    };
    simTargetRef.current = {
      x: Math.random() * gridSize,
      y: Math.random() * gridSize
    };
    const speed = 0.02;
    const loop = () => {
      if (!userActiveRef.current) {
        const pos = simPosRef.current;
        const tgt = simTargetRef.current;
        pos.x += (tgt.x - pos.x) * speed;
        pos.y += (tgt.y - pos.y) * speed;
        tiltAt(pos.y, pos.x);
        if (Math.hypot(pos.x - tgt.x, pos.y - tgt.y) < 0.1) {
          simTargetRef.current = {
            x: Math.random() * gridSize,
            y: Math.random() * gridSize
          };
        }
      }
      simRAFRef.current = requestAnimationFrame(loop);
    };
    simRAFRef.current = requestAnimationFrame(loop);
    return () => {
      if (simRAFRef.current != null) cancelAnimationFrame(simRAFRef.current);
    };
  }, [autoAnimate, gridSize, tiltAt]);

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', resetAll);
    el.addEventListener('click', onClick);

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', resetAll);
      el.removeEventListener('click', onClick);

      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);

      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [onPointerMove, resetAll, onClick, onTouchMove, onTouchStart, onTouchEnd]);

  const cells = Array.from({ length: gridSize });
  const rowCells = Array.from({ length: rowCount });
  const sceneStyle: React.CSSProperties = {
    gridTemplateColumns: cubeSize ? `repeat(${gridSize}, ${cubeSize}px)` : `repeat(${gridSize}, 1fr)`,
    gridTemplateRows: cubeSize ? `repeat(${rowCount}, ${cubeSize}px)` : `repeat(${rowCount}, 1fr)`,
    columnGap: colGap,
    rowGap: rowGap,
    perspective: '99999999px',
    gridAutoRows: '1fr'
  };
  const wrapperStyle = {
    '--cube-face-border': borderStyle,
    '--cube-face-bg': faceColor,
    '--cube-face-shadow': shadow === true ? '0 0 6px rgba(0,0,0,.5)' : shadow || 'none',
    ...(cubeSize
      ? {
          width: `${gridSize * cubeSize}px`,
          height: `${rowCount * cubeSize}px`
        }
      : {})
  } as React.CSSProperties;

  return (
    <div
      className={`relative ${className ?? 'w-1/2 max-md:w-11/12 aspect-square'}`}
      style={wrapperStyle}
    >
      <div ref={sceneRef} className="grid w-full h-full" style={sceneStyle}>
        {rowCells.map((_, r) =>
          cells.map((__, c) => (
            <div
              key={`${r}-${c}`}
              className={`cube relative w-full h-full ${stretch ? '' : 'aspect-square'} [transform-style:preserve-3d]`}
              data-row={r}
              data-col={c}
            >
              <span className="absolute pointer-events-none -inset-9" />

              <div
                className="cube-face absolute inset-0 flex items-center justify-center"
                style={{
                  background: 'var(--cube-face-bg)',
                  border: 'var(--cube-face-border)',
                  boxShadow: 'var(--cube-face-shadow)',
                  transform: 'translateY(-50%) rotateX(90deg)'
                }}
              />
              <div
                className="cube-face absolute inset-0 flex items-center justify-center"
                style={{
                  background: 'var(--cube-face-bg)',
                  border: 'var(--cube-face-border)',
                  boxShadow: 'var(--cube-face-shadow)',
                  transform: 'translateY(50%) rotateX(-90deg)'
                }}
              />
              <div
                className="cube-face absolute inset-0 flex items-center justify-center"
                style={{
                  background: 'var(--cube-face-bg)',
                  border: 'var(--cube-face-border)',
                  boxShadow: 'var(--cube-face-shadow)',
                  transform: 'translateX(-50%) rotateY(-90deg)'
                }}
              />
              <div
                className="cube-face absolute inset-0 flex items-center justify-center"
                style={{
                  background: 'var(--cube-face-bg)',
                  border: 'var(--cube-face-border)',
                  boxShadow: 'var(--cube-face-shadow)',
                  transform: 'translateX(50%) rotateY(90deg)'
                }}
              />
              <div
                className="cube-face absolute inset-0 flex items-center justify-center"
                style={{
                  background: 'var(--cube-face-bg)',
                  border: 'var(--cube-face-border)',
                  boxShadow: 'var(--cube-face-shadow)',
                  transform: 'rotateY(-90deg) translateX(50%) rotateY(90deg)'
                }}
              />
              <div
                className="cube-face absolute inset-0 flex items-center justify-center"
                style={{
                  background: 'var(--cube-face-bg)',
                  border: 'var(--cube-face-border)',
                  boxShadow: 'var(--cube-face-shadow)',
                  transform: 'rotateY(90deg) translateX(-50%) rotateY(-90deg)'
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Cubes;
