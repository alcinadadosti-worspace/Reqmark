/**
 * Autenticacao das rotas `/admin/*` (secao 10).
 *
 * Nao ha usuarios nem senhas: existe UM PIN, conferido em tempo constante, que
 * troca por um token HMAC de 12 h. O token e opaco e autoassinado — nao ha
 * sessao no servidor para o Render free perder ao dormir.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ADMIN_TOKEN_TTL_MS, env } from '../env';

interface TokenPayload {
  /** Slack ID da administradora. */
  sub: string;
  name: string;
  /** Expiracao em epoch ms. */
  exp: number;
  /** Aleatorio, para dois tokens seguidos nunca serem iguais. */
  jti: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string): string {
  return createHmac('sha256', env.adminTokenSecret).update(payload).digest('base64url');
}

/**
 * Compara dois segredos sem vazar informacao pelo tempo de execucao.
 * Passa pelo SHA-256 antes para o `timingSafeEqual` receber sempre 32 bytes —
 * ele lanca excecao quando os buffers tem tamanhos diferentes, e isso por si so
 * ja revelaria o tamanho do PIN.
 */
export function safeCompare(a: string, b: string): boolean {
  const digestA = createHmac('sha256', env.adminTokenSecret).update(a).digest();
  const digestB = createHmac('sha256', env.adminTokenSecret).update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export function verifyPin(pin: string): boolean {
  return safeCompare(pin, env.adminPin);
}

export interface IssuedToken {
  token: string;
  expiresAt: number;
}

export function issueToken(name: string): IssuedToken {
  const expiresAt = Date.now() + ADMIN_TOKEN_TTL_MS;
  const payload: TokenPayload = {
    sub: env.adminSlackId,
    name,
    exp: expiresAt,
    jti: randomBytes(8).toString('hex'),
  };

  const encoded = base64url(JSON.stringify(payload));
  return { token: `${encoded}.${sign(encoded)}`, expiresAt };
}

export function verifyToken(token: string | undefined): TokenPayload | null {
  if (!token) return null;

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expected = sign(encoded);
  if (expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (typeof payload.exp !== 'number' || Date.now() >= payload.exp) return null;
    if (payload.sub !== env.adminSlackId) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rate limit do login
// ---------------------------------------------------------------------------

interface Attempt {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000;

const attempts = new Map<string, Attempt>();

/** Limpa registros velhos para o mapa nao crescer sem limite. */
function prune(now: number): void {
  for (const [key, attempt] of attempts) {
    if (now - attempt.firstAt > WINDOW_MS && now > attempt.blockedUntil) attempts.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Uma tentativa de PIN por chave (IP). Bloqueia por 15 min apos 8 erros. */
export function checkLoginRate(key: string): RateLimitResult {
  const now = Date.now();
  prune(now);

  const current = attempts.get(key);

  if (current && now < current.blockedUntil) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.blockedUntil - now) / 1000) };
  }

  if (!current || now - current.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;

  if (current.count > MAX_ATTEMPTS) {
    current.blockedUntil = now + BLOCK_MS;
    return { allowed: false, retryAfterSeconds: Math.ceil(BLOCK_MS / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Zera o contador apos um acerto. */
export function clearLoginRate(key: string): void {
  attempts.delete(key);
}
