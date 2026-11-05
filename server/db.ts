// Postgres do FollowCatch. Banco compartilhado (Supabase do Social Hub): TUDO mora no
// schema `followcatch`. Nenhuma instrução aqui toca outro schema — não mudar isso.
import pg from "pg";

const SCHEMA = "followcatch";

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurado.");
  pool = new pg.Pool({
    connectionString: url,
    // Vercel: 1 conexão por instância, via pooler de transação (porta 6543).
    max: process.env.VERCEL ? 1 : 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  });
  pool.on("error", (e) => console.warn("[db] pool:", e.message));
  return pool;
}

/**
 * Pooler de transação (pgbouncer) não guarda estado de sessão: nada de prepared
 * statement nomeado nem `SET search_path`. Por isso todo SQL usa nome qualificado
 * `followcatch.tabela`.
 */
export async function q<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  await migrate();
  const r = await getPool().query<T>(sql, params);
  return r.rows;
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

// ---- migração idempotente (roda 1x por processo, no 1º acesso) -------------

// Simple query com várias instruções = 1 transação implícita. O advisory lock evita
// corrida de duas instâncias frias criando a mesma tabela ao mesmo tempo.
const DDL = `
SELECT pg_advisory_xact_lock(hashtext('followcatch_migrate'));
CREATE SCHEMA IF NOT EXISTS ${SCHEMA};

CREATE TABLE IF NOT EXISTS ${SCHEMA}.kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS ${SCHEMA}.gender (
  username text PRIMARY KEY,
  gender text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ${SCHEMA}.runs (
  id bigserial PRIMARY KEY,
  actor text NOT NULL,
  username text NOT NULL,
  itens integer NOT NULL,
  custo_est numeric(10,5) NOT NULL,
  ms integer NOT NULL,
  ok boolean NOT NULL DEFAULT true,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS runs_at ON ${SCHEMA}.runs (at);
-- Quem gerou o gasto: who = ip:<ip> ou user:<id>; bucket = 'visitor' ou 'subscriber'.
-- Runs antigos ficam com NULL (contam só no disjuntor global).
ALTER TABLE ${SCHEMA}.runs ADD COLUMN IF NOT EXISTS who text;
ALTER TABLE ${SCHEMA}.runs ADD COLUMN IF NOT EXISTS bucket text;
CREATE INDEX IF NOT EXISTS runs_bucket_at ON ${SCHEMA}.runs (bucket, at);

-- "quem" = ip:<ip> (grátis) ou user:<id> (assinante)
CREATE TABLE IF NOT EXISTS ${SCHEMA}.searches (
  who text NOT NULL,
  day date NOT NULL,
  username text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (who, day, username)
);

CREATE TABLE IF NOT EXISTS ${SCHEMA}.users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  pk_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_pk_customer ON ${SCHEMA}.users (pk_customer_id);

CREATE TABLE IF NOT EXISTS ${SCHEMA}.sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES ${SCHEMA}.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ${SCHEMA}.subscriptions (
  user_id text PRIMARY KEY REFERENCES ${SCHEMA}.users(id) ON DELETE CASCADE,
  pk_subscription_id text,
  pk_customer_id text,
  plan text,
  cycle text,
  status text NOT NULL DEFAULT 'none',
  pk_state text,
  renews_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ${SCHEMA}.checkouts (
  ref text PRIMARY KEY,
  user_id text NOT NULL REFERENCES ${SCHEMA}.users(id) ON DELETE CASCADE,
  pk_session_id text UNIQUE,
  plan text NOT NULL,
  cycle text NOT NULL,
  username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
-- checkout embutido (PaymentKit.js): token da sessão pra reaproveitar e cupom aplicado
ALTER TABLE ${SCHEMA}.checkouts ADD COLUMN IF NOT EXISTS secure_token text;
ALTER TABLE ${SCHEMA}.checkouts ADD COLUMN IF NOT EXISTS promo_code text;
ALTER TABLE ${SCHEMA}.checkouts ADD COLUMN IF NOT EXISTS embedded boolean NOT NULL DEFAULT false;

-- Stripe direto (15/10): cliente/assinatura do Stripe ao lado dos campos da PaymentKit
ALTER TABLE ${SCHEMA}.users ADD COLUMN IF NOT EXISTS stripe_customer_id text;
CREATE INDEX IF NOT EXISTS users_stripe_customer ON ${SCHEMA}.users (stripe_customer_id);
ALTER TABLE ${SCHEMA}.subscriptions ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'paymentkit';
ALTER TABLE ${SCHEMA}.subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE ${SCHEMA}.subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE ${SCHEMA}.checkouts ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'paymentkit';
ALTER TABLE ${SCHEMA}.checkouts ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
CREATE INDEX IF NOT EXISTS checkouts_stripe_sub ON ${SCHEMA}.checkouts (stripe_subscription_id);

CREATE TABLE IF NOT EXISTS ${SCHEMA}.webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);

CREATE TABLE IF NOT EXISTS ${SCHEMA}.password_resets (
  token_hash text PRIMARY KEY,
  user_id text REFERENCES ${SCHEMA}.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_email ON ${SCHEMA}.password_resets (email, created_at);

CREATE TABLE IF NOT EXISTS ${SCHEMA}.user_searches (
  user_id text NOT NULL REFERENCES ${SCHEMA}.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, username)
);
CREATE INDEX IF NOT EXISTS user_searches_recent ON ${SCHEMA}.user_searches (user_id, at DESC);

-- Uma linha por consulta de perfil, inclusive cache hits e visitantes sem conta.
CREATE TABLE IF NOT EXISTS ${SCHEMA}.search_events (
  id text PRIMARY KEY,
  visitor_id text NOT NULL,
  user_id text REFERENCES ${SCHEMA}.users(id) ON DELETE SET NULL,
  username text NOT NULL,
  outcome text NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'live',
  at timestamptz NOT NULL DEFAULT now()
);
-- Se a consulta foi atendida sem pagar ('hit': cache ou coleta já feita por outro) ou se disparou
-- coleta paga ('miss'). NULL = falhou antes de saber, ou registro antigo.
ALTER TABLE ${SCHEMA}.search_events ADD COLUMN IF NOT EXISTS cache text;
CREATE INDEX IF NOT EXISTS search_events_recent ON ${SCHEMA}.search_events (at DESC, id DESC);
CREATE INDEX IF NOT EXISTS search_events_user ON ${SCHEMA}.search_events (user_id, at DESC);
CREATE INDEX IF NOT EXISTS search_events_visitor ON ${SCHEMA}.search_events (visitor_id, at DESC);

-- Funil e ao vivo do /admin. Sem IP de propósito: só geo aproximada dos headers da Vercel.
CREATE TABLE IF NOT EXISTS ${SCHEMA}.funnel_events (
  id bigserial PRIMARY KEY,
  lead_id text NOT NULL,
  step text NOT NULL,
  user_id text REFERENCES ${SCHEMA}.users(id) ON DELETE SET NULL,
  country text,
  meta jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funnel_events_at ON ${SCHEMA}.funnel_events (at);
CREATE INDEX IF NOT EXISTS funnel_events_lead ON ${SCHEMA}.funnel_events (lead_id, at DESC);
CREATE TABLE IF NOT EXISTS ${SCHEMA}.live_sessions (
  lead_id text PRIMARY KEY,
  country text,
  region text,
  city text,
  device text,
  ad text,
  campaign text,
  step text,
  beats int NOT NULL DEFAULT 1,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_sessions_last ON ${SCHEMA}.live_sessions (last_seen);

CREATE TABLE IF NOT EXISTS ${SCHEMA}.migrations (id text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM ${SCHEMA}.migrations WHERE id = 'search_events_legacy_v1') THEN
    -- O limitador antigo guardava só perfis novos por IP/conta/dia, sem resultado.
    -- Não inferir identidade por IP nem apresentar esse histórico como completo.
    INSERT INTO ${SCHEMA}.search_events (id, visitor_id, user_id, username, outcome, source, at)
      SELECT 'legacy-rate:' || md5(s.who || ':' || s.day::text || ':' || s.username),
             'legacy:' || md5(s.who), u.id, s.username, 'unknown', 'legacy', s.at
      FROM ${SCHEMA}.searches s
      LEFT JOIN ${SCHEMA}.users u ON s.who = 'user:' || u.id
      ON CONFLICT DO NOTHING;
    INSERT INTO ${SCHEMA}.search_events (id, visitor_id, user_id, username, outcome, source, at)
      SELECT 'legacy-user:' || md5(s.user_id || ':' || s.username),
             'legacy:' || md5('user:' || s.user_id), s.user_id, s.username, 'success', 'legacy', s.at
      FROM ${SCHEMA}.user_searches s
      WHERE NOT EXISTS (
        SELECT 1 FROM ${SCHEMA}.search_events e
        WHERE e.user_id = s.user_id AND e.username = s.username
          AND (e.at AT TIME ZONE 'UTC')::date = (s.at AT TIME ZONE 'UTC')::date
      ) ON CONFLICT DO NOTHING;
    INSERT INTO ${SCHEMA}.migrations (id) VALUES ('search_events_legacy_v1');
  END IF;
END $$;
`;

let migrated: Promise<void> | null = null;

export function migrate(): Promise<void> {
  if (!migrated) {
    migrated = getPool()
      .query(DDL)
      .then(() => undefined)
      .catch((e) => {
        migrated = null; // tenta de novo na próxima requisição
        throw e;
      });
  }
  return migrated;
}
