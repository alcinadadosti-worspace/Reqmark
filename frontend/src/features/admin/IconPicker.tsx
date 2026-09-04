import { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { ALL_ICON_KEYS, CUSTOM_ICON_KEYS, ItemIcon, isCustomIcon } from '@/components/icons/ItemIcon';
import { Input } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { normalize } from '@/lib/geocode';

/** Nome legível de cada ícone próprio, para a busca funcionar em português. */
const CUSTOM_LABELS: Record<string, string> = {
  tent: 'tenda barraca gazebo estrutura',
  table: 'mesa dobrável tampo mobiliário',
  chair: 'cadeira assento banco mobiliário',
  counter: 'bancada balcão degustação',
  cart: 'carrinho carrinho de marketing',
};

export interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

/**
 * Seletor de ícone do cadastro de itens (seção 8.6).
 *
 * Os cinco ícones próprios vêm primeiro, marcados como "da casa": eles têm o
 * traço da logo e são o padrão visual do app. Em seguida, o subconjunto curado
 * do lucide.
 */
export function IconPicker({ value, onChange }: IconPickerProps) {
  const [term, setTerm] = useState('');

  const results = useMemo(() => {
    const needle = normalize(term);
    if (!needle) return ALL_ICON_KEYS;

    return ALL_ICON_KEYS.filter((key) => {
      const haystack = normalize(`${key} ${CUSTOM_LABELS[key] ?? ''}`);
      return haystack.includes(needle);
    });
  }, [term]);

  return (
    <div className="space-y-3">
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Buscar ícone… (tenda, mesa, caixa)"
        aria-label="Buscar ícone"
        className="h-11"
        leading={<Search className="h-4 w-4" aria-hidden />}
      />

      {/* Prévia da escolha atual */}
      <div className="flex items-center gap-3 rounded-2xl border border-gold-500/20 bg-onyx-800/50 p-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-300">
          <ItemIcon name={value} className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-ivory">{value}</p>
          <p className="text-2xs text-muted">
            {isCustomIcon(value) ? 'Ícone próprio, no traço da logo' : 'Ícone do lucide'}
          </p>
        </div>
      </div>

      <div
        className="grid max-h-52 grid-cols-6 gap-1.5 overflow-y-auto rounded-2xl border border-onyx-700 bg-onyx-900/40 p-2 sm:grid-cols-8"
        role="radiogroup"
        aria-label="Escolher ícone"
      >
        {results.map((key) => {
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={key}
              title={key}
              onClick={() => onChange(key)}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-xl border transition-all',
                selected
                  ? 'border-gold-500/60 bg-gold-500/15 text-gold-300'
                  : 'border-transparent text-muted hover:border-gold-500/25 hover:bg-onyx-800 hover:text-ivory'
              )}
            >
              <ItemIcon name={key} className="h-5 w-5" />
              {CUSTOM_ICON_KEYS.includes(key) ? (
                <Sparkles
                  className="absolute right-0.5 top-0.5 h-2.5 w-2.5 text-gold-500/70"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}

        {results.length === 0 ? (
          <p className="col-span-full py-6 text-center text-xs text-muted">
            Nenhum ícone com esse nome.
          </p>
        ) : null}
      </div>
    </div>
  );
}
