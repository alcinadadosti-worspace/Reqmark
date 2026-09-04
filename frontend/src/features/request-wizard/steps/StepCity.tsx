import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Loader2, MapPin, Search, X } from 'lucide-react';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { Field, Input } from '@/components/ui/Field';
import { LazyCityMap } from '@/components/map/LazyCityMap';
import { cn } from '@/lib/cn';
import { cityLabel, hasCoordinates, manualCity, searchCities, type CityResult } from '@/lib/geocode';
import { EASE_BRAND } from '@/lib/motion';
import type { CityPreset, CityRef } from '@/shared/types';

/** Tempo de espera antes de consultar o geocoder (seção 8.3). */
const DEBOUNCE_MS = 300;

export interface StepCityProps {
  city: CityRef | null;
  locationDetail: string;
  frequentCities: CityPreset[];
  onCityChange: (city: CityRef | null) => void;
  onLocationDetailChange: (value: string) => void;
  showErrors: boolean;
}

/**
 * Passo 3 — Cidade.
 *
 * Autocomplete no Photon (com Nominatim de reserva), restrito ao Brasil e
 * enviesado para Alagoas. Se os dois geocoders falharem, a pessoa ainda
 * consegue digitar o nome da cidade — só fica sem pino no mapa, o que é bem
 * melhor do que travar a requisição.
 */
export function StepCity({
  city,
  locationDetail,
  frequentCities,
  onCityChange,
  onLocationDetailChange,
  showErrors,
}: StepCityProps) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [geocoderFailed, setGeocoderFailed] = useState(false);
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const { cities, failed } = await searchCities(query, controller.signal);
      if (controller.signal.aborted) return;

      setResults(cities);
      setGeocoderFailed(failed);
      setSearching(false);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const choose = (next: CityRef) => {
    onCityChange(next);
    setTerm('');
    setResults([]);
  };

  const error = showErrors && !city ? 'Escolha a cidade da ação.' : undefined;

  return (
    <div className="space-y-5">
      <Field
        label="Em qual cidade?"
        required
        error={error}
        hint={
          geocoderFailed
            ? undefined
            : 'Comece a digitar o nome — as cidades de Alagoas aparecem primeiro.'
        }
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar cidade…"
            autoComplete="off"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="lista-cidades"
            leading={<Search className="h-4 w-4" aria-hidden />}
            trailing={
              searching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : term ? (
                <button
                  type="button"
                  onClick={() => setTerm('')}
                  className="rounded-full p-1 transition-colors hover:text-ivory"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null
            }
          />
        )}
      </Field>

      {/* Resultados do geocoder */}
      <AnimatePresence initial={false}>
        {results.length > 0 ? (
          <motion.ul
            id="lista-cidades"
            role="listbox"
            aria-label="Cidades encontradas"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: EASE_BRAND }}
            className="glass-flat divide-y divide-onyx-700/60 overflow-hidden"
          >
            {results.map((result) => (
              <li key={`${result.name}-${result.lat}-${result.lng}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={city?.name === result.name && city?.state === result.state}
                  onClick={() => choose(result)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-onyx-800/70"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-gold-400/80" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ivory">{result.name}</span>
                    <span className="block truncate text-2xs text-muted">{result.displayName}</span>
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>

      {/* Caminho manual quando o geocoder não responde */}
      {geocoderFailed && term.trim().length >= 2 && results.length === 0 ? (
        <div className="rounded-2xl border border-gold-500/25 bg-gold-500/6 p-3.5">
          <p className="text-sm text-ivory">A busca de cidades está fora do ar agora.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Você pode seguir mesmo assim — a requisição fica sem o pino no mapa, mas com o nome da
            cidade registrado.
          </p>
          <button
            type="button"
            onClick={() => choose(manualCity(term.trim()))}
            className="mt-3 text-sm text-gold-300 underline underline-offset-4 hover:text-gold-200"
          >
            Usar “{term.trim()}” assim mesmo
          </button>
        </div>
      ) : null}

      {/* Cidades frequentes */}
      {frequentCities.length > 0 && !term ? (
        <div>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.16em] text-muted/70">
            Cidades frequentes
          </p>
          <ChipRow>
            {frequentCities.map((preset) => {
              const isSelected = city?.name === preset.name && city?.state === preset.state;
              return (
                <Chip
                  key={`${preset.name}-${preset.state}`}
                  selected={isSelected}
                  icon={isSelected ? <Check className="h-3.5 w-3.5" aria-hidden /> : undefined}
                  onClick={() =>
                    choose({
                      name: preset.name,
                      state: preset.state,
                      lat: preset.lat,
                      lng: preset.lng,
                      displayName: `${preset.name}, ${preset.state} — Brasil`,
                    })
                  }
                >
                  {preset.name}
                </Chip>
              );
            })}
          </ChipRow>
        </div>
      ) : null}

      {/* Cidade escolhida + mapa */}
      <AnimatePresence initial={false}>
        {city ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: EASE_BRAND }}
            className="overflow-hidden"
          >
            <div className="glass overflow-hidden">
              <div className="flex items-center gap-3 p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 text-gold-300">
                  <MapPin className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ivory">
                    {cityLabel(city)}
                  </span>
                  <span className="block truncate text-2xs text-muted">
                    {hasCoordinates(city) ? city.displayName : 'Sem pino no mapa'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onCityChange(null)}
                  className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-onyx-800 hover:text-ivory"
                  aria-label="Remover cidade escolhida"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <LazyCityMap
                city={city}
                zoom={12}
                className={cn('h-52 w-full border-t border-gold-500/15 sm:h-60')}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Field label="Local ou loja (opcional)">
        {({ id }) => (
          <Input
            id={id}
            value={locationDetail}
            onChange={(event) => onLocationDetailChange(event.target.value)}
            placeholder="Ex.: Loja Arapiraca Shopping"
            maxLength={120}
          />
        )}
      </Field>
    </div>
  );
}
