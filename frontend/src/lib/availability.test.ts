/**
 * Testes do motor de disponibilidade (seção 7 da especificação).
 *
 * Cobrem os cinco casos exigidos: sobreposição de intervalos, múltiplos itens,
 * quantidades parciais, devolução antecipada e pendentes que não bloqueiam.
 */
import { describe, expect, it } from 'vitest';
import {
  availabilityOn,
  buildOccupancy,
  dayStatesForWindow,
  effectiveRange,
  evaluatePeriod,
  findNextFreeWindow,
  groupConsecutiveDays,
  itemSchedule,
  nextReturnAfter,
  type OccupancySource,
  type StockItemRef,
} from '@/shared/availability';
import { daysBetweenInclusive, eachDay } from '@/shared/dates';
import type { RequestStatus } from '@/shared/types';

// --- Apoio ----------------------------------------------------------------

const TENDA: StockItemRef = { id: 'tenda', name: 'Tenda 3x3', quantity: 2 };
const MESA: StockItemRef = { id: 'mesa', name: 'Mesa dobrável', quantity: 6 };
const CADEIRA: StockItemRef = { id: 'cadeira', name: 'Cadeira', quantity: 30 };

const STOCK = new Map<string, StockItemRef>([
  [TENDA.id, TENDA],
  [MESA.id, MESA],
  [CADEIRA.id, CADEIRA],
]);

let sequence = 0;

function makeRequest(
  overrides: Partial<OccupancySource> & Pick<OccupancySource, 'startDate' | 'endDate' | 'items'>
): OccupancySource {
  sequence += 1;
  return {
    id: `req-${sequence}`,
    number: sequence,
    status: 'approved' as RequestStatus,
    requesterId: 'U1',
    requesterName: 'Rafaela Alves Mendes',
    city: { name: 'Penedo', state: 'AL' },
    ...overrides,
  };
}

/** Atalho: disponibilidade de um item num dia. */
function availableOn(requests: OccupancySource[], item: StockItemRef, day: string): number {
  return availabilityOn(item, buildOccupancy(requests), day).available;
}

// --- Sobreposição de intervalos -------------------------------------------

describe('sobreposição de intervalos', () => {
  const approved = makeRequest({
    startDate: '2026-09-09',
    endDate: '2026-09-11',
    items: [{ itemId: 'tenda', quantity: 1 }],
  });

  it('ocupa todos os dias do período, inclusive as pontas', () => {
    expect(availableOn([approved], TENDA, '2026-09-09')).toBe(1);
    expect(availableOn([approved], TENDA, '2026-09-10')).toBe(1);
    expect(availableOn([approved], TENDA, '2026-09-11')).toBe(1);
  });

  it('não ocupa o dia anterior nem o seguinte', () => {
    expect(availableOn([approved], TENDA, '2026-09-08')).toBe(2);
    expect(availableOn([approved], TENDA, '2026-09-12')).toBe(2);
  });

  it('soma requisições que se sobrepõem parcialmente', () => {
    const outra = makeRequest({
      startDate: '2026-09-10',
      endDate: '2026-09-14',
      items: [{ itemId: 'tenda', quantity: 1 }],
    });

    // 09: só a primeira. 10 e 11: as duas (esgota). 12: só a segunda.
    expect(availableOn([approved, outra], TENDA, '2026-09-09')).toBe(1);
    expect(availableOn([approved, outra], TENDA, '2026-09-10')).toBe(0);
    expect(availableOn([approved, outra], TENDA, '2026-09-11')).toBe(0);
    expect(availableOn([approved, outra], TENDA, '2026-09-12')).toBe(1);
  });

  it('bloqueia um período que encosta no trecho lotado', () => {
    const outra = makeRequest({
      startDate: '2026-09-10',
      endDate: '2026-09-14',
      items: [{ itemId: 'tenda', quantity: 1 }],
    });

    const evaluation = evaluatePeriod({
      selection: [{ itemId: 'tenda', quantity: 1 }],
      items: STOCK,
      index: buildOccupancy([approved, outra]),
      startDate: '2026-09-08',
      endDate: '2026-09-12',
    });

    expect(evaluation.ok).toBe(false);
    expect(evaluation.blocking).toHaveLength(1);
    expect(evaluation.blocking[0].itemName).toBe('Tenda 3x3');
    expect(evaluation.blocking[0].days).toEqual(['2026-09-10', '2026-09-11']);
    expect(evaluation.byDay.get('2026-09-08')).toBe('free');
    expect(evaluation.byDay.get('2026-09-10')).toBe('blocked');
    expect(evaluation.byDay.get('2026-09-12')).toBe('free');
  });
});

