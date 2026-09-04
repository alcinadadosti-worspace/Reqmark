import { Suspense, lazy } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import { hasCoordinates } from '@/lib/geocode';
import type { CityMapProps } from './CityMap';

/** Leaflet + tiles só chegam ao navegador de quem realmente vê um mapa. */
const CityMap = lazy(() => import('./CityMap'));

function MapPlaceholder({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 border border-gold-500/15 bg-onyx-800/50 text-xs text-muted',
        className
      )}
    >
      <MapPin className="h-4 w-4" aria-hidden />
      {label ?? 'Carregando mapa…'}
    </div>
  );
}

/**
 * Envelope seguro do mapa: quando a cidade veio digitada à mão (o geocoder
 * falhou), não há coordenadas — em vez de plotar o ponto (0, 0) no Golfo da
 * Guiné, mostramos um aviso honesto.
 */
export function LazyCityMap({ city, className, ...rest }: CityMapProps) {
  if (!hasCoordinates(city)) {
    return <MapPlaceholder className={className} label="Sem localização no mapa" />;
  }

  return (
    <Suspense fallback={<MapPlaceholder className={className} />}>
      <CityMap city={city} className={className} {...rest} />
    </Suspense>
  );
}
