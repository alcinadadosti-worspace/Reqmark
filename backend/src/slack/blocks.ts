/**
 * Mensagens do Slack em Block Kit.
 *
 * A DM da administradora precisa ser decidivel SEM abrir o app: itens com
 * quantidade, finalidade, cidade, periodo e a analise de conflito ja mastigada,
 * mais os tres botoes. O link "Abrir no app" e o caminho alternativo garantido
 * caso o backend esteja dormindo e um clique falhe (secao 9).
 */
import type { KnownBlock } from '@slack/types';
import { ticketUrl } from '../env';
import { describeConflict } from '../lib/conflicts';
import { formatDayCount, formatInstantBR, formatRangeBR } from '../shared/dates';
import type { Conflict } from '../shared/availability';
import type { MarketingRequest, RequestStatus } from '../shared/types';

export const ACTION_APPROVE = 'approve_request';
export const ACTION_REJECT = 'reject_request';
export const ACTION_OPEN_APP = 'open_in_app';
export const VIEW_REJECT = 'reject_request_modal';

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: '🟡 Pendente',
  approved: '✅ Aprovada',
  rejected: '❌ Reprovada',
  cancelled: '🚫 Cancelada',
  returned: '📦 Devolvida',
};

export function ticketNumber(value: number): string {
  return `#${String(value).padStart(4, '0')}`;
}

/** Lista de itens com quantidade, uma por linha. */
function itemLines(request: MarketingRequest): string {
  return request.items.map((line) => `• ${line.quantity}× ${line.itemName}`).join('\n') || '—';
}

function cityLine(request: MarketingRequest): string {
  const city = request.city.state ? `${request.city.name}/${request.city.state}` : request.city.name;
  return request.locationDetail ? `${city} — ${request.locationDetail}` : city || '—';
}

function periodLine(request: MarketingRequest): string {
  return `${formatRangeBR(request.startDate, request.endDate)} (${formatDayCount(request.days)})`;
}

/** Seção "Conflitos": nenhum ✅ ou os detalhes ⚠️. */
function conflictBlock(blocking: Conflict[], warnings: Conflict[]): KnownBlock {
  if (blocking.length === 0 && warnings.length === 0) {
    return {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Conflitos*\n✅ Nenhum — todos os itens estão livres no período.' },
    };
  }

  const lines: string[] = [];
  for (const conflict of blocking) lines.push(`🔴 ${describeConflict(conflict)}`);
  for (const conflict of warnings) lines.push(`🟡 ${describeConflict(conflict)}`);

  return {
    type: 'section',
    text: { type: 'mrkdwn', text: `*Conflitos*\n${lines.join('\n')}` },
  };
}

export interface AdminCardOptions {
  request: MarketingRequest;
  blocking: Conflict[];
  warnings: Conflict[];
}

/** Card da DM da administradora, com os botões de decisão. */
export function adminRequestBlocks({ request, blocking, warnings }: AdminCardOptions): KnownBlock[] {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🟡 Nova requisição ${ticketNumber(request.number)}`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Solicitante*\n${request.requesterName}` },
        { type: 'mrkdwn', text: `*Tipo*\n${request.purposeType}` },
        { type: 'mrkdwn', text: `*Cidade*\n${cityLine(request)}` },
        { type: 'mrkdwn', text: `*Período*\n${periodLine(request)}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Itens*\n${itemLines(request)}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Para que vai usar*\n${request.purpose}` },
    },
    conflictBlock(blocking, warnings),
    {
      type: 'actions',
      block_id: `decision_${request.id}`,
      elements: [
        {
          type: 'button',
          action_id: ACTION_APPROVE,
          style: 'primary',
          text: { type: 'plain_text', text: '✅ Aprovar', emoji: true },
          value: request.id,
          ...(blocking.length > 0
            ? {
                confirm: {
                  title: { type: 'plain_text' as const, text: 'Aprovar mesmo com conflito?' },
                  text: {
                    type: 'mrkdwn' as const,
                    text: blocking.map(describeConflict).join('\n'),
                  },
                  confirm: { type: 'plain_text' as const, text: 'Aprovar assim mesmo' },
                  deny: { type: 'plain_text' as const, text: 'Cancelar' },
                  style: 'danger' as const,
                },
              }
            : {}),
        },
        {
          type: 'button',
          action_id: ACTION_REJECT,
          style: 'danger',
          text: { type: 'plain_text', text: '❌ Reprovar', emoji: true },
          value: request.id,
        },
        {
          type: 'button',
          action_id: ACTION_OPEN_APP,
          text: { type: 'plain_text', text: '🔗 Abrir no app', emoji: true },
          url: ticketUrl(request.id),
          value: request.id,
        },
      ],
    },
  ];
}

export interface DecidedCardOptions {
  request: MarketingRequest;
  status: RequestStatus;
  byName: string;
  at: Date;
  note?: string;
}

/**
 * Substitui o card original depois da decisão: sem botões, com quem decidiu e
 * quando. É o `chat.update` da seção 9.
 */