// --- Múltiplos itens -------------------------------------------------------

describe('múltiplos itens', () => {
  const kit = makeRequest({
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    items: [
      { itemId: 'tenda', quantity: 2 },
      { itemId: 'mesa', quantity: 4 },
    ],
  });

  it('cada item é contado separadamente', () => {
    const index = buildOccupancy([kit]);
    expect(availabilityOn(TENDA, index, '2026-10-02').available).toBe(0);
    expect(availabilityOn(MESA, index, '2026-10-02').available).toBe(2);
    expect(availabilityOn(CADEIRA, index, '2026-10-02').available).toBe(30);
  });

  it('um único item indisponível reprova o kit inteiro', () => {
    const evaluation = evaluatePeriod({
      selection: [
        { itemId: 'tenda', quantity: 1 },
        { itemId: 'mesa', quantity: 2 },
        { itemId: 'cadeira', quantity: 10 },
      ],
      items: STOCK,
      index: buildOccupancy([kit]),
      startDate: '2026-10-02',
      endDate: '2026-10-02',
    });

    expect(evaluation.ok).toBe(false);
    // Só a tenda estourou: mesa (2 livres) e cadeira (30) cabem.
    expect(evaluation.blocking.map((conflict) => conflict.itemId)).toEqual(['tenda']);
  });

  it('aprova quando todos os itens cabem', () => {
    const evaluation = evaluatePeriod({
      selection: [
        { itemId: 'mesa', quantity: 2 },
        { itemId: 'cadeira', quantity: 30 },
      ],
      items: STOCK,
      index: buildOccupancy([kit]),
      startDate: '2026-10-01',
      endDate: '2026-10-03',
    });

    expect(evaluation.ok).toBe(true);
    expect(evaluation.blocking).toHaveLength(0);
  });
});

// --- Quantidades parciais --------------------------------------------------

describe('quantidades parciais', () => {
  const parcial = makeRequest({
    startDate: '2026-11-05',
    endDate: '2026-11-07',
    items: [{ itemId: 'mesa', quantity: 4 }],
  });

  it('libera o que sobra do estoque', () => {
    expect(availableOn([parcial], MESA, '2026-11-06')).toBe(2);
  });

  it('aceita um pedido que cabe no resto', () => {
    const evaluation = evaluatePeriod({
      selection: [{ itemId: 'mesa', quantity: 2 }],
      items: STOCK,
      index: buildOccupancy([parcial]),
      startDate: '2026-11-05',
      endDate: '2026-11-07',
    });
    expect(evaluation.ok).toBe(true);
  });

  it('recusa um pedido de uma unidade a mais do que sobra', () => {
    const evaluation = evaluatePeriod({
      selection: [{ itemId: 'mesa', quantity: 3 }],
      items: STOCK,
      index: buildOccupancy([parcial]),
      startDate: '2026-11-05',
      endDate: '2026-11-07',
    });

    expect(evaluation.ok).toBe(false);
    expect(evaluation.blocking[0].minAvailable).toBe(2);
    expect(evaluation.blocking[0].requested).toBe(3);
    expect(evaluation.blocking[0].days).toHaveLength(3);
  });

  it('soma quantidades de várias requisições sobre o mesmo item', () => {
    const outra = makeRequest({
      startDate: '2026-11-06',
      endDate: '2026-11-06',
      items: [{ itemId: 'mesa', quantity: 2 }],
    });
    expect(availableOn([parcial, outra], MESA, '2026-11-06')).toBe(0);
    expect(availableOn([parcial, outra], MESA, '2026-11-07')).toBe(2);
  });
});

// --- Devolução antecipada --------------------------------------------------

