import { AlertTriangle, CalendarRange, MapPin, Sparkles, Target } from 'lucide-react';
import { ItemIcon } from '@/components/icons/ItemIcon';
import { LazyCityMap } from '@/components/map/LazyCityMap';
import { DataLabel, Rule } from '@/components/ui/Surface';
import { Pill } from '@/components/ui/StatusChip';
import { describeConflict } from '@/lib/availability';
import { formatDayCount, formatDayFriendly } from '@/lib/dates';
import { cityLabel } from '@/lib/geocode';
import { daysBetweenInclusive } from '@/shared/dates';
import type { Conflict } from '@/shared/availability';
import type { CityRef, DayString, Item } from '@/shared/types';

export interface StepReviewProps {
  lines: { item: Item; quantity: number }[];
  purposeType: string;
  purpose: string;
  city: CityRef;
  locationDetail: string;
  startDate: DayString;
  endDate: DayString;
  warnings: Conflict[];
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold-500/18 bg-gold-500/6 text-gold-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <DataLabel>{label}</DataLabel>
        <div className="mt-1 text-sm leading-relaxed text-ivory">{children}</div>
      </div>
    </div>
  );
}

/** Passo 5 — Revisão. Última chance de conferir antes de enviar. */
export function StepReview({
  lines,
  purposeType,
  purpose,
  city,
  locationDetail,
  startDate,
  endDate,
  warnings,
}: StepReviewProps) {
  const days = daysBetweenInclusive(startDate, endDate);

  return (
    <div className="space-y-5">
      {/* Aviso de pré-reservas concorrentes */}
      {warnings.length > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-gold-500/35 bg-gold-500/8 p-3.5">
          <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-gold-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gold-200">Alguém pediu o mesmo item</p>
            <p className="mt-1 text-xs leading-relaxed text-ivory/80">
              {warnings.map(describeConflict).join(' ')} Pode enviar mesmo assim — quem decide é a
              Suzana, e ela vê os dois pedidos lado a lado.
            </p>
          </div>
        </div>
      ) : null}

      <div className="glass space-y-5 p-5">
        <Row icon={<Sparkles className="h-4 w-4" aria-hidden />} label="Itens">
          <ul className="space-y-2">
            {lines.map(({ item, quantity }) => (
              <li key={item.id} className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gold-500/18 bg-onyx-800/60 text-gold-300">
                  <ItemIcon name={item.icon} emoji={item.emoji} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="tabular shrink-0 text-sm text-gold-300">{quantity}×</span>
              </li>
            ))}
          </ul>
        </Row>

        <Rule />

        <Row icon={<Target className="h-4 w-4" aria-hidden />} label="Finalidade">
          <Pill tone="gold" className="mb-2">
            {purposeType}
          </Pill>
          <p className="whitespace-pre-line text-muted">{purpose}</p>
        </Row>

        <Rule />

        <Row icon={<MapPin className="h-4 w-4" aria-hidden />} label="Onde">
          <p>{cityLabel(city)}</p>
          {locationDetail ? <p className="text-muted">{locationDetail}</p> : null}
        </Row>

        <LazyCityMap
          city={city}
          zoom={11}
          static
          animate={false}
          className="h-36 w-full overflow-hidden rounded-2xl border border-gold-500/15"
        />

        <Rule />

        <Row icon={<CalendarRange className="h-4 w-4" aria-hidden />} label="Quando">
          <p>
            {startDate === endDate
              ? formatDayFriendly(startDate)
              : `${formatDayFriendly(startDate)} até ${formatDayFriendly(endDate)}`}
          </p>
          <p className="tabular text-muted">{formatDayCount(days)}</p>
        </Row>
      </div>

      <p className="px-1 text-2xs leading-relaxed text-muted/80">
        Ao enviar, a Suzana recebe um aviso no Slack na hora e você acompanha a resposta aqui no app
        e também no seu Slack.
      </p>
    </div>
  );
}
