/**
 * Mapa com vários pinos — as ativações aprovadas do painel admin.
 *
 * Mesmas escolhas do `CityMap`: tiles escuros gratuitos e sem chave (ver
 * `tiles.ts`). Carregado com `React.lazy` pelo `LazyActivationsMap`.
 */
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  TILE_ATTRIBUTION,
  TILE_BASE_URL,
  TILE_LABELS_URL,
  TILE_MAX_NATIVE_ZOOM,
  TILE_MAX_ZOOM,
} from './tiles';

/** Centro de Alagoas — usado quando não há nenhum ponto para enquadrar. */
const ALAGOAS: [number, number] = [-9.5713, -36.782];

export interface ActivationPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle: string;
  /** `true` para ações já em campo; muda a cor do pino. */
  active: boolean;
}

function pinIcon(active: boolean) {
  return L.divIcon({
    className: 'am-marker-wrapper',
    html:
      `<div class="am-marker">` +
      (active ? '<span class="am-marker__ring"></span>' : '') +
      `<span class="am-marker__dot"${
        active ? '' : ' style="background:linear-gradient(135deg,#60A5FA,#3B82F6);box-shadow:0 0 10px 1px rgba(96,165,250,0.5)"'
      }></span></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

/** Enquadra todos os pinos assim que a lista muda. */
function FitBounds({ pins }: { pins: ActivationPin[] }) {
  const map = useMap();

  useEffect(() => {
    if (pins.length === 0) {
      map.setView(ALAGOAS, 7);
      return;
    }

    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 10);
      return;
    }

    const bounds = L.latLngBounds(pins.map((pin) => [pin.lat, pin.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
  }, [map, pins]);

  return null;
}

function InvalidateOnResize() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const timer = window.setTimeout(invalidate, 180);
    if (typeof ResizeObserver === 'undefined') return () => window.clearTimeout(timer);

    const observer = new ResizeObserver(invalidate);
    observer.observe(map.getContainer());
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

export interface ActivationsMapProps {
  pins: ActivationPin[];
  className?: string;
}

export default function ActivationsMap({ pins, className }: ActivationsMapProps) {
  const valid = useMemo(
    () =>
      pins.filter(
        (pin) => Number.isFinite(pin.lat) && Number.isFinite(pin.lng) && (pin.lat !== 0 || pin.lng !== 0)
      ),
    [pins]
  );

  return (
    <MapContainer center={ALAGOAS} zoom={7} className={className} scrollWheelZoom={false}>
      <TileLayer
        url={TILE_BASE_URL}
        attribution={TILE_ATTRIBUTION}
        maxZoom={TILE_MAX_ZOOM}
        maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
      />
      <TileLayer url={TILE_LABELS_URL} maxZoom={TILE_MAX_ZOOM} maxNativeZoom={TILE_MAX_NATIVE_ZOOM} />

      {valid.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={pinIcon(pin.active)}>
          <Popup>
            <strong>{pin.title}</strong>
            <br />
            {pin.subtitle}
          </Popup>
        </Marker>
      ))}

      <FitBounds pins={valid} />
      <InvalidateOnResize />
    </MapContainer>
  );
}
