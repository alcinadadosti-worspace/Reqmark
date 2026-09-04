import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { GlassCard, SectionTitle } from '@/components/ui/Surface';
import { Chip, ChipWrap } from '@/components/ui/Chip';
import { ApiError, api } from '@/lib/api';
import { searchCities, type CityResult } from '@/lib/geocode';
import type { AppSettings, CityPreset } from '@/shared/types';

export interface AdminSettingsProps {
  settings: AppSettings;
}

/**
 * Configurações (seção 8.6): cidades frequentes e tipos de finalidade.
 *
 * As cidades passam pelo geocoder na hora de adicionar, para já entrarem com
 * latitude e longitude — sem isso o mapa do wizard ficaria sem pino.
 */
export function AdminSettings({ settings }: AdminSettingsProps) {
  const [cities, setCities] = useState<CityPreset[]>(settings.cities);
  const [purposeTypes, setPurposeTypes] = useState<string[]>(settings.purposeTypes);
  const [saving, setSaving] = useState(false);

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [newType, setNewType] = useState('');
  const abortRef = useRef<AbortController>();

  // Reflete mudanças vindas do Firestore (outra aba, outro dispositivo).
  useEffect(() => setCities(settings.cities), [settings.cities]);
  useEffect(() => setPurposeTypes(settings.purposeTypes), [settings.purposeTypes]);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const { cities: found } = await searchCities(query, controller.signal);
      if (controller.signal.aborted) return;

      setResults(found);
      setSearching(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const save = async (next: { cities?: CityPreset[]; purposeTypes?: string[] }) => {
    setSaving(true);
    try {
      await api.updateSettings(next);
      toast.success('Configurações salvas');
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : 'Não consegui salvar.');
      // Volta ao que está no Firestore para a tela não mentir.
      setCities(settings.cities);
      setPurposeTypes(settings.purposeTypes);
    } finally {
      setSaving(false);
    }
  };

  const addCity = (city: CityResult) => {
    const exists = cities.some(
      (entry) => entry.name === city.name && entry.state === city.state
    );
    if (exists) {
      toast.info('Essa cidade já está na lista');
      return;
    }

    const next = [...cities, { name: city.name, state: city.state, lat: city.lat, lng: city.lng }];
    setCities(next);
    setTerm('');
    setResults([]);
    void save({ cities: next });
  };

  const removeCity = (index: number) => {
    const next = cities.filter((_, position) => position !== index);
    setCities(next);
    void save({ cities: next });
  };

  const addType = () => {
    const value = newType.trim();
    if (!value) return;
    if (purposeTypes.includes(value)) {
      toast.info('Esse tipo já existe');
      return;
    }

    const next = [...purposeTypes, value];
    setPurposeTypes(next);
    setNewType('');
    void save({ purposeTypes: next });
  };

  const removeType = (type: string) => {
    if (purposeTypes.length <= 1) {
      toast.error('Deixe pelo menos um tipo de finalidade.');
      return;
    }
    const next = purposeTypes.filter((entry) => entry !== type);
    setPurposeTypes(next);
    void save({ purposeTypes: next });
  };

  return (
    <div className="space-y-5">
      <GlassCard className="p-5">
        <SectionTitle
          action={saving ? <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden /> : null}
        >
          Cidades frequentes
        </SectionTitle>

        <p className="mb-4 text-sm text-muted">
          Aparecem como atalho no passo da cidade. As coordenadas vêm do geocoder na hora de
          adicionar.
        </p>

        <ul className="mb-4 space-y-2">
          {cities.map((city, index) => (
            <li
              key={`${city.name}-${city.state}`}
              className="flex items-center gap-3 rounded-xl border border-onyx-700 bg-onyx-900/50 px-3.5 py-2.5"
            >
              <MapPin className="h-4 w-4 shrink-0 text-gold-400/80" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ivory">
                  {city.name}
                  {city.state ? `/${city.state}` : ''}
                </span>
                <span className="tabular block text-2xs text-muted">
                  {city.lat.toFixed(4)}, {city.lng.toFixed(4)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeCity(index)}
                className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-status-rejected/10 hover:text-status-rejected"
                aria-label={`Remover ${city.name}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}

          {cities.length === 0 ? (
            <li className="rounded-xl border border-dashed border-onyx-700 px-3 py-4 text-center text-xs text-muted">
              Nenhuma cidade frequente cadastrada.
            </li>
          ) : null}
        </ul>

        <Field label="Adicionar cidade">
          {({ id }) => (
            <Input
              id={id}
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar cidade no mapa…"
              autoComplete="off"
              leading={<Search className="h-4 w-4" aria-hidden />}
              trailing={searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            />
          )}
        </Field>

        {results.length > 0 ? (
          <ul className="mt-2 divide-y divide-onyx-700/60 overflow-hidden rounded-xl border border-gold-500/20">
            {results.map((city) => (
              <li key={`${city.name}-${city.lat}`}>
                <button
                  type="button"
                  onClick={() => addCity(city)}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-onyx-800/70"
                >
                  <Plus className="h-4 w-4 shrink-0 text-gold-400/80" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ivory">{city.name}</span>
                    <span className="block truncate text-2xs text-muted">{city.displayName}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </GlassCard>

      <GlassCard className="p-5">
        <SectionTitle>Tipos de finalidade</SectionTitle>

        <p className="mb-4 text-sm text-muted">
          São os chips do passo “Finalidade”. Toque em um tipo para removê-lo.
        </p>

        <ChipWrap className="mb-4">
          {purposeTypes.map((type) => (
            <Chip key={type} toggle={false} onClick={() => removeType(type)} icon={<Trash2 className="h-3.5 w-3.5" />}>
              {type}
            </Chip>
          ))}
        </ChipWrap>

        <div className="flex gap-2">
          <Input
            value={newType}
            onChange={(event) => setNewType(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addType();
              }
            }}
            placeholder="Novo tipo de ação"
            aria-label="Novo tipo de finalidade"
            maxLength={40}
          />
          <Button variant="secondary" onClick={addType} disabled={!newType.trim()}>
            Adicionar
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