export function decidedBlocks({ request, status, byName, at, note }: DecidedCardOptions): KnownBlock[] {
  const time = formatInstantBR(at);
  const verb =
    status === 'approved'
      ? 'Aprovada'
      : status === 'rejected'
        ? 'Reprovada'
        : status === 'cancelled'
          ? 'Cancelada'
          : status === 'returned'
            ? 'Devolvida'
            : 'Atualizada';

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${STATUS_LABEL[status]} — ${ticketNumber(request.number)}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Solicitante*\n${request.requesterName}` },
        { type: 'mrkdwn', text: `*Cidade*\n${cityLine(request)}` },
        { type: 'mrkdwn', text: `*Período*\n${periodLine(request)}` },
        { type: 'mrkdwn', text: `*Itens*\n${request.items.length} tipo(s)` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Itens*\n${itemLines(request)}` },
    },
  ];

  if (note) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Observação*\n${note}` },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text:
          status === 'cancelled'
            ? `🚫 Cancelada pelo solicitante às ${time}`
            : `${verb} por ${byName} às ${time}`,
      },
    ],
  });

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        action_id: ACTION_OPEN_APP,
        text: { type: 'plain_text', text: '🔗 Abrir no app', emoji: true },
        url: ticketUrl(request.id),
        value: request.id,
      },
    ],
  });

  return blocks;
}

/** Modal do motivo da reprovação (`views.open`). */
export function rejectModal(requestId: string, request: MarketingRequest) {
  return {
    type: 'modal' as const,
    callback_id: VIEW_REJECT,
    private_metadata: requestId,
    title: { type: 'plain_text' as const, text: `Reprovar ${ticketNumber(request.number)}` },
    submit: { type: 'plain_text' as const, text: 'Reprovar' },
    close: { type: 'plain_text' as const, text: 'Cancelar' },
    blocks: [
      {
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `*${request.requesterName}* — ${cityLine(request)}\n${periodLine(request)}`,
        },
      },
      {
        type: 'input' as const,
        block_id: 'reason_block',
        label: { type: 'plain_text' as const, text: 'Motivo da reprovação' },
        hint: {
          type: 'plain_text' as const,
          text: 'O solicitante recebe este texto no app e por DM. Explique para ele poder ajustar e pedir de novo.',
        },
        element: {
          type: 'plain_text_input' as const,
          action_id: 'reason',
          multiline: true,
          max_length: 400,
          placeholder: {
            type: 'plain_text' as const,
            text: 'Ex.: a tenda já está reservada para a ação de Arapiraca nesse fim de semana.',
          },
        },
      },
    ],
  };
}

/** DM curta ao solicitante confirmando o recebimento. */
export function receiptBlocks(request: MarketingRequest): KnownBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `*Recebi sua requisição ${ticketNumber(request.number)}* 🟡\n` +
          `${itemLines(request)}\n\n` +
          `*Onde:* ${cityLine(request)}\n*Quando:* ${periodLine(request)}\n\n` +
          'A Suzana já foi avisada. Aviso você aqui assim que ela decidir.',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: ACTION_OPEN_APP,
          text: { type: 'plain_text', text: '🔗 Acompanhar no app', emoji: true },
          url: ticketUrl(request.id),
          value: request.id,
        },
      ],
    },
  ];
}

/** DM ao solicitante com a decisão. */
export function decisionForRequesterBlocks(
  request: MarketingRequest,
  status: RequestStatus,
  byName: string,
  note?: string
): KnownBlock[] {
  const headline =
    status === 'approved'
      ? `✅ *Sua requisição ${ticketNumber(request.number)} foi aprovada!*`
      : `❌ *Sua requisição ${ticketNumber(request.number)} foi reprovada.*`;

  const body =
    status === 'approved'
      ? `Os itens estão reservados para você:\n${itemLines(request)}\n\n` +
        `*Onde:* ${cityLine(request)}\n*Quando:* ${periodLine(request)}`
      : note
        ? `*Motivo:* ${note}`
        : 'Abra o ticket para conversar com a Suzana sobre os próximos passos.';

  return [
    { type: 'section', text: { type: 'mrkdwn', text: `${headline}\n\n${body}` } },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Decidido por ${byName}` }],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: ACTION_OPEN_APP,
          text: { type: 'plain_text', text: '🔗 Abrir no app', emoji: true },
          url: ticketUrl(request.id),
          value: request.id,
        },
      ],
    },
  ];
}

/** DM ao solicitante quando o item é marcado como devolvido. */
export function returnedBlocks(request: MarketingRequest): KnownBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `📦 *${ticketNumber(request.number)} marcada como devolvida.*\n` +
          'Obrigado! Os itens já voltaram a ficar livres para o resto da equipe.',
      },
    },
  ];
}

/** Mensagem de chat encaminhada ao Slack. */
export function messageBlocks(
  request: MarketingRequest,
  authorName: string,
  text: string
): KnownBlock[] {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `💬 *${authorName}* — ${ticketNumber(request.number)}\n>${text.replace(/\n/g, '\n>')}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: ACTION_OPEN_APP,
          text: { type: 'plain_text', text: '🔗 Responder no app', emoji: true },
          url: ticketUrl(request.id),
          value: request.id,
        },
      ],
    },
  ];
}

/** Texto de fallback: é o que aparece na notificação do celular. */
export function fallbackText(request: MarketingRequest, prefix: string): string {
  return `${prefix} ${ticketNumber(request.number)} — ${request.requesterName}, ${cityLine(
    request
  )}, ${periodLine(request)}`;
}