describe('devolução antecipada', () => {
  const devolvida = makeRequest({
    status: 'returned',
    startDate: '2026-09-09',
    endDate: '2026-09-20',
    returnedOn: '2026-09-12',
    items: [{ itemId: 'tenda', quantity: 2 }],
  });

  it('ocupa até a véspera da devolução', () => {
    expect(effectiveRange(devolvida)).toEqual({ start: '2026-09-09', end: '2026-09-11' });
  });

  it('libera o item a partir do dia da devolução', () => {
    expect(availableOn([devolvida], TENDA, '2026-09-11')).toBe(0);
    expect(availableOn([devolvida], TENDA, '2026-09-12')).toBe(2);
    expect(availableOn([devolvida], TENDA, '2026-09-20')).toBe(2);
  });

  it('não ocupa nada quando é devolvida no próprio dia em que começaria', () => {
    const mesmoDia = makeRequest({
      status: 'returned',
      startDate: '2026-09-09',
      endDate: '2026-09-20',
      returnedOn: '2026-09-09',
      items: [{ itemId: 'tenda', quantity: 2 }],
    });

    expect(effectiveRange(mesmoDia)).toBeNull();
    expect(availableOn([mesmoDia], TENDA, '2026-09-09')).toBe(2);
  });

  it('libera tudo quando não há data de devolução registrada', () => {
    const semData = makeRequest({
      status: 'returned',
      startDate: '2026-09-09',
      endDate: '2026-09-20',
      items: [{ itemId: 'tenda', quantity: 2 }],
    });

    expect(effectiveRange(semData)).toBeNull();
    expect(availableOn([semData], TENDA, '2026-09-15')).toBe(2);
  });
});

// --- Pendentes não bloqueiam ----------------------------------------------

describe('pendentes não bloqueiam', () => {
  const pendente = makeRequest({
    status: 'pending',
    requesterName: 'Erick Café Santos Júnior',
    startDate: '2026-12-01',
    endDate: '2026-12-03',
    items: [{ itemId: 'tenda', quantity: 2 }],
  });

  it('não reduz a disponibilidade real', () => {
    const index = buildOccupancy([pendente]);
    const snapshot = availabilityOn(TENDA, index, '2026-12-02');

    expect(snapshot.available).toBe(2);
    expect(snapshot.pending).toBe(2);
    expect(snapshot.availableIfPendingApproved).toBe(0);
  });

  it('vira aviso, não bloqueio', () => {
    const evaluation = evaluatePeriod({
      selection: [{ itemId: 'tenda', quantity: 1 }],
      items: STOCK,
      index: buildOccupancy([pendente]),
      startDate: '2026-12-01',
      endDate: '2026-12-03',
    });

    expect(evaluation.ok).toBe(true);
    expect(evaluation.blocking).toHaveLength(0);
    expect(evaluation.warnings).toHaveLength(1);
    expect(evaluation.warnings[0].holders[0].requesterName).toBe('Erick Café Santos Júnior');
    expect(evaluation.byDay.get('2026-12-02')).toBe('pending');
  });

  it('bloqueio tem prioridade sobre pré-reserva no mesmo dia', () => {
    const aprovada = makeRequest({
      startDate: '2026-12-02',
      endDate: '2026-12-02',
      items: [{ itemId: 'tenda', quantity: 2 }],
    });

    const evaluation = evaluatePeriod({
      selection: [{ itemId: 'tenda', quantity: 1 }],
      items: STOCK,
      index: buildOccupancy([pendente, aprovada]),
      startDate: '2026-12-01',
      endDate: '2026-12-03',
    });

    expect(evaluation.byDay.get('2026-12-01')).toBe('pending');
    expect(evaluation.byDay.get('2026-12-02')).toBe('blocked');
  });

  it('reprovadas e canceladas são ignoradas por completo', () => {
    const reprovada = makeRequest({
      status: 'rejected',
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      items: [{ itemId: 'tenda', quantity: 2 }],
    });
    const cancelada = makeRequest({
      status: 'cancelled',
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      items: [{ itemId: 'tenda', quantity: 2 }],
    });

    const index = buildOccupancy([reprovada, cancelada]);
    const snapshot = availabilityOn(TENDA, index, '2026-12-02');

    expect(snapshot.available).toBe(2);
    expect(snapshot.pending).toBe(0);
  });
});

// --- Utilitários -----------------------------------------------------------

