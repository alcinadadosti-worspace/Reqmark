/**
 * Rotas privilegiadas `/admin/*`.
 *
 * Todas exigem `Authorization: Bearer <token>`, exceto `/admin/login`, que
 * troca o PIN pelo token. Sao o unico caminho para mudar `status`, mexer no
 * catalogo e nas configuracoes — as `firestore.rules` bloqueiam o cliente.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { env } from '../env';
import { FieldValue, collections, serverTimestamp } from '../firebase';
import { checkLoginRate, clearLoginRate, issueToken, verifyPin, verifyToken } from '../lib/adminAuth';
import { createLogger, describeError } from '../lib/logger';
import { getUser } from '../lib/repo';
import { DecisionError, decideRequest, markReturned, sendAdminMessage } from '../services/decisions';

const log = createLogger('admin');

/** Identidade da administradora anexada pelo middleware. */
interface AdminRequest extends Request {
  admin?: { slackId: string; name: string };
}

function fail(response: Response, status: number, code: string, message: string, details?: unknown) {
  response.status(status).json({ error: code, message, ...(details ? { details } : {}) });
}

/**
 * Lê um parâmetro de rota como string.
 * O Express 5 tipa `params` como `string | string[]` (por causa dos padrões
 * com `*`); as nossas rotas só usam `:id`, então normalizamos aqui.
 */
function param(request: Request, name: string): string {
  const value = (request.params as Record<string, string | string[] | undefined>)[name];
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/** Chave do rate limit: o IP visto pelo Render (que fica atrás de proxy). */
function clientKey(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim();
  return request.ip ?? 'desconhecido';
}

function requireAdmin(request: AdminRequest, response: Response, next: NextFunction): void {
  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const payload = verifyToken(token);

  if (!payload) {
    fail(response, 401, 'unauthorized', 'Sessão expirada. Informe o PIN de novo.');
    return;
  }

  request.admin = { slackId: payload.sub, name: payload.name };
  next();
}

/** Envelope que transforma throws em respostas JSON coerentes. */
function handle(fn: (request: AdminRequest, response: Response) => Promise<void>) {
  return async (request: AdminRequest, response: Response): Promise<void> => {
    try {
      await fn(request, response);
    } catch (error) {
      if (error instanceof DecisionError) {
        fail(response, error.status, error.code, error.message, error.details);
        return;
      }
      if (error instanceof z.ZodError) {
        fail(response, 400, 'invalid_payload', 'Dados inválidos.', error.issues);
        return;
      }
      log.error(`erro em ${request.method} ${request.path}`, describeError(error));
      fail(response, 500, 'internal', 'Erro inesperado no servidor.');
    }
  };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const loginSchema = z.object({ pin: z.string().min(4).max(64) });

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(400).optional(),
  force: z.boolean().optional(),
});

const messageSchema = z.object({ text: z.string().trim().min(1).max(800) });

const attributeSchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(160),
});

const itemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(40),
  icon: z.string().trim().min(1).max(40),
  emoji: z.string().trim().max(8).optional(),
  imageUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  description: z.string().trim().max(400).default(''),
  quantity: z.number().int().min(0).max(9999),
  attributes: z.array(attributeSchema).max(20).default([]),
  storageLocation: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  active: z.boolean().default(true),
});

const settingsSchema = z.object({
  cities: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        state: z.string().trim().max(4),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
    )
    .max(60)
    .optional(),
  purposeTypes: z.array(z.string().trim().min(1).max(40)).min(1).max(30).optional(),
  appUrl: z.string().trim().url().max(200).optional(),
});

/** `Tenda 3x3` -> `tenda-3x3`. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createAdminRouter(): Router {
  const router = Router();

  // --- Login (sem token) ---------------------------------------------------

  router.post(
    '/login',
    handle(async (request, response) => {
      const key = clientKey(request);
      const rate = checkLoginRate(key);

      if (!rate.allowed) {
        response.setHeader('Retry-After', String(rate.retryAfterSeconds));
        fail(
          response,
          429,
          'too_many_attempts',
          `Muitas tentativas. Tente de novo em ${Math.ceil(rate.retryAfterSeconds / 60)} minuto(s).`
        );
        return;
      }

      const { pin } = loginSchema.parse(request.body);

      if (!verifyPin(pin)) {
        log.warn(`PIN incorreto (origem ${key})`);
        fail(response, 401, 'invalid_pin', 'PIN incorreto.');
        return;
      }

      clearLoginRate(key);

      const user = await getUser(env.adminSlackId);
      const name = user?.name ?? 'Administradora do Marketing';
      const { token, expiresAt } = issueToken(name);

      log.info(`login administrativo de ${name}`);
      response.json({ token, expiresAt, name, slackId: env.adminSlackId });
    })
  );

  // --- Daqui para baixo, tudo exige token ----------------------------------

  router.use(requireAdmin);

  router.get('/session', (request: AdminRequest, response: Response) => {
    response.json({ ok: true, slackId: request.admin?.slackId, name: request.admin?.name });
  });

  router.post(
    '/requests/:id/decision',
    handle(async (request, response) => {
      const payload = decisionSchema.parse(request.body);

      const result = await decideRequest({
        requestId: param(request, 'id'),
        decision: payload.decision,
        note: payload.note,
        force: payload.force,
        channel: 'app',
        actor: request.admin!,
      });

      response.json({ ok: true, status: result.status });
    })
  );

  router.post(
    '/requests/:id/return',
    handle(async (request, response) => {
      await markReturned(param(request, 'id'), request.admin!);
      response.json({ ok: true });
    })
  );

  router.post(
    '/requests/:id/messages',
    handle(async (request, response) => {
      const { text } = messageSchema.parse(request.body);
      await sendAdminMessage(param(request, 'id'), text, request.admin!);
      response.json({ ok: true });
    })
  );

  // --- Catálogo ------------------------------------------------------------

  router.post(
    '/items',
    handle(async (request, response) => {
      const payload = itemSchema.parse(request.body);

      const created = await collections.items().add({
        ...payload,
        imageUrl: payload.imageUrl || undefined,
        slug: slugify(payload.name),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: request.admin!.slackId,
      });

      log.info(`item criado: ${payload.name} (${created.id})`);
      response.json({ ok: true, id: created.id });
    })
  );

  router.patch(
    '/items/:id',
    handle(async (request, response) => {
      const payload = itemSchema.parse(request.body);
      const reference = collections.items().doc(param(request, 'id'));

      const snapshot = await reference.get();
      if (!snapshot.exists) {
        fail(response, 404, 'not_found', 'Item não encontrado.');
        return;
      }

      await reference.update({
        ...payload,
        imageUrl: payload.imageUrl || FieldValue.delete(),
        slug: slugify(payload.name),
        updatedAt: serverTimestamp(),
      });

      log.info(`item atualizado: ${payload.name} (${param(request, 'id')})`);
      response.json({ ok: true });
    })
  );

  router.delete(
    '/items/:id',
    handle(async (request, response) => {
      const itemId = param(request, 'id');
      await collections.items().doc(itemId).delete();
      log.info(`item removido: ${itemId}`);
      response.json({ ok: true });
    })
  );

  // --- Configurações -------------------------------------------------------

  router.patch(
    '/settings',
    handle(async (request, response) => {
      const payload = settingsSchema.parse(request.body);

      await collections.settingsApp().set(
        {
          ...(payload.cities ? { cities: payload.cities } : {}),
          ...(payload.purposeTypes ? { purposeTypes: payload.purposeTypes } : {}),
          ...(payload.appUrl ? { appUrl: payload.appUrl } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      response.json({ ok: true });
    })
  );

  return router;
}
