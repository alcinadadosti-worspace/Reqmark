import { Suspense, lazy } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ActivationsMapProps } from './ActivationsMap';

const ActivationsMap = lazy(() => import('./ActivationsMap'));

export function LazyActivationsMap({ pins, className }: ActivationsMapProps) {
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            'flex items-center justify-center gap-2 border border-gold-500/15 bg-onyx-800/50 text-xs text-muted',
            className
          )}
        >
          <MapPin className="h-4 w-4" aria-hidden />
          Carregando mapa…
        </div>
      }
    >
      <ActivationsMap pins={pins} className={className} />
    </Suspense>
  );
}