describe('utilitários de apoio', () => {
  it('ignora a própria requisição ao reavaliar', () => {
    const minha = makeRequest({
      startDate: '2027-01-10',
      endDate: '2027-01-12',
      items: [{ itemId: 'tenda', quantity: 2 }],
    });

    const semExcluir = buildOccupancy([minha]);
    const excluindo = buildOccupancy([minha], { excludeRequestId: minha.id });

    expect(availabilityOn(TENDA, semExcluir, '2027-01-11').available).toBe(0);
    expect(availabilityOn(TENDA, excluindo, '2027-01-11').available).toBe(2);
  });

  it('agrupa dias soltos em intervalos contínuos', () => {
    expect(
      groupConsecutiveDays(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-07', '2026-09-08'])
    ).toEqual([
      { start: '2026-09-01', end: '2026-09-03' },
      { start: '2026-09-07', end: '2026-09-08' },
    ]);

    expect(groupConsecutiveDays([])).toEqual([]);
    expect(groupConsecutiveDays(['2026-09-05'])).toEqual([
      { start: '2026-09-05', end: '2026-09-05' },
    ]);
  });

  it('conta dias de forma inclusiva', () => {
    expect(daysBetweenInclusive('2026-09-09', '2026-09-09')).toBe(1);
    expect(daysBetweenInclusive('2026-09-09', '2026-09-11')).toBe(3);
    // Atravessa a virada do mês e do ano.
    expect(daysBetweenInclusive('2026-12-30', '2027-01-02')).toBe(4);
    expect(eachDay('2026-12-31', '2027-01-01')).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('encontra a próxima janela livre depois de um período lotado', () => {
    const lotado = makeRequest({
      startDate: '2027-02-01',
      endDate: '2027-02-05',
      items: [{ itemId: 'tenda', quantity: 2 }],
    });

    const janela = findNextFreeWindow({
      selection: [{ itemId: 'tenda', quantity: 2 }],
      items: STOCK,
      index: buildOccupancy([lotado]),
      from: '2027-02-01',
      durationDays: 2,
    });

    expect(janela).toEqual({ start: '2027-02-06', end: '2027-02-07' });
  });

  it('monta as barras da agenda recortadas pela janela visível', () => {
    const longa = makeRequest({
      startDate: '2027-03-25',
      endDate: '2027-04-05',
      items: [{ itemId: 'tenda', quantity: 1 }],
    });

    const barras = itemSchedule('tenda', buildOccupancy([longa]), '2027-04-01', '2027-04-30');

    expect(barras).toHaveLength(1);
    expect(barras[0].start).toBe('2027-03-25');
    expect(barras[0].visibleStart).toBe('2027-04-01');
    expect(barras[0].visibleEnd).toBe('2027-04-05');
  });

  it('aponta a próxima devolução de um item em uso', () => {
    const curta = makeRequest({
      startDate: '2027-05-01',
      endDate: '2027-05-03',
      items: [{ itemId: 'tenda', quantity: 1 }],
    });
    const longa = makeRequest({
      startDate: '2027-05-01',
      endDate: '2027-05-10',
      items: [{ itemId: 'tenda', quantity: 1 }],
    });

    const holder = nextReturnAfter('tenda', buildOccupancy([longa, curta]), '2027-05-02');
    expect(holder?.endDate).toBe('2027-05-03');
  });

  it('pinta a janela do calendário dia a dia', () => {
    const aprovada = makeRequest({
      startDate: '2027-06-10',
      endDate: '2027-06-11',
      items: [{ itemId: 'tenda', quantity: 2 }],
    });

    const estados = dayStatesForWindow({
      selection: [{ itemId: 'tenda', quantity: 1 }],
      items: STOCK,
      index: buildOccupancy([aprovada]),
      from: '2027-06-09',
      to: '2027-06-12',
    });

    expect([...estados.values()]).toEqual(['free', 'blocked', 'blocked', 'free']);
  });

  it('ignora itens que não existem mais no catálogo', () => {
    const evaluation = evaluatePeriod({
      selection: [{ itemId: 'fantasma', quantity: 3 }],
      items: STOCK,
      index: buildOccupancy([]),
      startDate: '2027-07-01',
      endDate: '2027-07-02',
    });

    expect(evaluation.ok).toBe(true);
    expect(evaluation.blocking).toHaveLength(0);
  });
});
