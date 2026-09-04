// AnimatedList — React Bits (https://reactbits.dev/), variante TS-TW.
// Origem: https://reactbits.dev/r/AnimatedList-TS-TW.json
//
// CUSTOMIZADO neste repositório (`npm run reactbits` não sobrescreve; use --force):
//  1. `items` aceita ReactNode em vez de apenas string — a lista de pessoas
//     mostra avatar de iniciais junto do nome, o que a versão original não
//     permitia.
//  2. A navegação por teclado ouvia `window` e dava `preventDefault` no Tab,
//     o que sequestrava o Tab da página inteira e quebrava o campo de busca
//     logo acima da lista. Agora o listener é do próprio contêiner e só trata
//     as setas, Enter e Home/End — o Tab volta a ser do navegador.
//  3. Cores e largura fixa (`w-[500px]`, `bg-[#111]`) saíram das classes
//     internas para as props, para a lista herdar a paleta onyx/dourado.
//  4. `role="listbox"`/`option` e `aria-selected` adicionados.
import React, {
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type MouseEventHandler,
  type UIEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { motion, useInView } from 'motion/react';

interface AnimatedItemProps {
  children: ReactNode;
  delay?: number;
  index: number;
  selected: boolean;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

const AnimatedItem: React.FC<AnimatedItemProps> = ({
  children,
  delay = 0,
  index,
  selected,
  onMouseEnter,
  onClick,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: false });

  return (
    <motion.div
      ref={ref}
      data-index={index}
      role="option"
      aria-selected={selected}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.94, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.94, opacity: 0 }}
      transition={{ duration: 0.22, delay }}
      className="mb-2 cursor-pointer"
    >
      {children}
    </motion.div>
  );
};

interface AnimatedListProps {
  items?: ReactNode[];
  onItemSelect?: (index: number) => void;
  showGradients?: boolean;
  enableArrowNavigation?: boolean;
  className?: string;
  listClassName?: string;
  itemClassName?: string;
  selectedItemClassName?: string;
  displayScrollbar?: boolean;
  initialSelectedIndex?: number;
  /** Cor de onde os degradês de topo/base desbotam. */
  gradientColor?: string;
  'aria-label'?: string;
}

const AnimatedList: React.FC<AnimatedListProps> = ({
  items = [],
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  className = '',
  listClassName = '',
  itemClassName = '',
  selectedItemClassName = '',
  displayScrollbar = true,
  initialSelectedIndex = -1,
  gradientColor = '#121216',
  'aria-label': ariaLabel,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(initialSelectedIndex);
  const [topGradientOpacity, setTopGradientOpacity] = useState<number>(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState<number>(1);

  const handleItemMouseEnter = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleItemClick = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      onItemSelect?.(index);
    },
    [onItemSelect]
  );

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.target as HTMLDivElement;
    setTopGradientOpacity(Math.min(scrollTop / 50, 1));
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1));
  };

  /** Rola o item para dentro da área visível ao navegar pelo teclado. */
  const revealIndex = useCallback((index: number) => {
    const container = listRef.current;
    if (!container) return;

    const target = container.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!target) return;

    const margin = 48;
    const itemTop = target.offsetTop;
    const itemBottom = itemTop + target.offsetHeight;

    if (itemTop < container.scrollTop + margin) {
      container.scrollTo({ top: Math.max(0, itemTop - margin), behavior: 'smooth' });
    } else if (itemBottom > container.scrollTop + container.clientHeight - margin) {
      container.scrollTo({
        top: itemBottom - container.clientHeight + margin,
        behavior: 'smooth',
      });
    }
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!enableArrowNavigation || items.length === 0) return;

    const move = (next: number) => {
      event.preventDefault();
      const clamped = Math.max(0, Math.min(next, items.length - 1));
      setSelectedIndex(clamped);
      revealIndex(clamped);
    };

    switch (event.key) {
      case 'ArrowDown':
        move(selectedIndex + 1);
        break;
      case 'ArrowUp':
        move(selectedIndex - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(items.length - 1);
        break;
      case 'Enter':
      case ' ':
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          event.preventDefault();
          onItemSelect?.(selectedIndex);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={listRef}
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={`overflow-y-auto outline-none ${
          displayScrollbar ? '' : 'no-scrollbar'
        } ${listClassName}`}
        onScroll={handleScroll}
      >
        {items.map((item, index) => (
          <AnimatedItem
            key={index}
            delay={Math.min(index, 8) * 0.03}
            index={index}
            selected={selectedIndex === index}
            onMouseEnter={() => handleItemMouseEnter(index)}
            onClick={() => handleItemClick(index)}
          >
            <div className={`${itemClassName} ${selectedIndex === index ? selectedItemClassName : ''}`}>
              {item}
            </div>
          </AnimatedItem>
        ))}
      </div>

      {showGradients ? (
        <>
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 h-10 transition-opacity duration-300"
            style={{
              opacity: topGradientOpacity,
              background: `linear-gradient(to bottom, ${gradientColor}, transparent)`,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-14 transition-opacity duration-300"
            style={{
              opacity: bottomGradientOpacity,
              background: `linear-gradient(to top, ${gradientColor}, transparent)`,
            }}
            aria-hidden
          />
        </>
      ) : null}
    </div>
  );
};

export default AnimatedList;
