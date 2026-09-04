/**
 * Mapa escuro com o pino dourado da cidade.
 *
 * Tiles gratuitos e sem chave — ver `tiles.ts` para o porquê da escolha. Sem
 * Google Maps: a API deles exige chave paga (seção 14).
 *
 * Este módulo importa o Leaflet e o CSS dele, então é sempre carregado com
 * `React.lazy`: quem não abre o passo da cidade não baixa o mapa.
 */
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CityRef } from '@/shared/types';
import {
  TILE_ATTRIBUTION,
  TILE_BASE_URL,
  TILE_LABELS_URL,
  TILE_MAX_NATIVE_ZOOM,
  TILE_MAX_ZOOM,
} from './tiles';

/** Pino dourado pulsante (estilos em `index.css`, classe `.am-marker`). */
const goldMarker = L.divIcon({
  className: 'am-marker-wrapper',
  html: '<div class="am-marker"><span class="am-marker__ring"></span><span class="am-marker__dot"></span></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/** Move a câmera quando a cidade muda — o `flyTo` da seção 8.3. */
function FlyTo({ lat, lng, zoom, animate }: { lat: number; lng: number; zoom: number; animate: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (animate) map.flyTo([lat, lng], zoom, { duration: 1.1 });
    else map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom, animate]);

  return null;
}

/** O contêiner do mapa muda de tamanho dentro de drawers e do wizard. */
function InvalidateOnResize() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    // Um quadro depois da montagem, quando o layout já assentou.
    const timer = window.setTimeout(invalidate, 180);

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', invalidate);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('resize', invalidate);
      };
    }

    const observer = new ResizeObserver(invalidate);
    observer.observe(map.getContainer());
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

export interface CityMapProps {
  city: Pick<CityRef, 'lat' | 'lng' | 'name'>;
  zoom?: number;
  className?: string;
  /** Mapa decorativo: sem arrastar, sem zoom, sem foco por teclado. */
  static?: boolean;
  animate?: boolean;
}

export default function CityMap({
  city,
  zoom = 12,
  className,
  static: isStatic = false,
  animate = true,
}: CityMapProps) {
  const center = useMemo<[number, number]>(() => [city.lat, city.lng], [city.lat, city.lng]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={className}
      scrollWheelZoom={false}
      dragging={!isStatic}
      zoomControl={!isStatic}
      doubleClickZoom={!isStatic}
      touchZoom={!isStatic}
      keyboard={!isStatic}
      attributionControl
      // Mapas decorativos não devem entrar na ordem de tabulação.
      {...(isStatic ? { tap: false } : {})}
    >
      <TileLayer
        url={TILE_BASE_URL}
        attribution={TILE_ATTRIBUTION}
        maxZoom={TILE_MAX_ZOOM}
        maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
      />
      {/* Nomes de lugares por cima da base. */}
      <TileLayer url={TILE_LABELS_URL} maxZoom={TILE_MAX_ZOOM} maxNativeZoom={TILE_MAX_NATIVE_ZOOM} />
      <Marker position={center} icon={goldMarker} alt={`Localização de ${city.name}`} />
      <FlyTo lat={city.lat} lng={city.lng} zoom={zoom} animate={animate} />
      <InvalidateOnResize />
    </MapContainer>
  );
}
